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
import { OctagonX, Loader2 } from "lucide-react"
import type { DebateMessage } from "@/lib/types"

// ── Props ───────────────────────────────────────────────────────────────────

interface DebateTelemetryProps {
  /** Ordered debate messages to render */
  messages: DebateMessage[]
  /** Whether a new message is being streamed/generated */
  isStreaming: boolean
  /** ID of the agent currently "typing", if any */
  typingAgent: string | null
  /** Total expected message count (for the progress badge) */
  totalExchanges: number
  /** Current arbiter generation step; null when idle */
  verdictStep: string | null
  /** Called when the user clicks "Terminate Simulation" */
  onTerminate: () => void
}

// ── Component ───────────────────────────────────────────────────────────────

export function DebateTelemetry({
  messages,
  isStreaming,
  typingAgent,
  totalExchanges,
  verdictStep,
  onTerminate,
}: DebateTelemetryProps) {
  const isTerminating = verdictStep !== null
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  // Derive the typing indicator style from the most recent message — this works
  // for any agent ID, not just the four hardcoded mock keys.
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null
  const typingStyle =
    isStreaming && typingAgent && lastMessage
      ? {
          label: lastMessage.agent,
          bgClass: lastMessage.bgClass,
          textColorClass: lastMessage.textColorClass,
        }
      : null

  return (
    <div className="flex h-full w-full flex-col border-l border-border/60 bg-background">
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
      <div className="border-t border-border/60 p-3 space-y-2">
        <Button
          onClick={onTerminate}
          disabled={isTerminating}
          className="w-full gap-2 border border-red-800/40 bg-red-950/50 text-red-400 transition-colors hover:bg-red-900/60 hover:text-red-300 disabled:cursor-wait disabled:opacity-80"
          variant="ghost"
        >
          {isTerminating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <OctagonX className="size-4" />
          )}
          {isTerminating ? "Generating Verdict..." : "Terminate Simulation & Generate Verdict"}
        </Button>

        {/* Animated step label — fades each label in/out as the step changes */}
        <AnimatePresence mode="wait">
          {verdictStep && (
            <motion.div
              key={verdictStep}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-center gap-2"
            >
              <div className="flex gap-0.5">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="inline-block size-1 animate-bounce rounded-full bg-gold opacity-60"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">
                {verdictStep}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
