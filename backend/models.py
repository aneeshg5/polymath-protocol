from pydantic import BaseModel, Field
from typing import List


class Persona(BaseModel):
    id: str = Field(description="A short unique ID, e.g., 'alpha'")
    label: str = Field(description="The formal title, e.g., 'Agent Alpha'")
    archetype_name: str = Field(description="The legal stance, e.g., 'Strict Constitutionalist'")
    system_prompt: str = Field(
        description="The hidden instructions dictating how this agent must argue."
    )


class GeographicBias(BaseModel):
    demographic_trait: str = Field(description="e.g., 'Suburban Property Owners'")
    bias_weight: float = Field(
        description="A float from -1.0 to 1.0 indicating bias toward the defense/plaintiff"
    )
    description: str = Field(
        description="Why this local demographic leans this way based on regional culture."
    )


class PreProcessorOutput(BaseModel):
    core_facts: str = Field(description="A dense, 3-sentence summary of the case.")
    relevant_precedents: List[str] = Field(
        description="List of legal precedents found from the web search."
    )
    geographic_biases: List[GeographicBias] = Field(
        description="The jurisdictional biases dictating the 100-node swarm."
    )
    personas: List[Persona] = Field(
        description="Dynamically generated 3 to 5 agents representing the main legal arguments.",
        min_length=3,
        max_length=10,
    )


class SimulationInitResponse(PreProcessorOutput):
    simulation_id: str


# ── Research Phase ────────────────────────────────────────────────────────────

class ResearchPhaseRequest(BaseModel):
    """Request body for POST /api/v1/simulation/{sim_id}/research."""
    core_facts: str
    personas: List[Persona]


class BriefingDocument(BaseModel):
    """A single agent's Internal Legal Briefing Document returned by Modal."""
    agent_id: str
    briefing_doc: str


class ResearchPhaseResponse(BaseModel):
    """Response envelope for the research phase endpoint."""
    sim_id: str
    briefings: List[BriefingDocument]


# ── Live Consensus ────────────────────────────────────────────────────────────

class LiveConsensus(BaseModel):
    """Real-time jury alignment snapshot emitted by the Arbiter after each debate turn."""
    turn_number: int
    distribution: dict[str, int] = Field(
        description=(
            "Keys are agent IDs (or 'Undecided'), values are integer percentages. "
            "All values must sum to exactly 100."
        )
    )


# ── Verdict Phase ─────────────────────────────────────────────────────────────

class TranscriptTurn(BaseModel):
    """A single completed turn from the debate, as stored by the WebSocket handler."""
    agent_id: str
    label: str
    content: str


class VerdictRequest(BaseModel):
    """Request body for POST /api/v1/simulation/{sim_id}/verdict."""
    jurisdiction: str
    geographic_biases: List[dict]
    debate_transcript: List[TranscriptTurn]


# ── Arbiter Verdict ───────────────────────────────────────────────────────────

class ConsensusEntry(BaseModel):
    """A single agent's share of the 100-node swarm vote."""
    agent_id: str = Field(
        description="The ID of the agent, or 'Undecided' for nodes that did not converge."
    )
    percentage: int = Field(
        description=(
            "The percentage of the 100-node swarm that aligned with this agent. "
            "All percentages across the full consensus array must sum to exactly 100."
        )
    )


class AdvantageEntry(BaseModel):
    """A single persuasive argument that survived cross-examination."""
    argument: str = Field(
        description="A specific, highly persuasive legal argument made during the debate."
    )
    agent_id: str = Field(
        description="The ID of the agent who made this argument."
    )
    category: str = Field(
        description=(
            "The legal category of the argument. "
            "Must be one of: 'Legal Precedent', 'Evidentiary', 'Statutory', 'Consensus'."
        )
    )
    weight: float = Field(
        description=(
            "A score from 0.0 to 100.0 indicating the persuasive weight of this argument "
            "relative to all other arguments in the debate."
        )
    )


class FlawEntry(BaseModel):
    """A logical or legal flaw detected in an agent's argumentation."""
    flaw: str = Field(
        description=(
            "A specific logical fallacy, weak precedent, or failure to address a "
            "counter-argument detected during the debate."
        )
    )
    agent_id: str = Field(
        description="The ID of the agent who committed this flaw."
    )
    severity: str = Field(
        description=(
            "The severity of the flaw. "
            "Must be one of: 'Critical', 'Major', 'Moderate', 'Minor'."
        )
    )
    penalty: float = Field(
        description=(
            "A negative score from -1.0 to -20.0 indicating the composite merit "
            "penalty applied for this flaw."
        )
    )


class VerdictData(BaseModel):
    """Structured output produced by the Arbiter LLM at the end of a simulation."""
    simulation_id: str = Field(description="The unique ID of the simulation being evaluated.")
    jurisdiction: str = Field(description="The jurisdiction string passed at simulation init.")
    depth: str = Field(description="Always the string 'DEEP DELIBERATION'.")
    summary: str = Field(
        description=(
            "A dense, highly analytical 3-4 paragraph synthesis of the debate, written in "
            "the third-person authoritative voice of an impartial judicial arbiter. "
            "Must reference specific arguments and agents by name, and include the composite "
            "merit scores for each agent."
        )
    )
    composite_merit_score: str = Field(
        description=(
            "The overall composite merit score of the winning argument, expressed as a "
            "mean ± standard deviation. Example: '0.871 ± 0.023'."
        )
    )
    confidence: str = Field(
        description=(
            "The arbiter's confidence in the verdict. "
            "Must be one of: 'HIGH', 'MEDIUM', 'LOW'."
        )
    )
    deliberation_rounds: int = Field(
        description="The number of debate rounds that were completed before the verdict."
    )
    consensus: List[ConsensusEntry] = Field(
        description="Swarm vote distribution. All percentage values must sum to exactly 100."
    )
    advantages: List[AdvantageEntry] = Field(
        description="The strongest arguments that withstood cross-examination, ordered by weight descending."
    )
    flaws: List[FlawEntry] = Field(
        description="Logical and legal flaws detected across all agents, ordered by severity."
    )
