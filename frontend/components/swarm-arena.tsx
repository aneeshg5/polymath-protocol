// ============================================================================
// SwarmArena — Force-directed graph panel for the War Room
// ============================================================================
// The SVG-based force graph is isolated into <SwarmForceGraph /> so it can be
// easily replaced with a <react-force-graph-2d /> canvas component without
// touching the rest of the arena chrome (metrics overlay, title bar, grid bg).
// ============================================================================

"use client"

import { useEffect, useRef, useState, useMemo, type FC } from "react"
import { motion } from "framer-motion"
import { Activity, Globe, Target } from "lucide-react"
import type { AgentNode, SwarmDot, SwarmMetrics, ActivePersona } from "@/lib/types"

// ── Color palette & node builder ─────────────────────────────────────────────
// Colors cycle through the same palette used by the debate transcript so the
// arena and the chat panel always share the same per-agent colour.

const AGENT_COLOR_PALETTE = [
  "#d97706", // amber
  "#0ea5e9", // sky
  "#10b981", // emerald
  "#a855f7", // purple
  "#f43f5e", // rose
  "#06b6d4", // cyan
]

function personasToAgentNodes(personas: ActivePersona[]): AgentNode[] {
  const n = personas.length
  if (n === 0) return []
  return personas.map((persona, i) => {
    // Distribute agents evenly around a circle. Starting at -π/2 places the
    // first agent at the top rather than the right edge.
    const angle = (2 * Math.PI * i) / n - Math.PI / 2
    return {
      id: persona.id,
      label: persona.label,
      archetype: persona.archetype_name,
      color: AGENT_COLOR_PALETTE[i % AGENT_COLOR_PALETTE.length],
      x: 0.5 + 0.32 * Math.cos(angle),
      y: 0.5 + 0.32 * Math.sin(angle),
    }
  })
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function createSwarmDots(count: number, agentCount: number): SwarmDot[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 0.15 + Math.random() * 0.7,
    y: 0.15 + Math.random() * 0.7,
    targetAgent: Math.floor(Math.random() * Math.max(1, agentCount)),
    speed: 0.3 + Math.random() * 0.7,
    offsetAngle: Math.random() * Math.PI * 2,
    radius: 0.02 + Math.random() * 0.08,
  }))
}

// ── SwarmForceGraph (isolated, swappable) ───────────────────────────────────
// TO-DO (BACKEND): To swap this for `react-force-graph-2d`, create a new
// component that accepts the same props interface and render it in place of
// <SwarmForceGraph /> inside <SwarmArena />. The arena layout, grid bg, and
// metrics overlay will remain untouched.

interface SwarmForceGraphProps {
  /** Normalized agent node definitions (positions 0..1) */
  agents: AgentNode[]
  /** Number of swarm dots to simulate */
  dotCount: number
  /** Pixel dimensions of the rendering area (set by parent ResizeObserver) */
  width: number
  height: number
}

