"use client"

import { useState } from "react"
import { Zap, Scale } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { FileUploadZone } from "@/components/file-upload-zone"

const jurisdictions = [
  { group: "Illinois", items: [
    { value: "cook-county-il", label: "Cook County, IL" },
    { value: "dupage-county-il", label: "DuPage County, IL" },
    { value: "lake-county-il", label: "Lake County, IL" },
  ]},
  { group: "New York", items: [
    { value: "manhattan-ny", label: "Manhattan, NY" },
    { value: "brooklyn-ny", label: "Brooklyn, NY" },
    { value: "queens-ny", label: "Queens, NY" },
  ]},
  { group: "California", items: [
    { value: "los-angeles-ca", label: "Los Angeles County, CA" },
    { value: "san-francisco-ca", label: "San Francisco, CA" },
    { value: "san-diego-ca", label: "San Diego County, CA" },
  ]},
  { group: "Texas", items: [
    { value: "harris-county-tx", label: "Harris County, TX" },
    { value: "dallas-county-tx", label: "Dallas County, TX" },
    { value: "bexar-county-tx", label: "Bexar County, TX" },
  ]},
  { group: "Florida", items: [
    { value: "miami-dade-fl", label: "Miami-Dade County, FL" },
    { value: "broward-county-fl", label: "Broward County, FL" },
  ]},
]

function getDepthLabel(value: number) {
  if (value <= 20) return "Quick Synthesis"
  if (value <= 40) return "Surface Analysis"
  if (value <= 60) return "Standard Review"
  if (value <= 80) return "Thorough Examination"
  return "Deep Deliberation"
}

export function IntakeForm({ onInitialize }: { onInitialize: () => void }) {
  const [depth, setDepth] = useState([50])
  const [jurisdiction, setJurisdiction] = useState("")

  return (
    <div className="flex flex-1 items-start justify-center overflow-y-auto px-4 py-8 md:py-12">
      <Card className="w-full max-w-2xl border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-gold/10">
              <Scale className="size-4 text-gold" />
            </div>
            <div>
              <CardTitle className="text-lg text-foreground">
                Case Intake & Configuration
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Configure simulation parameters before agent initialization
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-6 pt-4">
          {/* File Upload */}
          <div className="flex flex-col gap-2.5">
            <Label className="text-sm text-foreground">
              Case Files & Evidence
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">(PDF / TXT)</span>
            </Label>
            <FileUploadZone />
          </div>

          {/* Jurisdiction Select */}
          <div className="flex flex-col gap-2.5">
            <Label htmlFor="jurisdiction" className="text-sm text-foreground">
              Jurisdiction / Demographic Profile
            </Label>
            <Select value={jurisdiction} onValueChange={setJurisdiction}>
              <SelectTrigger id="jurisdiction" className="w-full bg-input/50 hover:bg-input/70 transition-colors">
                <SelectValue placeholder="Select jurisdiction..." />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {jurisdictions.map((group) => (
                  <SelectGroup key={group.group}>
                    <SelectLabel className="text-gold-dim">{group.group}</SelectLabel>
                    {group.items.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Simulation Depth Slider */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-foreground">
                Simulation Depth
              </Label>
              <span className="rounded-md border border-gold/20 bg-gold/5 px-2.5 py-0.5 text-xs font-medium text-gold">
                {getDepthLabel(depth[0])}
              </span>
            </div>
            <Slider
              value={depth}
              onValueChange={setDepth}
              min={0}
              max={100}
              step={1}
              className="[&_[data-slot=slider-track]]:bg-secondary [&_[data-slot=slider-range]]:bg-gradient-to-r [&_[data-slot=slider-range]]:from-gold-dim [&_[data-slot=slider-range]]:to-gold [&_[data-slot=slider-thumb]]:border-gold [&_[data-slot=slider-thumb]]:bg-background [&_[data-slot=slider-thumb]]:ring-gold/30"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Quick Synthesis</span>
              <span>Deep Deliberation</span>
            </div>
          </div>

          {/* Separator */}
          <div className="h-px bg-border/50" />

          {/* Initialize Button */}
          <Button
            size="lg"
            onClick={onInitialize}
            className="group relative w-full overflow-hidden border border-gold/30 bg-gold/10 text-gold hover:bg-gold/20 hover:text-gold-glow animate-pulse-gold transition-all duration-300"
          >
            <span className="relative z-10 flex items-center gap-2 font-semibold tracking-wide">
              <Zap className="size-4 transition-transform group-hover:scale-110" />
              Initialize Simulation Agents
            </span>
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            This will instantiate LLM-based judicial archetypes calibrated to the selected jurisdiction.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
