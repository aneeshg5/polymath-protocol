// ============================================================================
// WarRoom — 2-column layout composing SwarmArena + DebateTelemetry
// ============================================================================

"use client"

import { SwarmArena } from "@/components/swarm-arena"
import { DebateTelemetry } from "@/components/debate-telemetry"
import type { DebateMessage, SwarmMetrics, ActivePersona } from "@/lib/types"

interface WarRoomProps {
  /** Debate messages rendered in the transcript */
  messages: DebateMessage[]
  /** Whether a message is currently streaming */
  isStreaming: boolean
  /** ID of the agent currently typing (if any) */
  typingAgent: string | null
  /** Total expected debate exchanges */
  totalExchanges: number
  /** Real-time swarm metrics */
  swarmMetrics: SwarmMetrics
  /** Live personas — forwarded to SwarmArena for dynamic node layout */
  activeAgents: ActivePersona[]
  /** Terminate button handler */
  onTerminate: () => void
}

export function WarRoom({
  messages,
  isStreaming,
  typingAgent,
  totalExchanges,
  swarmMetrics,
  activeAgents,
  onTerminate,
}: WarRoomProps) {
  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Column 1: Adversarial Swarm Arena - 60% */}
      <div className="flex w-[60%] flex-col p-3 pr-0">
        <SwarmArena metrics={swarmMetrics} activeAgents={activeAgents} />
      </div>

      {/* Column 2: Live Debate Telemetry - 40% */}
      <div className="flex w-[40%] overflow-hidden">
        <DebateTelemetry
          messages={messages}
          isStreaming={isStreaming}
          typingAgent={typingAgent}
          totalExchanges={totalExchanges}
          onTerminate={onTerminate}
        />
      </div>
    </div>
  )
}
