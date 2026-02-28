// ============================================================================
// Root Page — Judicial Streamlining Tool
// ============================================================================
// This page is a thin shell. All simulation state lives in the useSimulation
// hook. Child components are purely presentational and receive data via props.
// ============================================================================

"use client"

import { Navbar } from "@/components/navbar"
import { IntakeForm } from "@/components/intake-form"
import { LoadingState } from "@/components/loading-state"
import { WarRoom } from "@/components/war-room"
import { ArbiterVerdict } from "@/components/arbiter-verdict"
import { useSimulation } from "@/hooks/use-simulation"

// 3 debate rounds × number of active agents; matches backend DEBATE_ROUNDS constant
const DEBATE_ROUNDS = 3

export default function Page() {
  const {
    simulationState,
    debateTranscript,
    isDebateStreaming,
    currentTypingAgent,
    swarmMetrics,
    verdictData,
    activeAgents,
    initializeSimulation,
    terminateSimulation,
    startNewCase,
    initError,
  } = useSimulation()

  return (
    <div className="flex h-screen flex-col bg-background">
      <Navbar simulationState={simulationState} />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {simulationState === "intake" && (
          <IntakeForm onInitialize={initializeSimulation} initError={initError} />
        )}

        {simulationState === "loading" && <LoadingState />}

        {simulationState === "war-room" && (
          <WarRoom
            messages={debateTranscript}
            isStreaming={isDebateStreaming}
            typingAgent={currentTypingAgent}
            totalExchanges={activeAgents.length * DEBATE_ROUNDS}
            swarmMetrics={swarmMetrics}
            onTerminate={terminateSimulation}
          />
        )}

        {simulationState === "arbiter-verdict" && verdictData && (
          <ArbiterVerdict data={verdictData} onNewCase={startNewCase} />
        )}
      </main>
    </div>
  )
}
