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
