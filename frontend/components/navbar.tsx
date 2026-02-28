"use client"

import { Scale, Settings, Circle } from "lucide-react"
import { Button } from "@/components/ui/button"

type SimulationState = "intake" | "loading" | "war-room" | "arbiter-verdict"

const statusConfig: Record<SimulationState, { label: string; color: string; pulse: boolean }> = {
  intake: { label: "Idle", color: "bg-muted-foreground", pulse: false },
  loading: { label: "Processing", color: "bg-gold", pulse: true },
  "war-room": { label: "Active", color: "bg-emerald-500", pulse: true },
  "arbiter-verdict": { label: "Verdict", color: "bg-gold", pulse: false },
}

export function Navbar({ simulationState }: { simulationState: SimulationState }) {
  const status = statusConfig[simulationState]

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border/60 bg-background/80 px-6 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-lg bg-gold/10 text-gold">
          <Scale className="size-4" />
        </div>
        <h1 className="text-sm font-semibold tracking-wide text-foreground">
          Judicial Streamlining Tool
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 rounded-full border border-border/60 bg-secondary/50 px-3 py-1.5">
          <span className="relative flex size-2">
            {status.pulse && (
              <span className={`absolute inline-flex size-full animate-ping rounded-full ${status.color} opacity-50`} />
            )}
            <Circle className={`relative inline-flex size-2 fill-current ${status.color === "bg-muted-foreground" ? "text-muted-foreground" : status.color === "bg-gold" ? "text-gold" : status.color === "bg-emerald-500" ? "text-emerald-500" : "text-gold"}`} />
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {status.label}
          </span>
        </div>

        <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground">
          <Settings className="size-4" />
          <span className="sr-only">Settings</span>
        </Button>
      </div>
    </header>
  )
}
