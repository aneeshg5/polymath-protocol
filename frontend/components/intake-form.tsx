"use client"

import { useState } from "react"
import { Zap, Scale, AlertCircle } from "lucide-react"
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
    { label: "Cook County, IL" },
    { label: "DuPage County, IL" },
    { label: "Lake County, IL" },
  ]},
  { group: "New York", items: [
    { label: "Manhattan, NY" },
    { label: "Brooklyn, NY" },
    { label: "Queens, NY" },
  ]},
  { group: "California", items: [
    { label: "Los Angeles County, CA" },
    { label: "San Francisco, CA" },
    { label: "San Diego County, CA" },
  ]},
  { group: "Texas", items: [
    { label: "Harris County, TX" },
    { label: "Dallas County, TX" },
    { label: "Bexar County, TX" },
  ]},
  { group: "Florida", items: [
    { label: "Miami-Dade County, FL" },
    { label: "Broward County, FL" },
  ]},
]

function getDepthLabel(value: number) {
  if (value <= 20) return "Quick Synthesis"
  if (value <= 40) return "Surface Analysis"
  if (value <= 60) return "Standard Review"
  if (value <= 80) return "Thorough Examination"
  return "Deep Deliberation"
}

interface IntakeFormProps {
  onInitialize: (file: File, jurisdiction: string) => void
  /** Error message from the hook if the last /init call failed */
  initError?: string | null
}

export function IntakeForm({ onInitialize, initError }: IntakeFormProps) {
  const [depth, setDepth] = useState([50])
  const [jurisdiction, setJurisdiction] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const canSubmit = selectedFile !== null && jurisdiction !== ""

  function handleSubmit() {
    if (!selectedFile) {
      setValidationError("Please upload a case document before initializing.")
      return
    }
    if (!jurisdiction) {
      setValidationError("Please select a jurisdiction before initializing.")
      return
    }
    setValidationError(null)
    onInitialize(selectedFile, jurisdiction)
  }

  const displayError = validationError ?? initError ?? null

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
            <FileUploadZone onFileChange={setSelectedFile} />
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
                      // value={item.label} so the state holds the human-readable name
                      // that gets sent directly to the backend API
                      <SelectItem key={item.label} value={item.label}>
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

          {/* Inline error — shown for validation failures or API errors */}
          {displayError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
              <p className="text-xs text-destructive">{displayError}</p>
            </div>
          )}

          {/* Initialize Button */}
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="group relative w-full overflow-hidden border border-gold/30 bg-gold/10 text-gold hover:bg-gold/20 hover:text-gold-glow animate-pulse-gold transition-all duration-300 disabled:animate-none disabled:cursor-not-allowed disabled:opacity-40"
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
