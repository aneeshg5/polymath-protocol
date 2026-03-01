// ============================================================================
// SwarmArena — Force-directed graph panel for the War Room
// ============================================================================
// The SVG-based force graph is isolated into <SwarmForceGraph /> so it can be
// easily replaced with a <react-force-graph-2d /> canvas component without
// touching the rest of the arena chrome (metrics overlay, title bar, grid bg).
// ============================================================================

"use client"

import { useEffect, useRef, useState, useMemo, type FC } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Activity, Globe, Target } from "lucide-react"
import type { AgentNode, SwarmDot, SwarmMetrics, ActivePersona, LiveConsensusUpdate } from "@/lib/types"

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

// Per-dot physics constants
const LERP_ACCEL  = 0.0012  // slower build — dots feel heavy, not snappy
const MAX_PULL    = 0.030   // looser max speed → wider, cloud-like orbits

/**
 * Spawn the swarm in a fully Undecided state (every dot targets the center).
 *
 * All dots start at `targetAgent: null` and orbit `(0.5, 0.5)` until the first
 * agent begins speaking, at which point they gradually break away one by one.
 *
 * Geographic bias is encoded purely through stubbornness — once a dot commits
 * to an agent it is hard (or impossible for the top ~20-36%) to pull it away.
 * A high-opinion jurisdiction (e.g. Texas, |bias_weight| ≈ 0.8) produces more
 * locked-in dots than a low-opinion mixed panel, so the final distribution resists
 * redistribution even as new speakers take the floor.
 *
 * lean          − reserved for future directional bias (which side dots prefer
 *                 when first breaking away from center). Currently unused.
 * opinionStrength − mean absolute bias_weight (0..1); raises the stubbornness floor.
 */
function createSwarmDots(
  count: number,
  _agentCount: number,
  _lean: number = 0,
  opinionStrength: number = 0,
): SwarmDot[] {
  return Array.from({ length: count }, (_, i) => {
    // sqrt-transform when opinionStrength≈1 raises P(stubborn > 0.8) from ~20% → ~36%.
    const rawStub = Math.random()
    const stubbornness = Math.pow(rawStub, 1 - opinionStrength * 0.5)

    return {
      id: i,
      // Spawn near center so the initial pool looks intentionally gathered
      x: 0.4 + Math.random() * 0.2,
      y: 0.4 + Math.random() * 0.2,
      targetAgent: null,   // Undecided until first speaker
      speed: 0.3 + Math.random() * 0.7,
      offsetAngle: Math.random() * Math.PI * 2,
      radius: 0.05 + Math.random() * 0.14,
      pull: 0,
      stubbornness,
    }
  })
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
  /** Live Arbiter snapshot — drives proximity-based dot recruitment after each turn */
  liveConsensus: LiveConsensusUpdate | null
  /** Called when the pointer enters or leaves an agent node */
  onAgentHover: (idx: number | null, pixelX: number, pixelY: number) => void
  /** Aggregate lean of the jurisdiction's bias_weights (-1..+1); seeds initial dot distribution */
  lean: number
  /** Mean absolute bias_weight (0..1); high values increase dot stubbornness */
  opinionStrength: number
}

