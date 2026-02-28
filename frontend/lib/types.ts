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
  id: AgentKey
  label: string
  archetype: string
  color: string
  x: number            // 0..1 normalized
  y: number            // 0..1 normalized
}

/** A single swarm dot with drift/persuasion parameters */
export interface SwarmDot {
  id: number
  x: number
  y: number
  targetAgent: number  // index into agents array
  speed: number
  offsetAngle: number
  radius: number
}

/** Real-time metrics overlay for the swarm arena */
export interface SwarmMetrics {
  liveNodes: number
  convergence: number
  geoBiasActive: boolean
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
  consensus: ConsensusEntry[]
  barData: BarEntry[]
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
