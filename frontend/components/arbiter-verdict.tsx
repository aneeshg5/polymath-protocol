// ============================================================================
// ArbiterVerdict — Final synthesis report screen
// ============================================================================
// This component is now purely presentational. All data is received via the
// `data` prop (VerdictData) which is populated by the useSimulation hook.
// TO-DO (BACKEND): The VerdictData object will come from:
//   POST /api/v1/simulation/{sim_id}/verdict
// The response JSON matches the VerdictData TypeScript interface / the
// corresponding Pydantic model on the FastAPI server.
// ============================================================================

"use client"

import { motion } from "framer-motion"
import {
  Scale,
  Clock,
  MapPin,
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  Users,
  Brain,
  Gavel,
} from "lucide-react"
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { VerdictData } from "@/lib/types"
import { SEVERITY_COLORS } from "@/lib/types"

// ── Props ───────────────────────────────────────────────────────────────────

interface ArbiterVerdictProps {
  /** Complete verdict payload (from backend or mock) */
  data: VerdictData
  /** Called when the user clicks "Start New Case" */
  onNewCase: () => void
}

// ── Framer Motion variants ──────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
}

// ── Component ───────────────────────────────────────────────────────────────

export function ArbiterVerdict({ data, onNewCase }: ArbiterVerdictProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-1 flex-col overflow-y-auto"
    >
      {/* ── HEADER ── */}
      <motion.div variants={itemVariants} className="border-b border-border/60 bg-surface px-6 py-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gold/10">
              <Gavel className="size-5 text-gold" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                Simulation Concluded. Arbiter Synthesis Complete.
              </h1>
              <p className="text-xs text-muted-foreground">
                Multi-agent adversarial deliberation terminated. Report generated for judicial review.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="size-3 text-gold-dim" />
              {data.timestamp}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3 text-gold-dim" />
              {data.jurisdiction}
            </span>
            <Badge variant="outline" className="border-gold/30 font-mono text-[10px] text-gold">
              {data.simulationId}
            </Badge>
            <Badge variant="outline" className="border-emerald-500/30 font-mono text-[10px] text-emerald-400">
              {"DEPTH: "}{data.depthLabel}
            </Badge>
          </div>
        </div>
      </motion.div>

      {/* ── MAIN GRID ── */}
      <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">

          {/* ── Doughnut Chart ── */}
          <motion.div variants={itemVariants} className="lg:col-span-5">
            <Card className="h-full border-border/60 bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-gold" />
                  <CardTitle className="text-sm font-semibold text-foreground">
                    Final Swarm Consensus
                  </CardTitle>
                </div>
                <p className="text-xs text-muted-foreground">
                  Distribution of {data.consensus.reduce((a, c) => a + c.value, 0)} demographic jury nodes at simulation termination
                </p>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{ value: { label: "Nodes" } }}
                  className="mx-auto aspect-square h-[220px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Pie
                        data={data.consensus}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        strokeWidth={2}
                        stroke="oklch(0.14 0.005 260)"
                      >
                        {data.consensus.map((entry, i) => (
                          <Cell key={`cell-${i}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
                {/* Legend */}
                <div className="mt-3 flex flex-col gap-1.5">
                  {data.consensus.map((entry) => (
                    <div key={entry.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2">
                        <span className="size-2 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-muted-foreground">{entry.name}</span>
                      </span>
                      <span className="font-mono text-foreground">{entry.value}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* ── Horizontal Bar Chart ── */}
          <motion.div variants={itemVariants} className="lg:col-span-7">
            <Card className="h-full border-border/60 bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-4 text-gold" />
                  <CardTitle className="text-sm font-semibold text-foreground">
                    Node Distribution by Archetype
                  </CardTitle>
                </div>
                <p className="text-xs text-muted-foreground">
                  Horizontal bar breakdown of final jury swarm allocation
                </p>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{ nodes: { label: "Nodes", color: "#0ea5e9" } }}
                  className="h-[280px] w-full"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.barData}
                      layout="vertical"
                      margin={{ top: 0, right: 24, left: 4, bottom: 0 }}
                    >
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="oklch(0.25 0.008 260)" />
                      <XAxis type="number" domain={[0, 50]} tick={{ fill: "#737373", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis dataKey="agent" type="category" tick={{ fill: "#a3a3a3", fontSize: 11 }} axisLine={false} tickLine={false} width={120} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="nodes" radius={[0, 4, 4, 0]} barSize={20}>
                        {data.barData.map((entry, i) => (
                          <Cell key={`bar-${i}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </motion.div>

          {/* ── Arbiter Summary ── */}
          <motion.div variants={itemVariants} className="lg:col-span-12">
            <Card className="border-border/60 bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Brain className="size-4 text-gold" />
                  <CardTitle className="text-sm font-semibold text-foreground">
                    {"The Arbiter\u2019s Summary"}
                  </CardTitle>
                </div>
                <p className="text-xs text-muted-foreground">
                  Synthesized from {data.deliberationRounds} rounds of multi-agent cross-examination and swarm deliberation
                </p>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-border/40 bg-surface p-4">
                  <p className="whitespace-pre-line font-mono text-xs leading-relaxed text-secondary-foreground">
                    {data.summaryText}
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 rounded-md bg-surface-elevated px-2.5 py-1">
                    <Scale className="size-3 text-gold" />
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {"Composite Merit: "}
                      <span className="text-foreground">{data.compositeMerit}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-md bg-surface-elevated px-2.5 py-1">
                    <ShieldCheck className="size-3 text-emerald-400" />
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {"Confidence: "}
                      <span className="text-emerald-400">{data.confidence}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-md bg-surface-elevated px-2.5 py-1">
                    <Users className="size-3 text-sky-400" />
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {"Deliberation Rounds: "}
                      <span className="text-foreground">{data.deliberationRounds}</span>
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* ── Advantages Table ── */}
          <motion.div variants={itemVariants} className="lg:col-span-6">
            <Card className="h-full border-border/60 bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-emerald-400" />
                  <CardTitle className="text-sm font-semibold text-foreground">
                    Winning Stance Advantages
                  </CardTitle>
                </div>
                <p className="text-xs text-muted-foreground">
                  Most persuasive logical arguments that survived adversarial examination
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/40 hover:bg-transparent">
                      <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">#</TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Argument</TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Category</TableHead>
                      <TableHead className="text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Weight</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.advantages.map((row) => (
                      <TableRow key={row.id} className="border-border/30 hover:bg-surface/50">
                        <TableCell className="font-mono text-xs text-muted-foreground">{row.id}</TableCell>
                        <TableCell className="max-w-[280px] text-xs text-secondary-foreground">
                          <div className="flex flex-col gap-0.5">
                            <span className="whitespace-normal leading-snug">{row.argument}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">{row.agent}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-border/50 text-[10px] font-normal text-muted-foreground">
                            {row.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-emerald-400">{row.weight}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </motion.div>

          {/* ── Flaws Table ── */}
          <motion.div variants={itemVariants} className="lg:col-span-6">
            <Card className="h-full border-border/60 bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-400" />
                  <CardTitle className="text-sm font-semibold text-foreground">
                    Crucial Flaws Detected
                  </CardTitle>
                </div>
                <p className="text-xs text-muted-foreground">
                  Logical fallacies and weak points penalized during cross-examination
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/40 hover:bg-transparent">
                      <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">#</TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Flaw</TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Severity</TableHead>
                      <TableHead className="text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Penalty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.flaws.map((row) => (
                      <TableRow key={row.id} className="border-border/30 hover:bg-surface/50">
                        <TableCell className="font-mono text-xs text-muted-foreground">{row.id}</TableCell>
                        <TableCell className="max-w-[280px] text-xs text-secondary-foreground">
                          <div className="flex flex-col gap-0.5">
                            <span className="whitespace-normal leading-snug">{row.flaw}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">{row.agent}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`font-mono text-[10px] font-medium ${SEVERITY_COLORS[row.severity]}`}>
                            {row.severity}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-red-400">{row.penalty}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* ── FOOTER BAR ── */}
        <motion.div variants={itemVariants}>
          <Separator className="my-6 bg-border/40" />
          <div className="flex items-center justify-between pb-6">
            <p className="max-w-lg text-[10px] leading-relaxed text-muted-foreground">
              This report is generated as a decision-support instrument only. It does not constitute legal advice, binding precedent, or a judicial order. Final authority rests with the presiding judicial officer.
            </p>
            <Button
              onClick={onNewCase}
              className="gap-2 border border-gold/30 bg-gold/10 text-gold hover:bg-gold/20"
            >
              <RotateCcw className="size-4" />
              Start New Case
            </Button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