export const SwarmForceGraph: FC<SwarmForceGraphProps> = ({
  agents,
  dotCount,
  width,
  height,
  liveConsensus,
  onAgentHover,
  lean,
  opinionStrength,
}) => {
  const dotsRef = useRef<SwarmDot[]>(createSwarmDots(dotCount, agents.length, lean, opinionStrength))
  const [dotPositions, setDotPositions] = useState<
    { x: number; y: number; targetAgent: number | null }[]
  >([])
  const animationRef = useRef<number>(0)
  const timeRef = useRef(0)

  // When the live Arbiter pushes a new snapshot, recruit exactly the right
  // number of dots to the current speaker — picking the dots that are
  // physically closest to the speaker's node so migration looks immediate
  // and physically motivated rather than random.
  useEffect(() => {
    if (!liveConsensus) return
    const { distribution, speakerId } = liveConsensus
    const dots = dotsRef.current

    const speakerIdx = agents.findIndex((a) => a.id === speakerId)
    if (speakerIdx === -1) return

    const speakerNode = agents[speakerIdx]
    const newSpeakerCount = distribution[speakerId] ?? 0

    // Count how many dots are currently already committed to the speaker.
    const currentSpeakerCount = dots.filter((d) => d.targetAgent === speakerIdx).length
    const toRecruit = newSpeakerCount - currentSpeakerCount

    if (toRecruit <= 0) return

    // Pool of available dots: everything NOT already heading to the speaker.
    // Sort ascending by squared Euclidean distance to the speaker's node —
    // the closest dots are the most "persuadable" and move first.
    const available = dots
      .filter((d) => d.targetAgent !== speakerIdx)
      .sort((a, b) => {
        const da = (a.x - speakerNode.x) ** 2 + (a.y - speakerNode.y) ** 2
        const db = (b.x - speakerNode.x) ** 2 + (b.y - speakerNode.y) ** 2
        return da - db
      })

    for (let i = 0; i < Math.min(toRecruit, available.length); i++) {
      available[i].targetAgent = speakerIdx
      available[i].pull = 0
    }
  }, [liveConsensus, agents])

  // Regenerate dots when count or agent roster changes.
  // lean/opinionStrength are stable after /init so including them is safe.
  useEffect(() => {
    dotsRef.current = createSwarmDots(dotCount, agents.length, lean, opinionStrength)
  }, [dotCount, agents.length, lean, opinionStrength])

  // Animation loop — dots maintain their own position (dot.x/y updated in place).
  // When a dot retargets, its pull resets to 0 so it accelerates smoothly from rest.
  useEffect(() => {
    const dots = dotsRef.current
    let running = true

    function animate() {
      if (!running) return
      timeRef.current += 0.008
      const t = timeRef.current

      const positions = dots.map((dot) => {
        if (dot.targetAgent === null) {
          // ── UNDECIDED: tight central cluster, slow drift ──────────────────
          // Small radius + low speed multipliers keep this group compact and
          // countable — like jurors sitting still, waiting to be convinced.
          const undecidedRadius = 0.03 + dot.radius * 0.15
          const wobble = Math.sin(t * dot.speed * 0.5 + dot.offsetAngle) * undecidedRadius
          const drift  = Math.cos(t * dot.speed * 0.4 + dot.offsetAngle * 0.7) * undecidedRadius
          const targetX = 0.5 + wobble
          const targetY = 0.5 + drift
          dot.pull = Math.min(dot.pull + LERP_ACCEL, MAX_PULL)
          dot.x += (targetX - dot.x) * dot.pull
          dot.y += (targetY - dot.y) * dot.pull
          return { x: dot.x, y: dot.y, targetAgent: null }
        }

        // ── COMMITTED: orbit an agent node ───────────────────────────────
        const agent = agents[dot.targetAgent]
        if (!agent) return { x: dot.x, y: dot.y, targetAgent: dot.targetAgent }

        const wobble = Math.sin(t * dot.speed * 2 + dot.offsetAngle) * dot.radius
        const drift  = Math.cos(t * dot.speed * 1.5 + dot.offsetAngle * 0.7) * dot.radius
        const targetX = agent.x + wobble
        const targetY = agent.y + drift

        dot.pull = Math.min(dot.pull + LERP_ACCEL, MAX_PULL)
        dot.x += (targetX - dot.x) * dot.pull
        dot.y += (targetY - dot.y) * dot.pull

        return { x: dot.x, y: dot.y, targetAgent: dot.targetAgent }
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

      {/* Swarm dots — undecided dots render as muted grey; committed dots adopt their agent's colour */}
      {dotPositions.map((dot, i) => (
        <circle
          key={`dot-${i}`}
          cx={dot.x * width}
          cy={dot.y * height}
          r={2}
          fill={dot.targetAgent !== null ? (agents[dot.targetAgent]?.color ?? "#6b7280") : "#6b7280"}
          opacity={dot.targetAgent !== null ? 0.5 : 0.22}
        />
      ))}

      {/* Agent nodes */}
      {agents.map((agent, i) => {
        const cx = agent.x * width
        const cy = agent.y * height
        return (
          <g
            key={agent.id}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => onAgentHover(i, cx, cy)}
            onMouseLeave={() => onAgentHover(null, 0, 0)}
          >
            {/* Invisible wide hit area so small cursors still trigger the hover */}
            <circle cx={cx} cy={cy} r={52} fill="transparent" />
            <circle cx={cx} cy={cy} r={32} fill="none" stroke={agent.color} strokeOpacity={0.15} strokeWidth={1} />
            <circle cx={cx} cy={cy} r={48} fill="none" stroke={agent.color} strokeOpacity={0.06} strokeWidth={1} strokeDasharray="3 5" />
            <circle cx={cx} cy={cy} r={20} fill={agent.color} fillOpacity={0.12} stroke={agent.color} strokeOpacity={0.5} strokeWidth={1.5} />
            <text x={cx} y={cy - 28} textAnchor="middle" fill={agent.color} fontSize={11} fontWeight={600} fontFamily="var(--font-sans)">
              {agent.label}
            </text>
            <text x={cx} y={cy + 4} textAnchor="middle" fill={agent.color} fontSize={9} fontFamily="var(--font-mono)" opacity={0.7}>
              {agent.archetype.length > 18 ? agent.archetype.substring(0, 16) + "…" : agent.archetype}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── SwarmArena (chrome + metrics wrapper) ───────────────────────────────────

interface SwarmArenaProps {
  /** Real-time metrics fed from the useSimulation hook */
  metrics: SwarmMetrics
  /** Live personas from the backend — used to build dynamic agent nodes */
  activeAgents: ActivePersona[]
  /** Geographic bias objects from /init — used to seed the swarm's initial distribution */
  geographicBiases: Record<string, unknown>[]
  /** Live Arbiter snapshot — forwarded to SwarmForceGraph for proximity-based dot recruitment */
  liveConsensus: LiveConsensusUpdate | null
}

// Extract the first sentence from a system prompt for the tooltip summary.
function firstSentence(text: string): string {
  const match = text.match(/^[^.!?]+[.!?]/)
  return match ? match[0] : text.slice(0, 120) + "…"
}

const TOOLTIP_W = 224 // px — used for smart left/right placement

export function SwarmArena({ metrics, activeAgents, geographicBiases, liveConsensus }: SwarmArenaProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 })

  // Recompute node positions whenever the persona list changes
  const agentNodes = useMemo(() => personasToAgentNodes(activeAgents), [activeAgents])

  // Distil the geographic biases into two scalar physics seeds so SwarmForceGraph
  // can initialise dots with jurisdiction-aware distribution and stubbornness.
  const { lean, opinionStrength } = useMemo(() => {
    if (!geographicBiases.length) return { lean: 0, opinionStrength: 0 }
    const weights = geographicBiases.map((b) =>
      typeof b.bias_weight === "number" ? (b.bias_weight as number) : 0
    )
    const meanLean = weights.reduce((s, w) => s + w, 0) / weights.length
    const meanStrength = weights.reduce((s, w) => s + Math.abs(w), 0) / weights.length
    // Clamp to valid range in case of unexpected API values
    return {
      lean: Math.max(-1, Math.min(1, meanLean)),
      opinionStrength: Math.max(0, Math.min(1, meanStrength)),
    }
  }, [geographicBiases])

  // Hover state: index into activeAgents/agentNodes + pixel anchor in container coords
  const [hovered, setHovered] = useState<{ idx: number; x: number; y: number } | null>(null)

  const handleAgentHover = (idx: number | null, x: number, y: number) => {
    setHovered(idx === null ? null : { idx, x, y })
  }

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

  // Compute tooltip position so it never clips the container edge.
  const tooltipStyle = useMemo(() => {
    if (!hovered) return {}
    const TOOLTIP_H = 96
    const offset = 18
    const left =
      hovered.x + TOOLTIP_W + offset > dimensions.width
        ? hovered.x - TOOLTIP_W - offset
        : hovered.x + offset
    const top = Math.max(
      8,
      Math.min(hovered.y - TOOLTIP_H / 2, dimensions.height - TOOLTIP_H - 8)
    )
    return { left, top }
  }, [hovered, dimensions])

  const hoveredPersona = hovered !== null ? activeAgents[hovered.idx] : null
  const hoveredNode    = hovered !== null ? agentNodes[hovered.idx]    : null

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
        liveConsensus={liveConsensus}
        onAgentHover={handleAgentHover}
        lean={lean}
        opinionStrength={opinionStrength}
      />

      {/* Agent hover tooltip */}
      <AnimatePresence>
        {hoveredPersona && hoveredNode && (
          <motion.div
            key={hoveredPersona.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={{ ...tooltipStyle, width: TOOLTIP_W, borderColor: hoveredNode.color + "55" }}
            className="pointer-events-none absolute z-20 rounded-lg border bg-background/95 px-3 py-2.5 shadow-lg backdrop-blur-sm"
          >
            <p className="text-[11px] font-semibold" style={{ color: hoveredNode.color }}>
              {hoveredPersona.label}
            </p>
            <p className="font-mono text-[9px] text-muted-foreground">
              {hoveredPersona.archetype_name}
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-foreground/80">
              {firstSentence(hoveredPersona.system_prompt)}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

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
