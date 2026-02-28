// ============================================================================
// DebateTelemetry — Live debate transcript panel
// ============================================================================
// This component is now purely presentational. All state (transcript, typing
// indicator) is owned by the useSimulation hook and passed in via props.
// ============================================================================

"use client"

import { useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { OctagonX } from "lucide-react"
import type { DebateMessage, AgentKey } from "@/lib/types"
import { AGENT_DEBATE_STYLES, MOCK_DEBATE_SCRIPT } from "@/lib/mock-data"

// ── Props ───────────────────────────────────────────────────────────────────

interface DebateTelemetryProps {
  /** Ordered debate messages to render */
  messages: DebateMessage[]
  /** Whether a new message is being streamed/generated */
  isStreaming: boolean
  /** The agent currently "typing", if any */
  typingAgent: AgentKey | null
  /** Total expected message count (for the progress badge) */
  totalExchanges: number
  /** Called when the user clicks "Terminate Simulation" */
  onTerminate: () => void
}

// ── Component ───────────────────────────────────────────────────────────────

export function DebateTelemetry({
  messages,
  isStreaming,
  typingAgent,
  totalExchanges,
  onTerminate,
}: DebateTelemetryProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  // Resolve typing agent styles
  const typingStyle = typingAgent ? AGENT_DEBATE_STYLES[typingAgent] : null

  return (
    <div className="flex w-full flex-col border-l border-border/60 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="size-2 animate-pulse rounded-full bg-emerald-500" />
          <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
            Live Debate Telemetry
          </span>
        </div>
        <Badge
          variant="outline"
          className="border-border/60 font-mono text-[10px] text-muted-foreground"
        >
          {messages.length}/{totalExchanges} exchanges
        </Badge>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-1 p-3">
          <AnimatePresence>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`rounded-lg border px-3 py-2.5 ${msg.bgClass}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-semibold ${msg.textColorClass}`}>
                    {msg.agent}
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground">
                    {msg.timestamp}
                  </span>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-foreground/85">
                  {msg.content}
                </p>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {isStreaming && typingStyle && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 px-3 py-2"
            >
              <div className="flex gap-0.5">
                <span
                  className={`inline-block size-1.5 animate-bounce rounded-full ${typingStyle.textColorClass.replace("text-", "bg-")} opacity-60`}
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className={`inline-block size-1.5 animate-bounce rounded-full ${typingStyle.textColorClass.replace("text-", "bg-")} opacity-60`}
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className={`inline-block size-1.5 animate-bounce rounded-full ${typingStyle.textColorClass.replace("text-", "bg-")} opacity-60`}
                  style={{ animationDelay: "300ms" }}
                />
              </div>
              <span className={`text-[10px] ${typingStyle.textColorClass} opacity-70`}>
                {typingStyle.label} is deliberating...
              </span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Terminate button */}
      <div className="border-t border-border/60 p-3">
        <Button
          onClick={onTerminate}
          className="w-full gap-2 border border-red-800/40 bg-red-950/50 text-red-400 transition-colors hover:bg-red-900/60 hover:text-red-300"
          variant="ghost"
        >
          <OctagonX className="size-4" />
          {"Terminate Simulation & Generate Verdict"}
        </Button>
      </div>
    </div>
  )
}
