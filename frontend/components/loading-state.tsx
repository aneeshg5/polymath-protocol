"use client"

import { Scale } from "lucide-react"

export function LoadingState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6">
      {/* Animated logo container */}
      <div className="relative">
        {/* Outer ring */}
        <div className="absolute inset-0 -m-4 rounded-full border border-gold/20 animate-spin-slow" />
        <div className="absolute inset-0 -m-8 rounded-full border border-dashed border-gold/10 animate-spin-slow [animation-direction:reverse] [animation-duration:5s]" />

        <div className="relative flex size-20 items-center justify-center rounded-2xl bg-gold/10 animate-pulse-gold">
          <Scale className="size-8 text-gold" />
        </div>
      </div>

      {/* Text content */}
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Initializing Simulation
        </h2>

        {/* Shimmer text */}
        <p className="text-sm font-medium text-muted-foreground">
          Parsing Case Files and Instantiating LLM Archetypes...
        </p>

        {/* Progress bar */}
        <div className="mt-2 h-1 w-64 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold-dim via-gold to-gold-dim animate-shimmer"
          />
        </div>

        {/* Status steps */}
        <div className="mt-4 flex flex-col gap-2">
          {[
            "Extracting document embeddings",
            "Loading jurisdictional profiles",
            "Calibrating deliberation agents",
          ].map((step, i) => (
            <div
              key={step}
              className="flex items-center gap-2 text-xs text-muted-foreground"
              style={{ animationDelay: `${i * 400}ms` }}
            >
              <span className="inline-block size-1 rounded-full bg-gold/60 animate-pulse" />
              {step}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
