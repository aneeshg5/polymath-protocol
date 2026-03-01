// ============================================================================
// Root Page — Judicial Streamlining Tool
// ============================================================================
// This page is a thin shell. All simulation state lives in the useSimulation
// hook. Child components are purely presentational and receive data via props.
// ============================================================================

"use client"

import { AlertCircle, RotateCcw } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { IntakeForm } from "@/components/intake-form"
import { LoadingState } from "@/components/loading-state"
import { WarRoom } from "@/components/war-room"
import { ArbiterVerdict } from "@/components/arbiter-verdict"
import { Button } from "@/components/ui/button"
import { useSimulation } from "@/hooks/use-simulation"

// 3 debate rounds × number of active agents; matches backend DEBATE_ROUNDS constant
const DEBATE_ROUNDS = 3

export default function Page() {
  const {
    simulationState,
    debateTranscript,
    isDebateStreaming,
    currentTypingAgent,
    liveConsensus,
    swarmMetrics,
    verdictData,
    activeAgents,
    geographicBiases,
    initializeSimulation,
    terminateSimulation,
    startNewCase,
    initError,
    verdictStep,
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
            activeAgents={activeAgents}
            geographicBiases={geographicBiases}
            liveConsensus={liveConsensus}
            verdictStep={verdictStep}
            onTerminate={terminateSimulation}
          />
        )}

        {simulationState === "arbiter-verdict" && verdictData && (
          <ArbiterVerdict data={verdictData} onNewCase={startNewCase} activeAgents={activeAgents} />
        )}

        {/* Arbiter API failed: verdictData is null but we're on the verdict screen.
            Show a recoverable error card so the user is never left on a blank screen. */}
        {simulationState === "arbiter-verdict" && !verdictData && (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-xl border border-destructive/40 bg-destructive/10 px-8 py-10 text-center">
              <AlertCircle className="size-10 text-destructive" />
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-semibold text-foreground">
                  Arbiter failed to generate a verdict
                </p>
                <p className="text-xs text-muted-foreground">
                  {initError ?? "An unexpected error occurred while calling the Arbiter Agent."}
                </p>
              </div>
              <Button
                onClick={startNewCase}
                className="gap-2 border border-gold/30 bg-gold/10 text-gold hover:bg-gold/20"
              >
                <RotateCcw className="size-4" />
                Start New Case
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
