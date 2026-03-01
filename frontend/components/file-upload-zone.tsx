"use client"

import { useCallback, useState } from "react"
import { Upload, FileText, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface FileUploadZoneProps {
  /** Called with the first file in the list whenever the selection changes.
   *  Receives null when all files are removed. */
  onFileChange?: (file: File | null) => void
  ariaLabel?: string
}

export function FileUploadZone({ onFileChange, ariaLabel = "Upload files" }: FileUploadZoneProps) {
  const [files, setFiles] = useState<File[]>([])
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === "application/pdf" || f.type === "text/plain"
    )
    const next = [...files, ...droppedFiles]
    setFiles(next)
    onFileChange?.(next[0] ?? null)
  }, [files, onFileChange])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files)
      const next = [...files, ...selected]
      setFiles(next)
      onFileChange?.(next[0] ?? null)
    }
  }, [files, onFileChange])

  const removeFile = useCallback((index: number) => {
    const next = files.filter((_, i) => i !== index)
    setFiles(next)
    onFileChange?.(next[0] ?? null)
  }, [files, onFileChange])

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "group relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-all duration-300",
          isDragOver
            ? "border-gold/60 bg-gold/5"
            : "border-border/60 bg-secondary/20 hover:border-gold/30 hover:bg-secondary/40"
        )}
      >
        <input
          type="file"
          accept=".pdf,.txt"
          multiple
          onChange={handleFileInput}
          className="absolute inset-0 z-10 cursor-pointer opacity-0"
          aria-label={ariaLabel}
        />
        <div className={cn(
          "flex size-10 items-center justify-center rounded-lg transition-colors duration-300",
          isDragOver ? "bg-gold/15 text-gold" : "bg-secondary text-muted-foreground group-hover:bg-gold/10 group-hover:text-gold"
        )}>
          <Upload className="size-5" />
        </div>
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-sm font-medium text-foreground">
            {isDragOver ? "Release to upload" : "Drop files here or click to browse"}
          </p>
          <p className="text-xs text-muted-foreground">
            PDF and TXT files accepted
          </p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="flex flex-col gap-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-3 rounded-lg border border-border/40 bg-secondary/30 px-3 py-2"
            >
              <FileText className="size-4 shrink-0 text-gold-dim" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-foreground">
                  {file.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Remove ${file.name}`}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
