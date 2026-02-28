import modal

# ── Image ─────────────────────────────────────────────────────────────────────
# hf-transfer must be installed alongside HF_HUB_ENABLE_HF_TRANSFER=1 —
# setting the env var alone does nothing without the package present.

image = (
    modal.Image.debian_slim()
    .pip_install(
        "vllm>=0.5.0",           # 0.3.3 predates Llama-3 and lacks rope_scaling support
        "torch>=2.4.0",          # vLLM requires PyTorch >= 2.4 for modern model architectures
        "transformers>=4.43.1",  # Llama-3's rope_scaling format requires 4.43+
        "hf-transfer",           # required for HF_HUB_ENABLE_HF_TRANSFER to work
        "langchain",
        "langchain-community",
        "langchain-openai",
        "tavily-python",
    )
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})
)

# ── App ───────────────────────────────────────────────────────────────────────

app = modal.App("polymath-legal-fleet")

# ── Engine ────────────────────────────────────────────────────────────────────
# Prerequisites before deploying:
#   1. Llama 3 is a gated model. Request access at:
#      https://huggingface.co/meta-llama/Meta-Llama-3-8B-Instruct
#   2. Create the Modal secret from your CLI (run once):
#      modal secret create huggingface-secret HF_TOKEN=hf_your_token_here
#   The secret injects HF_TOKEN into the container environment so that
#   huggingface_hub can authenticate against the gated model repo.

