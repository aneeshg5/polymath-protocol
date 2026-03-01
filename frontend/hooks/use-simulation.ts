// ============================================================================
// useSimulation — Central simulation lifecycle hook
// ============================================================================
// This hook owns all simulation state and exposes it to the page and child
// components. Phase 1 (init + research) and Phase 2 (WebSocket debate) are
// now wired to the real FastAPI backend. The swarm metrics animation and
// verdict data still use mocks pending their backend endpoints.
// ============================================================================

import { useState, useCallback, useEffect, useRef } from "react"
import type {
  SimulationState,
  DebateMessage,
  SwarmMetrics,
  VerdictData,
  AgentKey,
  ActivePersona,
} from "@/lib/types"
import { AGENT_DEBATE_STYLES } from "@/lib/mock-data"

// ── API / WS URLs ─────────────────────────────────────────────────────────────

const INIT_API_URL = "http://localhost:8000/api/v1/simulation/init"
const researchApiUrl = (simId: string) =>
  `http://localhost:8000/api/v1/simulation/${simId}/research`
const verdictApiUrl = (simId: string) =>
  `http://localhost:8000/api/v1/simulation/${simId}/verdict`
const WS_DEBATE_URL = "ws://localhost:8000/ws/debate"

// ── Dynamic agent style resolution ───────────────────────────────────────────
// AGENT_DEBATE_STYLES only covers the four hardcoded mock IDs (alpha–delta).
// For any backend-generated ID (e.g. "plaintiff", "defendant") we assign a
// color from the palette by the agent's position in the personas array.

const AGENT_STYLE_PALETTE = [
  { bgClass: "bg-amber-900/40 border-amber-700/40",     textColorClass: "text-amber-400"   },
  { bgClass: "bg-sky-900/40 border-sky-700/40",         textColorClass: "text-sky-400"     },
  { bgClass: "bg-emerald-900/40 border-emerald-700/40", textColorClass: "text-emerald-400" },
  { bgClass: "bg-purple-900/40 border-purple-700/40",   textColorClass: "text-purple-400"  },
  { bgClass: "bg-rose-900/40 border-rose-700/40",       textColorClass: "text-rose-400"    },
  { bgClass: "bg-cyan-900/40 border-cyan-700/40",       textColorClass: "text-cyan-400"    },
]