export const SwarmForceGraph: FC<SwarmForceGraphProps> = ({
  agents,
  dotCount,
  width,
  height,
}) => {
  const dotsRef = useRef<SwarmDot[]>(createSwarmDots(dotCount, agents.length))
  const [dotPositions, setDotPositions] = useState<
    { x: number; y: number; targetAgent: number }[]
  >([])
  const animationRef = useRef<number>(0)
  const timeRef = useRef(0)

  // Regenerate dots when count or agent roster changes
  useEffect(() => {
    dotsRef.current = createSwarmDots(dotCount, agents.length)
  }, [dotCount, agents.length])

  // Animation loop
  useEffect(() => {
    const dots = dotsRef.current
    let running = true

    function animate() {
      if (!running) return
      timeRef.current += 0.008
      const t = timeRef.current

      const positions = dots.map((dot) => {
        const agent = agents[dot.targetAgent]
        const wobble = Math.sin(t * dot.speed * 2 + dot.offsetAngle)
        const drift = Math.cos(t * dot.speed * 1.5 + dot.offsetAngle * 0.7)
        const pull = Math.min(t * 0.08, 0.85)

        const x = dot.x + (agent.x - dot.x) * pull + wobble * dot.radius * (1 - pull * 0.6)
        const y = dot.y + (agent.y - dot.y) * pull + drift * dot.radius * (1 - pull * 0.6)

        return { x, y, targetAgent: dot.targetAgent }
      })

      setDotPositions(positions)
      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)
    return () => {
      running = false
      cancelAnimationFrame(animationRef.current)
    }
  }, [agents])

  // Connection lines between agent pairs
  const connectionLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number; color: string }[] = []
    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        lines.push({
          x1: agents[i].x * width,
          y1: agents[i].y * height,
          x2: agents[j].x * width,
          y2: agents[j].y * height,
          color: agents[i].color,
        })
      }
    }
    return lines
  }, [agents, width, height])

  return (
    <svg
      className="absolute inset-0"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      {/* Connection lines between agents */}
      {connectionLines.map((line, i) => (
        <line
          key={`conn-${i}`}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke={line.color}
          strokeOpacity={0.07}
          strokeWidth={1}
          strokeDasharray="4 6"
        />
      ))}

      {/* Swarm dots */}
      {dotPositions.map((dot, i) => (
        <circle
          key={`dot-${i}`}
          cx={dot.x * width}
          cy={dot.y * height}
          r={2}
          fill={agents[dot.targetAgent].color}
          opacity={0.5}
        />
      ))}

      {/* Agent nodes */}
      {agents.map((agent) => (
        <g key={agent.id}>
          <circle
            cx={agent.x * width}
            cy={agent.y * height}
            r={32}
            fill="none"
            stroke={agent.color}
            strokeOpacity={0.15}
            strokeWidth={1}
          />
          <circle
            cx={agent.x * width}
            cy={agent.y * height}
            r={48}
            fill="none"
            stroke={agent.color}
            strokeOpacity={0.06}
            strokeWidth={1}
            strokeDasharray="3 5"
          />
          <circle
            cx={agent.x * width}
            cy={agent.y * height}
            r={20}
            fill={agent.color}
            fillOpacity={0.12}
            stroke={agent.color}
            strokeOpacity={0.5}
            strokeWidth={1.5}
          />
          <text
            x={agent.x * width}
            y={agent.y * height - 28}
            textAnchor="middle"
            fill={agent.color}
            fontSize={11}
            fontWeight={600}
            fontFamily="var(--font-sans)"
          >
            {agent.label}
          </text>
          <text
            x={agent.x * width}
            y={agent.y * height + 4}
            textAnchor="middle"
            fill={agent.color}
            fontSize={9}
            fontFamily="var(--font-mono)"
            opacity={0.7}
          >
            {agent.archetype.length > 18
              ? agent.archetype.substring(0, 16) + "..."
              : agent.archetype}
          </text>
        </g>
      ))}
    </svg>
  )
}

// ── SwarmArena (chrome + metrics wrapper) ───────────────────────────────────

interface SwarmArenaProps {
  /** Real-time metrics fed from the useSimulation hook */
  metrics: SwarmMetrics
  /** Live personas from the backend — used to build dynamic agent nodes */
  activeAgents: ActivePersona[]
}

export function SwarmArena({ metrics, activeAgents }: SwarmArenaProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 })

  // Recompute node positions whenever the persona list changes
  const agentNodes = useMemo(() => personasToAgentNodes(activeAgents), [activeAgents])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) setDimensions({ width, height })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden rounded-xl border border-border/60 bg-surface"
    >
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(to right, oklch(0.93 0.005 260) 1px, transparent 1px),
            linear-gradient(to bottom, oklch(0.93 0.005 260) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Force graph — swap this component for react-force-graph-2d later */}
      <SwarmForceGraph
        agents={agentNodes}
        dotCount={metrics.liveNodes}
        width={dimensions.width}
        height={dimensions.height}
      />

      {/* Metrics overlay */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="absolute left-3 top-3 flex flex-col gap-1.5 rounded-lg border border-border/60 bg-background/90 px-3 py-2.5 backdrop-blur-sm"
      >
        <div className="flex items-center gap-2">
          <Target className="size-3 text-gold" />
          <span className="font-mono text-[10px] text-muted-foreground">
            {"Live Nodes: "}
            <span className="text-foreground">{metrics.liveNodes}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Activity className="size-3 text-emerald-500" />
          <span className="font-mono text-[10px] text-muted-foreground">
            {"Convergence: "}
            <span className="text-foreground">{metrics.convergence.toFixed(1)}%</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Globe className="size-3 text-sky-500" />
          <span className="font-mono text-[10px] text-muted-foreground">
            {"Geo Bias: "}
            <span className="text-amber-400">
              {metrics.geoBiasActive ? "Active" : "Inactive"}
            </span>
          </span>
        </div>
      </motion.div>

      {/* Arena title */}
      <div className="absolute bottom-3 left-3 rounded-md bg-background/80 px-2.5 py-1 backdrop-blur-sm">
        <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Adversarial Swarm Arena
        </span>
      </div>
    </div>
  )
}