@app.cls(
    gpu="A10G",
    scaledown_window=300,   # renamed from container_idle_timeout in Modal v1.0
    max_containers=10,      # renamed from concurrency_limit in Modal v1.0
    image=image,
    secrets=[modal.Secret.from_name("huggingface-secret")],
)
class LegalAgentEngine:

    @modal.enter()
    def load_model(self):
        """Runs once when the container starts. Loads the LLM into GPU memory."""
        from vllm import LLM

        self.llm = LLM(
            model="meta-llama/Meta-Llama-3-8B-Instruct",
            gpu_memory_utilization=0.90,
        )

    @modal.method()
    def execute_research_phase(self, persona_dict: dict, core_facts: str) -> dict:
        """Generate an Internal Legal Briefing Document for a single agent persona.

        Args:
            persona_dict: Must contain 'id', 'label', and 'system_prompt' keys —
                          matches the Persona shape returned by the /init endpoint.
            core_facts:   The 3-sentence case summary from PreProcessorOutput.

        Returns:
            {"agent_id": str, "briefing_doc": str}
        """
        from vllm import SamplingParams

        # Llama 3 Instruct uses a strict chat-ML template with special header tokens.
        # Omitting these causes the model to ignore the system prompt entirely.
        prompt = (
            "<|begin_of_text|>"
            "<|start_header_id|>system<|end_header_id|>\n\n"
            f"{persona_dict['system_prompt']}"
            "<|eot_id|>"
            "<|start_header_id|>user<|end_header_id|>\n\n"
            f"You have been assigned to the following legal case:\n\n"
            f"{core_facts}\n\n"
            "Write a detailed 3-paragraph Internal Legal Briefing Document outlining "
            "your strategic approach from your assigned perspective. Structure it as:\n"
            "  Paragraph 1 — Core legal theory and your strongest arguments.\n"
            "  Paragraph 2 — Key precedents and statutes you will invoke.\n"
            "  Paragraph 3 — Anticipated counter-arguments and your rebuttals."
            "<|eot_id|>"
            "<|start_header_id|>assistant<|end_header_id|>\n\n"
        )

        sampling_params = SamplingParams(
            temperature=0.7,
            top_p=0.9,
            max_tokens=1024,
        )

        outputs = self.llm.generate([prompt], sampling_params)
        output_text = outputs[0].outputs[0].text.strip()

        return {
            "agent_id": persona_dict["id"],
            "briefing_doc": output_text,
        }

    @modal.method(is_generator=True)
    def generate_debate_turn(
        self,
        persona_dict: dict,
        briefing_doc: str,
        debate_history: list,
    ):
        """Stream a 2-paragraph adversarial debate turn for one agent.

        Uses the synchronous vLLM LLM to generate the full response, then
        yields it in 4-word chunks so the FastAPI WebSocket can stream tokens
        to the frontend as they arrive.

        Args:
            persona_dict:   Agent identity dict (id, label, system_prompt).
            briefing_doc:   The agent's Internal Legal Briefing from Phase 1.
            debate_history: Ordered list of prior turns —
                            [{"agent_id": str, "label": str, "content": str}, ...]
                            Capped to the last 6 turns inside the prompt to
                            manage context window size.

        Yields:
            str: successive word-group chunks of the generated argument.
        """
        from vllm import SamplingParams

        # Build the debate history section — cap at last 6 turns to avoid
        # overflowing the 8k context window of Llama-3-8B with long debates.
        if debate_history:
            history_lines = "\n".join(
                f"[{t['label']}]:\n{t['content']}"
                for t in debate_history[-6:]
            )
            user_content = (
                f"DEBATE HISTORY (most recent exchanges):\n\n{history_lines}\n\n"
                "Based on the debate above and your internal briefing, formulate a "
                "sharp 2-paragraph adversarial argument.\n"
                "  Paragraph 1 — State your strongest legal position clearly.\n"
                "  Paragraph 2 — Directly attack the weakest point in the "
                "opposition's most recent argument with specific legal counter-evidence."
            )
        else:
            # First speaker of Round 1 has no history to rebut.
            user_content = (
                "The debate is beginning. Based on your internal briefing, open "
                "with a commanding 2-paragraph legal argument that establishes your "
                "core theory and pre-empts the strongest counter-positions."
            )

        prompt = (
            "<|begin_of_text|>"
            "<|start_header_id|>system<|end_header_id|>\n\n"
            f"{persona_dict['system_prompt']}\n\n"
            f"Your Internal Legal Briefing:\n{briefing_doc}"
            "<|eot_id|>"
            "<|start_header_id|>user<|end_header_id|>\n\n"
            f"{user_content}"
            "<|eot_id|>"
            "<|start_header_id|>assistant<|end_header_id|>\n\n"
        )

        sampling_params = SamplingParams(
            temperature=0.8,
            top_p=0.9,
            max_tokens=512,
        )

        outputs = self.llm.generate([prompt], sampling_params)
        full_text = outputs[0].outputs[0].text.strip()

        # Yield in 4-word groups. The space suffix ensures words re-join cleanly
        # on the frontend without needing any separator logic.
        words = full_text.split(" ")
        chunk_size = 4
        for i in range(0, len(words), chunk_size):
            chunk = " ".join(words[i : i + chunk_size])
            # Add a trailing space on every chunk except the last so tokens
            # concatenate correctly when the frontend appends them.
            if i + chunk_size < len(words):
                chunk += " "
            yield chunk


# ── Local test entrypoint ─────────────────────────────────────────────────────
# Run with: modal run inference.py
# This deploys the image and verifies the Modal connection. The actual model
# load happens inside the container on first invocation, not here.

@app.local_entrypoint()
def main():
    print("Testing polymath-legal-fleet — calling execute_research_phase remotely...")

    engine = LegalAgentEngine()

    test_persona = {
        "id": "alpha",
        "label": "Agent Alpha",
        "system_prompt": (
            "You are a Strict Constitutionalist. You argue exclusively from the text "
            "of the Constitution and established originalist precedent. You reject "
            "pragmatic or consequentialist reasoning in all forms."
        ),
    }
    test_facts = (
        "John Doe is suing the city of Chicago, alleging officers conducted an "
        "unconstitutional search of his vehicle without probable cause during a "
        "routine traffic stop. The city contends the smell of contraband provided "
        "sufficient probable cause under existing Fourth Amendment doctrine."
    )

    result = engine.execute_research_phase.remote(test_persona, test_facts)
    print(f"\n── Agent: {result['agent_id']} ──")
    print(result["briefing_doc"])
