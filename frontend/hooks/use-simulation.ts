// ============================================================================
// useSimulation — Central simulation lifecycle hook
// ============================================================================
// This hook owns all simulation state and exposes it to the page and child
// components. Every piece of mock data is loaded through clearly-marked
// integration points so a backend engineer can swap in real API calls.
// ============================================================================

import { useState, useCallback, useEffect, useRef } from "react"
import type {
  SimulationState,
  DebateMessage,
  DebateScriptEntry,
  SwarmMetrics,
  VerdictData,
  AgentKey,
} from "@/lib/types"
import {
  AGENT_DEBATE_STYLES,
  MOCK_DEBATE_SCRIPT,
  getMockVerdictData,
} from "@/lib/mock-data"

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

  /** Transition: intake → loading (kicks off case file parsing) */
  initializeSimulation: () => void

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

  // ── Transition: intake → loading → war-room ─────────────────────────────

  const initializeSimulation = useCallback(() => {
    setSimulationState("loading")

    // TO-DO (BACKEND): Replace the 2-second timeout with an actual API call:
    //   const res = await fetch("/api/v1/simulation/init", {
    //     method: "POST",
    //     body: formData,  // case files + jurisdiction + depth
    //   })
    //   const { simulationId, agents } = await res.json()
    // On success, transition to "war-room" and open the WebSocket:
    //   const ws = new WebSocket(`ws://<host>/api/v1/simulation/${simulationId}/debate`)
    //   ws.onmessage = (event) => { ... append to debateTranscript ... }

    const timer = setTimeout(() => {
      setSimulationState("war-room")
      setIsDebateStreaming(true)
      debateIndexRef.current = 0
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  // ── Debate message streaming (mock timer → replace with WebSocket) ──────

  useEffect(() => {
    if (simulationState !== "war-room" || !isDebateStreaming) return

    const script = MOCK_DEBATE_SCRIPT
    const index = debateIndexRef.current

    if (index >= script.length) {
      setIsDebateStreaming(false)
      setCurrentTypingAgent(null)
      return
    }

    // Show which agent is currently "typing"
    setCurrentTypingAgent(script[index].agent)

    // TO-DO (BACKEND): In production this entire block is replaced by a
    // WebSocket `onmessage` handler. Each incoming frame is a JSON object:
    //   { "agent": "alpha", "content": "...", "turn": N, "timestamp": "..." }
    // Append each frame:
    //   setDebateTranscript(prev => [...prev, frameToMessage(frame)])
    // The `isDebateStreaming` flag should be set to false when the server
    // sends a frame with `"type": "debate_complete"`.

    const delay = 1800 + Math.random() * 2200
    const timer = setTimeout(() => {
      const entry = script[index]
      setDebateTranscript((prev) => [...prev, scriptEntryToMessage(entry, index)])
      debateIndexRef.current = index + 1
    }, delay)

    return () => clearTimeout(timer)
  }, [simulationState, isDebateStreaming, debateTranscript.length])

  // ── Swarm metrics polling (mock → replace with SSE/WS) ─────────────────

  useEffect(() => {
    if (simulationState !== "war-room") return

    // TO-DO (BACKEND): Replace with an SSE stream or periodic fetch:
    //   const evtSource = new EventSource(`/api/v1/simulation/${simId}/metrics`)
    //   evtSource.onmessage = (e) => setSwarmMetrics(JSON.parse(e.data))
    // Or poll: fetch(`/api/v1/simulation/${simId}/metrics`) every 2s

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
    // TO-DO (BACKEND): Send a termination request and fetch the verdict:
    //   await fetch(`/api/v1/simulation/${simId}/terminate`, { method: "POST" })
    //   const verdict = await fetch(`/api/v1/simulation/${simId}/verdict`).then(r => r.json())
    //   setVerdictData(verdict)
    // The VerdictData interface matches the Pydantic model returned by the
    // Arbiter LLM endpoint on the FastAPI server.

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
  }, [])

  return {
    simulationState,
    debateTranscript,
    isDebateStreaming,
    currentTypingAgent,
    swarmMetrics,
    verdictData,
    initializeSimulation,
    terminateSimulation,
    startNewCase,
  }
}