function resolveAgentStyle(
  agentId: string,
  personas: ActivePersona[]
): { label: string; bgClass: string; textColorClass: string } {
  if (agentId in AGENT_DEBATE_STYLES) {
    const s = AGENT_DEBATE_STYLES[agentId as AgentKey]
    return { label: s.label, bgClass: s.bgClass, textColorClass: s.textColorClass }
  }
  const idx = personas.findIndex((p) => p.id === agentId)
  const palette = AGENT_STYLE_PALETTE[Math.max(0, idx) % AGENT_STYLE_PALETTE.length]
  const persona = personas.find((p) => p.id === agentId)
  return { label: persona?.label ?? agentId, ...palette }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface UseSimulationReturn {
  /** Current phase of the simulation lifecycle */
  simulationState: SimulationState

  /** Ordered list of debate messages displayed in the transcript */
  debateTranscript: DebateMessage[]

  /** Whether a debate message is currently being streamed in */
  isDebateStreaming: boolean

  /** ID of the agent currently "typing", if any */
  currentTypingAgent: string | null

  /** Real-time swarm metrics for the arena overlay */
  swarmMetrics: SwarmMetrics

  /** Complete verdict payload — populated only in 'arbiter-verdict' state */
  verdictData: VerdictData | null

  /** Personas returned by the /init API — empty until a simulation starts */
  activeAgents: ActivePersona[]

  /** Error message from a failed Phase 1 fetch or WebSocket; null when clean */
  initError: string | null

  /** Human-readable label for the current arbiter generation step; null when idle */
  verdictStep: string | null

  /** Transition: intake → loading → war-room (real API + WebSocket) */
  initializeSimulation: (
    caseFile: File,
    jurisdiction: string,
    witnessTestimonialsFile: File | null
  ) => Promise<void>

  /** Transition: war-room → arbiter-verdict (calls Arbiter API, then transitions) */
  terminateSimulation: () => Promise<void>

  /** Transition: arbiter-verdict → intake (resets everything) */
  startNewCase: () => void
}

export function useSimulation(): UseSimulationReturn {
  // ── Core state machine ──────────────────────────────────────────────────
  const [simulationState, setSimulationState] = useState<SimulationState>("intake")

  // ── Debate transcript ───────────────────────────────────────────────────
  const [debateTranscript, setDebateTranscript] = useState<DebateMessage[]>([])
  const [isDebateStreaming, setIsDebateStreaming] = useState(false)
  const [currentTypingAgent, setCurrentTypingAgent] = useState<string | null>(null)

  // ── Swarm metrics ───────────────────────────────────────────────────────
  const [swarmMetrics, setSwarmMetrics] = useState<SwarmMetrics>({
    liveNodes: 100,
    convergence: 64,
    geoBiasActive: true,
  })

  // ── Verdict data ────────────────────────────────────────────────────────
  const [verdictData, setVerdictData] = useState<VerdictData | null>(null)

  // ── Active agents ────────────────────────────────────────────────────────
  const [activeAgents, setActiveAgents] = useState<ActivePersona[]>([])

  // ── Init error ──────────────────────────────────────────────────────────
  const [initError, setInitError] = useState<string | null>(null)

  // ── Verdict loading step ─────────────────────────────────────────────────
  // Null when idle; a human-readable label while terminateSimulation is in flight.
  const [verdictStep, setVerdictStep] = useState<string | null>(null)

  // ── Stable refs ──────────────────────────────────────────────────────────
  // wsRef:               lets cleanup/terminate close the socket from outside the closure
  // activeAgentsRef:     gives onmessage always-fresh persona list without stale closures
  // jurisdictionRef:     stored so terminateSimulation can send it to the verdict API
  // geographicBiasesRef: stored so the Arbiter can weight the jury swarm correctly
  // transcriptTurnsRef:  accumulates completed turns in backend shape {agent_id, label, content}
  // currentTurnContentRef: running concatenation of chunks for the turn currently in flight
  const simulationIdRef = useRef<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const activeAgentsRef = useRef<ActivePersona[]>([])
  const jurisdictionRef = useRef<string>("")
  const geographicBiasesRef = useRef<Record<string, unknown>[]>([])
  const transcriptTurnsRef = useRef<{ agent_id: string; label: string; content: string }[]>([])
  const currentTurnContentRef = useRef<string>("")

  // ── Transition: intake → loading → war-room ─────────────────────────────

  const initializeSimulation = useCallback(async (
    caseFile: File,
    jurisdiction: string,
    witnessTestimonialsFile: File | null
  ) => {
    setInitError(null)
    setSimulationState("loading")

    try {
      // ── Phase 1a: POST /init ─────────────────────────────────────────────
      const formData = new FormData()
      formData.append("file", caseFile)
      if (witnessTestimonialsFile) {
        formData.append("witness_testimonials", witnessTestimonialsFile)
      }
      formData.append("jurisdiction", jurisdiction)
      // Do NOT set Content-Type — fetch injects the multipart boundary automatically

      const initRes = await fetch(INIT_API_URL, { method: "POST", body: formData })
      if (!initRes.ok) {
        throw new Error(`Init API ${initRes.status}: ${await initRes.text()}`)
      }

      const initData = await initRes.json()
      const simId: string = initData.simulation_id
      const personas: ActivePersona[] = initData.personas ?? []
      const coreFacts: string = initData.core_facts ?? ""

      simulationIdRef.current = simId
      jurisdictionRef.current = jurisdiction
      geographicBiasesRef.current = (initData.geographic_biases ?? []) as Record<string, unknown>[]
      activeAgentsRef.current = personas
      setActiveAgents(personas)

      // ── Phase 1b: POST /research ─────────────────────────────────────────
      // Dispatches all personas to Modal in parallel; returns briefing docs.
      const researchRes = await fetch(researchApiUrl(simId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ core_facts: coreFacts, personas }),
      })
      if (!researchRes.ok) {
        throw new Error(`Research API ${researchRes.status}: ${await researchRes.text()}`)
      }

      const { briefings } = await researchRes.json()

      // ── Phase 2: enter War Room and open WebSocket ───────────────────────
      transcriptTurnsRef.current = []
      setSimulationState("war-room")
      setIsDebateStreaming(true)
      setDebateTranscript([])

      const ws = new WebSocket(WS_DEBATE_URL)
      wsRef.current = ws

      ws.onopen = () => {
        // Send the debate configuration as the first (and only) client message.
        ws.send(JSON.stringify({ personas, briefings }))
      }

      ws.onmessage = (event) => {
        const frame = JSON.parse(event.data as string)

        if (frame.type === "turn_start") {
          // Reset running content buffer for the incoming turn.
          currentTurnContentRef.current = ""
          // Each new speaker turn nudges convergence toward 98% — reflects the
          // swarm progressively aligning as the deliberation advances.
          setSwarmMetrics((prev) => ({
            ...prev,
            convergence: Math.min(98, prev.convergence + 2),
          }))
          // A new agent is about to speak — create a fresh empty message entry.
          const style = resolveAgentStyle(frame.agent_id, activeAgentsRef.current)
          setCurrentTypingAgent(frame.agent_id as string)
          setDebateTranscript((prev) => [
            ...prev,
            {
              id: prev.length,
              agent: style.label,
              bgClass: style.bgClass,
              textColorClass: style.textColorClass,
              content: "",
              timestamp: new Date().toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
              }),
            },
          ])
        } else if (frame.type === "chunk") {
          // Accumulate into the ref (for the verdict payload) and into React state (for the UI).
          currentTurnContentRef.current += (frame.content ?? "")
          setDebateTranscript((prev) => {
            if (prev.length === 0) return prev
            const updated = [...prev]
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: updated[updated.length - 1].content + (frame.content ?? ""),
            }
            return updated
          })
        } else if (frame.type === "turn_end") {
          // Snapshot the completed turn into the structured list for the Arbiter API.
          const turnLabel =
            activeAgentsRef.current.find((p) => p.id === frame.agent_id)?.label ??
            frame.agent_id
          transcriptTurnsRef.current.push({
            agent_id: frame.agent_id,
            label: turnLabel,
            content: currentTurnContentRef.current.trim(),
          })
          currentTurnContentRef.current = ""
          setCurrentTypingAgent(null)
        } else if (frame.type === "debate_complete") {
          setIsDebateStreaming(false)
          setCurrentTypingAgent(null)
          ws.close()
        } else if (frame.type === "error") {
          setInitError(frame.message ?? "Debate error. Please try again.")
          setSimulationState("intake")
          setIsDebateStreaming(false)
          ws.close()
        }
        // "status" frames are informational only — no state update needed.
      }

      ws.onerror = () => {
        setInitError("WebSocket connection failed. Is the backend running?")
        setSimulationState("intake")
        setIsDebateStreaming(false)
      }

      ws.onclose = () => {
        // Ensure streaming is always false after the socket closes, regardless
        // of which code path triggered the close.
        setIsDebateStreaming(false)
        setCurrentTypingAgent(null)
        if (wsRef.current === ws) wsRef.current = null
      }
    } catch (err) {
      console.error("Simulation failed:", err)
      setInitError(
        err instanceof Error ? err.message : "Simulation failed. Please try again."
      )
      setSimulationState("intake")
    }
  }, [])

  // Swarm convergence is driven by debate activity — see the turn_start handler
  // in initializeSimulation where it increments by 2% per new speaker turn.

  // ── WebSocket cleanup on unmount ──────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [])

  // ── Transition: war-room → arbiter-verdict ──────────────────────────────

  const terminateSimulation = useCallback(async () => {
    // 1. Immediately stop the debate stream and show the first step.
    setVerdictStep("Closing debate stream...")
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setIsDebateStreaming(false)
    setCurrentTypingAgent(null)

    const simId = simulationIdRef.current
    if (!simId) {
      setVerdictStep(null)
      return
    }

    // 2. Build the verdict request body from refs (always fresh, no stale closure risk).
    const body = {
      jurisdiction: jurisdictionRef.current,
      geographic_biases: geographicBiasesRef.current,
      debate_transcript: transcriptTurnsRef.current,
    }

    try {
      setVerdictStep("Calling Arbiter Agent...")
      const res = await fetch(verdictApiUrl(simId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`Verdict API ${res.status}: ${await res.text()}`)

      setVerdictStep("Synthesizing verdict...")
      const raw = await res.json()

      // 3. Map the snake_case backend response to the camelCase frontend VerdictData shape
      //    so ArbiterVerdict renders without any changes.
      const PALETTE = ["#d97706", "#0ea5e9", "#10b981", "#a855f7", "#f43f5e", "#06b6d4"]
      const resolveLabel = (agentId: string) =>
        activeAgentsRef.current.find((p) => p.id === agentId)?.label ?? agentId

      const consensus = (raw.consensus ?? []).map(
        (c: { agent_id: string; percentage: number }, i: number) => ({
          name: resolveLabel(c.agent_id),
          value: c.percentage,
          color: PALETTE[i % PALETTE.length],
        })
      )

      // barData mirrors consensus — same agent order, same colours.
      const barData = (raw.consensus ?? []).map(
        (c: { agent_id: string; percentage: number }, i: number) => ({
          agent: resolveLabel(c.agent_id),
          nodes: c.percentage,
          fill: PALETTE[i % PALETTE.length],
        })
      )

      const advantages = (raw.advantages ?? []).map(
        (a: { argument: string; agent_id: string; category: string; weight: number }, i: number) => ({
          id: i + 1,
          argument: a.argument,
          weight: a.weight,
          agent: resolveLabel(a.agent_id),
          category: a.category,
        })
      )

      const flaws = (raw.flaws ?? []).map(
        (f: { flaw: string; agent_id: string; severity: string; penalty: number }, i: number) => ({
          id: i + 1,
          flaw: f.flaw,
          severity: f.severity as VerdictData["flaws"][number]["severity"],
          agent: resolveLabel(f.agent_id),
          penalty: f.penalty,
        })
      )

      const verdict: VerdictData = {
        simulationId: raw.simulation_id,
        jurisdiction: raw.jurisdiction,
        depthLabel: raw.depth ?? "DEEP DELIBERATION",
        timestamp: new Date().toLocaleString("en-US", {
          year: "numeric", month: "short", day: "numeric",
          hour: "2-digit", minute: "2-digit",
        }),
        summaryText: raw.summary,
        compositeMerit: raw.composite_merit_score,
        confidence: raw.confidence,
        deliberationRounds: raw.deliberation_rounds,
        consensus,
        barData,
        advantages,
        flaws,
      }

      setVerdictData(verdict)
    } catch (err) {
      console.error("Verdict fetch failed:", err)
      setInitError(
        err instanceof Error ? err.message : "Arbiter failed to generate a verdict."
      )
    } finally {
      setVerdictStep(null)
    }

    // 4. Transition regardless of fetch outcome — if fetch failed, the user
    //    will see the error banner; if it succeeded, they see the full report.
    setSimulationState("arbiter-verdict")
  }, [])

  // ── Transition: arbiter-verdict → intake (full reset) ───────────────────

  const startNewCase = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setSimulationState("intake")
    setDebateTranscript([])
    setIsDebateStreaming(false)
    setCurrentTypingAgent(null)
    setSwarmMetrics({ liveNodes: 100, convergence: 64, geoBiasActive: true })
    setVerdictData(null)
    setActiveAgents([])
    activeAgentsRef.current = []
    jurisdictionRef.current = ""
    geographicBiasesRef.current = []
    transcriptTurnsRef.current = []
    currentTurnContentRef.current = ""
    setInitError(null)
    setVerdictStep(null)
    simulationIdRef.current = null
  }, [])

  return {
    simulationState,
    debateTranscript,
    isDebateStreaming,
    currentTypingAgent,
    swarmMetrics,
    verdictData,
    activeAgents,
    initError,
    verdictStep,
    initializeSimulation,
    terminateSimulation,
    startNewCase,
  }
}
