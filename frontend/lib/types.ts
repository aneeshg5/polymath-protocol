// ============================================================================
// Judicial Streamlining Tool — Shared Type Definitions
// ============================================================================
// These types define the data contracts between the frontend and the
// Python/FastAPI backend. Every interface here should mirror a corresponding
// Pydantic model on the server.
// ============================================================================

/** State machine for the simulation lifecycle */
export type SimulationState = "intake" | "loading" | "war-room" | "arbiter-verdict"

// ── Agent Archetypes ────────────────────────────────────────────────────────

/** Identifier keys for the four agent archetypes */
export type AgentKey = "alpha" | "beta" | "gamma" | "delta"

/** A single agent persona as returned by the /api/v1/simulation/init endpoint */
export interface ActivePersona {
  id: string
  label: string
  archetype_name: string
  system_prompt: string
}

/**
 * Defines a single AI agent archetype used across swarm, debate, and verdict.
 * The color is stored as a hex string because Recharts (used in verdict charts)
 * requires computed JS colors — never CSS variables.
 */
export interface AgentArchetype {
  id: AgentKey
  label: string        // e.g. "Agent α"
  archetype: string    // e.g. "Strict Constitutionalist"
  color: string        // hex: "#d97706"
}

/** Visual styling config for debate transcript rendering */
export interface AgentDebateStyle {
  label: string
  bgClass: string      // Tailwind bg + border classes e.g. "bg-amber-900/40 border-amber-700/40"
  textColorClass: string // Tailwind text class e.g. "text-amber-400"
}

// ── Debate Telemetry ────────────────────────────────────────────────────────

/** A single scripted debate exchange (input from backend) */
export interface DebateScriptEntry {
  agent: AgentKey
  content: string
}

/** A fully rendered debate message (frontend display model) */
export interface DebateMessage {
  id: number
  agent: string        // resolved label e.g. "Agent α"
  bgClass: string
  textColorClass: string
  content: string
  timestamp: string
}

// ── Swarm Arena ─────────────────────────────────────────────────────────────

/** Node position in the force-directed graph (normalized 0..1) */
export interface AgentNode {
  id: string           // arbitrary backend-generated ID (e.g. "plaintiff", "alpha")
  label: string
  archetype: string
  color: string
  x: number            // 0..1 normalized
  y: number            // 0..1 normalized
}

/** A single swarm dot with drift/persuasion parameters */
export interface SwarmDot {
  id: number
  x: number                    // current rendered position (mutated every frame)
  y: number
  targetAgent: number | null   // null = Undecided (orbits center); number = index into agents array
  speed: number
  offsetAngle: number
  radius: number
  pull: number                 // per-dot lerp speed (0 → MAX_PULL); reset to 0 on retarget
  stubbornness: number         // 0..1 — dots above 0.8 never change allegiance during the debate
}

/** Real-time metrics overlay for the swarm arena */
export interface SwarmMetrics {
  liveNodes: number
  convergence: number
  geoBiasActive: boolean
}

/** Live Arbiter snapshot — emitted by the backend after every debate turn */
export interface LiveConsensusUpdate {
  /** Keys are agent IDs or "Undecided", values are integer percentages summing to 100 */
  distribution: Record<string, number>
  /** The agent whose turn was just evaluated */
  speakerId: string
}

// ── Arbiter Verdict ─────────────────────────────────────────────────────────

/** Pie/bar chart data for a single consensus slice */
export interface ConsensusEntry {
  name: string
  value: number        // percentage of nodes
  color: string        // hex for Recharts
}

/** Bar chart data model */
export interface BarEntry {
  agent: string
  nodes: number
  fill: string         // hex for Recharts
}

/** A winning argument that survived cross-examination */
export interface AdvantageEntry {
  id: number
  argument: string
  weight: number       // 0..100 composite persuasion score
  agent: string
  category: string     // e.g. "Legal Precedent", "Evidentiary"
}

/** Severity levels for detected flaws */
export type FlawSeverity = "Critical" | "Major" | "Moderate" | "Minor"

/** A logical flaw detected during the adversarial debate */
export interface FlawEntry {
  id: number
  flaw: string
  severity: FlawSeverity
  agent: string
  penalty: number      // negative score impact
}

/** Complete verdict payload returned by the Arbiter LLM */
export interface VerdictData {
  simulationId: string
  jurisdiction: string
  depthLabel: string
  timestamp: string
  /** Arbiter's independent analytical consensus calculation */
  consensus: ConsensusEntry[]
  barData: BarEntry[]
  /** Exact dot distribution the swarm was showing at simulation termination */
  swarmConsensus: ConsensusEntry[] | null
  swarmBarData: BarEntry[] | null
  advantages: AdvantageEntry[]
  flaws: FlawEntry[]
  summaryText: string
  compositeMerit: string      // e.g. "0.871 ± 0.023"
  confidence: string           // e.g. "HIGH"
  deliberationRounds: number
}

/** Severity → Tailwind text color mapping */
export const SEVERITY_COLORS: Record<FlawSeverity, string> = {
  Critical: "text-red-400",
  Major: "text-amber-400",
  Moderate: "text-yellow-500",
  Minor: "text-muted-foreground",
}
