// ============================================================================
// useSimulation — Central simulation lifecycle hook
// ============================================================================
// This hook owns all simulation state and exposes it to the page and child
// components. The /init call is now a real API fetch; all other state
// (debate streaming, swarm metrics) still uses mock data pending the
// WebSocket debate endpoint.
// ============================================================================

import { useState, useCallback, useEffect, useRef } from "react"
import type {
  SimulationState,
  DebateMessage,
  DebateScriptEntry,
  SwarmMetrics,
  VerdictData,
  AgentKey,
  ActivePersona,
} from "@/lib/types"
import {
  AGENT_DEBATE_STYLES,
  MOCK_DEBATE_SCRIPT,
  getMockVerdictData,
} from "@/lib/mock-data"

const INIT_API_URL = "http://localhost:8000/api/v1/simulation/init"

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDebateTimestamp(index: number): string {
  const base = new Date(2026, 1, 27, 14, 30, 0)
  base.setSeconds(base.getSeconds() + index * 12)
  return base.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

function scriptEntryToMessage(entry: DebateScriptEntry, index: number): DebateMessage {
  const style = AGENT_DEBATE_STYLES[entry.agent]
  return {
    id: index,
    agent: style.label,
    bgClass: style.bgClass,
    textColorClass: style.textColorClass,
    content: entry.content,
    timestamp: formatDebateTimestamp(index),
  }
}

// ── Hook ────────────────────────────────────────────────────────────────────

export interface UseSimulationReturn {
  /** Current phase of the simulation lifecycle */
  simulationState: SimulationState

  /** Ordered list of debate messages displayed in the transcript */
  debateTranscript: DebateMessage[]

  /** Whether a new debate message is being "typed" (or streamed in) */
  isDebateStreaming: boolean

  /** The agent key currently "typing", if any */
  currentTypingAgent: AgentKey | null

  /** Real-time swarm metrics for the arena overlay */
  swarmMetrics: SwarmMetrics

  /** Complete verdict payload — populated only in 'arbiter-verdict' state */
  verdictData: VerdictData | null

  /** Personas returned by the /init API — empty until a simulation starts */
  activeAgents: ActivePersona[]

  /** Error message if /init failed; null when clean */
  initError: string | null

  /** Transition: intake → loading → war-room (real API call) */
  initializeSimulation: (file: File, jurisdiction: string) => Promise<void>

  /** Transition: war-room → arbiter-verdict (terminates the debate) */
  terminateSimulation: () => void

  /** Transition: arbiter-verdict → intake (resets everything) */
  startNewCase: () => void
}

export function useSimulation(): UseSimulationReturn {
  // ── Core state machine ──────────────────────────────────────────────────
  const [simulationState, setSimulationState] = useState<SimulationState>("intake")

  // ── Debate transcript ───────────────────────────────────────────────────
  const [debateTranscript, setDebateTranscript] = useState<DebateMessage[]>([])
  const [isDebateStreaming, setIsDebateStreaming] = useState(false)
  const [currentTypingAgent, setCurrentTypingAgent] = useState<AgentKey | null>(null)
  const debateIndexRef = useRef(0)

  // ── Swarm metrics ───────────────────────────────────────────────────────
  const [swarmMetrics, setSwarmMetrics] = useState<SwarmMetrics>({
    liveNodes: 100,
    convergence: 64,
    geoBiasActive: true,
  })

  // ── Verdict data ────────────────────────────────────────────────────────
  const [verdictData, setVerdictData] = useState<VerdictData | null>(null)

  // ── Active agents (from /init API) ──────────────────────────────────────
  const [activeAgents, setActiveAgents] = useState<ActivePersona[]>([])

  // ── Init error ──────────────────────────────────────────────────────────
  const [initError, setInitError] = useState<string | null>(null)

  // ── Simulation ID (stored for future WebSocket/terminate calls) ──────────
  const simulationIdRef = useRef<string | null>(null)

  // ── Transition: intake → loading → war-room ─────────────────────────────

  const initializeSimulation = useCallback(async (file: File, jurisdiction: string) => {
    setInitError(null)
    setSimulationState("loading")

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("jurisdiction", jurisdiction)

      const res = await fetch(INIT_API_URL, {
        method: "POST",
        body: formData,
        // Do NOT set Content-Type — fetch injects the multipart boundary automatically
      })

      if (!res.ok) {
        const detail = await res.text()
        throw new Error(`API ${res.status}: ${detail}`)
      }

      const data = await res.json()
      simulationIdRef.current = data.simulation_id
      setActiveAgents(data.personas ?? [])

      setSimulationState("war-room")
      setIsDebateStreaming(true)
      debateIndexRef.current = 0
    } catch (err) {
      console.error("Simulation init failed:", err)
      setInitError(
        err instanceof Error ? err.message : "Simulation failed. Please try again."
      )
      setSimulationState("intake")
    }
  }, [])

  // ── Debate message streaming (mock timer — replace with WebSocket) ───────

  useEffect(() => {
    if (simulationState !== "war-room" || !isDebateStreaming) return

    const script = MOCK_DEBATE_SCRIPT
    const index = debateIndexRef.current

    if (index >= script.length) {
      setIsDebateStreaming(false)
      setCurrentTypingAgent(null)
      return
    }

    // TO-DO (BACKEND): Replace with a WebSocket onmessage handler.
    // Each frame: { "agent": "alpha", "content": "...", "turn": N, "timestamp": "..." }
    setCurrentTypingAgent(script[index].agent)

    const delay = 1800 + Math.random() * 2200
    const timer = setTimeout(() => {
      const entry = script[index]
      setDebateTranscript((prev) => [...prev, scriptEntryToMessage(entry, index)])
      debateIndexRef.current = index + 1
    }, delay)

    return () => clearTimeout(timer)
  }, [simulationState, isDebateStreaming, debateTranscript.length])

  // ── Swarm metrics polling (mock — replace with SSE/WS) ──────────────────

  useEffect(() => {
    if (simulationState !== "war-room") return

    // TO-DO (BACKEND): Replace with SSE: new EventSource(`/api/v1/simulation/${simId}/metrics`)
    const interval = setInterval(() => {
      setSwarmMetrics((prev) => {
        const delta = (Math.random() - 0.35) * 3
        return {
          ...prev,
          convergence: Math.min(98, Math.max(45, prev.convergence + delta)),
        }
      })
    }, 1500)

    return () => clearInterval(interval)
  }, [simulationState])

  // ── Transition: war-room → arbiter-verdict ──────────────────────────────

  const terminateSimulation = useCallback(() => {
    // TO-DO (BACKEND): POST /api/v1/simulation/${simulationIdRef.current}/terminate
    // then GET /api/v1/simulation/${simulationIdRef.current}/verdict
    setVerdictData(getMockVerdictData())
    setSimulationState("arbiter-verdict")
    setIsDebateStreaming(false)
    setCurrentTypingAgent(null)
  }, [])

  // ── Transition: arbiter-verdict → intake (full reset) ───────────────────

  const startNewCase = useCallback(() => {
    setSimulationState("intake")
    setDebateTranscript([])
    setIsDebateStreaming(false)
    setCurrentTypingAgent(null)
    debateIndexRef.current = 0
    setSwarmMetrics({ liveNodes: 100, convergence: 64, geoBiasActive: true })
    setVerdictData(null)
    setActiveAgents([])
    setInitError(null)
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
    initializeSimulation,
    terminateSimulation,
    startNewCase,
  }
}
