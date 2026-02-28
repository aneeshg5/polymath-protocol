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
        persona: dict,
        briefing_doc: str,
        debate_history: list,
        all_personas: list,
    ):
        """Stream a rapid-fire adversarial debate turn for one agent.

        Hard-capped at 150 tokens per turn so the debate stays punchy. Each
        turn after the first is explicitly directed to attack the most recent
        opposing argument rather than monologuing from its own brief.

        Args:
            persona:        The speaking agent's dict (id, label, archetype_name,
                            system_prompt) — matches the Persona shape from /init.
            briefing_doc:   The agent's Internal Legal Briefing from Phase 1.
            debate_history: Ordered prior turns —
                            [{"agent_id": str, "label": str, "content": str}, ...]
            all_personas:   Full list of every agent in the simulation. Used to
                            build a named roster so agents address each other
                            by label rather than using generic terms.

        Yields:
            str: successive 3-word chunks of the generated argument.
        """
        from vllm import SamplingParams

        # Hard cap: 150 tokens forces punchy, 1–3 sentence responses.
        # repetition_penalty discourages the model from looping on stock phrases.
        sampling_params = SamplingParams(
            temperature=0.7,
            max_tokens=150,
            repetition_penalty=1.1,
        )

        # Build a named roster of every participant so the model can address
        # opponents by their specific label rather than "opposing counsel".
        roster = "\n".join(
            f"- {p['label']} ({p['archetype_name']})"
            for p in all_personas
        )

        if not debate_history:
            # Opening statement — no opponent to rebut yet.
            user_content = (
                f"You are {persona['label']} ({persona['archetype_name']}).\n"
                f"Your strategy: {briefing_doc}\n\n"
                f"You are in a multi-party legal debate with these individuals:\n{roster}\n\n"
                "Give a punchy, aggressive OPENING STATEMENT in maximum 3 sentences "
                "outlining your core legal argument. "
                "Address the other participants by their specific label when relevant. "
                "Do not use generic terms like 'opposing counsel'. No filler words."
            )
        else:
            # Extract only the immediately preceding turn so the 8B model's
            # attention focuses on rebuttal rather than summarising the whole history.
            last_speaker = debate_history[-1]["label"]
            last_message = debate_history[-1]["content"]

            user_content = (
                f"You are {persona['label']} ({persona['archetype_name']}).\n"
                f"Your strategy: {briefing_doc}\n\n"
                f"You are in a multi-party legal debate with these individuals:\n{roster}\n\n"
                f"{last_speaker} just argued:\n"
                f'"{last_message}"\n\n'
                f"DIRECTLY ATTACK AND DISMANTLE {last_speaker}'s argument. "
                "Point out the specific legal flaw, logical fallacy, or weak precedent "
                "in what they said, then counter it with your strategy. "
                "Address participants by their specific label — never say 'opposing counsel'. "
                "Keep it UNDER 3 SENTENCES. No pleasantries."
            )

        # Llama 3 Instruct requires the chat-ML special tokens; plain prompts
        # cause the model to ignore the instruction and ramble.
        prompt = (
            "<|begin_of_text|>"
            "<|start_header_id|>system<|end_header_id|>\n\n"
            f"{persona['system_prompt']}"
            "<|eot_id|>"
            "<|start_header_id|>user<|end_header_id|>\n\n"
            f"{user_content}"
            "<|eot_id|>"
            "<|start_header_id|>assistant<|end_header_id|>\n\n"
        )

        outputs = self.llm.generate([prompt], sampling_params)
        full_text = outputs[0].outputs[0].text.strip()

        # Strip common LLM formatting artifacts that look bad in the UI.
        for artifact in ("**Paragraph 1:**", "**Argument:**", "**Opening Statement:**"):
            full_text = full_text.replace(artifact, "")
        full_text = full_text.strip()

        # Yield in 3-word groups with a trailing space so the frontend can
        # concatenate chunks directly without any separator logic.
        words = full_text.split()
        chunk_size = 3
        for i in range(0, len(words), chunk_size):
            chunk = " ".join(words[i : i + chunk_size])
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
