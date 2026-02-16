"use client"

import { useState, useCallback } from "react"
import { useDropzone, type FileRejection } from "react-dropzone"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { DatePicker } from "@/components/ui/date-picker"
import type { SurveyBackground } from "../_lib/survey-schema"

interface SurveyStepBackgroundProps {
  data: SurveyBackground
  onChange: (data: Partial<SurveyBackground>) => void
  caseId: string
}

const ACCEPT = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
}

const SLOTS = [
  { key: "passport", label: "Passport" },
  { key: "license", label: "Driver's License" },
  { key: "visa", label: "Passport + Visa Stamping" },
] as const

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function SlotDropzone({
  label,
  file,
  onFile,
  onClear,
  disabled,
}: {
  label: string
  file: File | null
  onFile: (f: File) => void
  onClear: () => void
  disabled?: boolean
}) {
  const onDrop = useCallback(
    (accepted: File[], _rejected: FileRejection[]) => {
      const f = accepted[0]
      if (f) onFile(f)
    },
    [onFile]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    maxSize: 10 * 1024 * 1024,
    multiple: false,
    disabled,
  })

  if (file) {
    return (
      <div className="flex items-center gap-2.5 rounded-md border border-border bg-muted/30 px-3 py-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary/10">
          <svg className="h-3.5 w-3.5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-foreground">{file.name}</p>
          <p className="text-[11px] text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]">
            {formatSize(file.size)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={`Remove ${label}`}
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-md border border-dashed px-3 py-2 transition-all",
        isDragActive
          ? "border-primary bg-primary/5"
          : "border-border/60 hover:border-primary/40 hover:bg-muted/20",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <input {...getInputProps()} />
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-muted">
        <svg className="h-3.5 w-3.5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground">PDF, JPG, or PNG -- max 10MB</p>
      </div>
    </div>
  )
}

export function SurveyStepBackground({ data, onChange, caseId }: SurveyStepBackgroundProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [files, setFiles] = useState<Record<string, File | null>>({
    passport: null,
    license: null,
    visa: null,
  })
  const [isUploading, setIsUploading] = useState(false)
  const [uploadDone, setUploadDone] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const hasAnyFile = Object.values(files).some(Boolean)

  const handleUpload = useCallback(async (slotKey: string, file: File) => {
    setFiles((prev) => ({ ...prev, [slotKey]: file }))

    const slot = SLOTS.find((s) => s.key === slotKey)
    if (!slot) return

    setIsUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append("file-0", file)
      formData.append("name-0", slot.label)

      const res = await fetch(`/api/case/${caseId}/id-documents`, {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const d = await res.json().catch(() => null)
        setUploadError(d?.error || "Upload failed")
        setIsUploading(false)
        return
      }

      const { extracted } = await res.json()

      if (extracted) {
        const updates: Partial<SurveyBackground> = {}
        if (extracted.fullName && !data.fullName) updates.fullName = extracted.fullName
        if (extracted.dateOfBirth && !data.dateOfBirth) updates.dateOfBirth = extracted.dateOfBirth
        if (extracted.countryOfBirth && !data.countryOfBirth) updates.countryOfBirth = extracted.countryOfBirth
        if (extracted.citizenship && !data.citizenship) updates.citizenship = extracted.citizenship
        if (Object.keys(updates).length > 0) onChange(updates)
      }

      setUploadDone(true)
    } catch {
      setUploadError("Upload failed. Please try again.")
    } finally {
      setIsUploading(false)
    }
  }, [caseId, data, onChange])

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h3 className="text-base font-medium mb-1">Background & Field</h3>
        <p className="text-sm text-muted-foreground">
          Tell us about yourself and your professional background.
        </p>
      </div>

      {/* ID document upload section */}
      <div className="rounded-md border border-border bg-muted/20">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex w-full items-center justify-between px-3.5 py-2.5 text-left"
        >
          <div className="flex items-center gap-2">
            {uploadDone && !isUploading ? (
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                <svg className="h-3 w-3 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            ) : isUploading ? (
              <svg className="h-4 w-4 animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" className="opacity-20" />
                <path d="M22 12c0-5.523-4.477-10-10-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            <div>
              <span className="text-xs font-medium text-foreground">
                Upload ID documents
              </span>
              <span className="text-xs text-muted-foreground ml-1.5">(optional)</span>
            </div>
          </div>
          <svg
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180"
            )}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {isOpen && (
          <div className="px-3.5 pb-3.5 space-y-2">
            <p className="text-[11px] text-muted-foreground mb-2.5">
              Auto-fills name, DOB, and citizenship from your documents.
            </p>
            {SLOTS.map((slot) => (
              <SlotDropzone
                key={slot.key}
                label={slot.label}
                file={files[slot.key]}
                onFile={(f) => handleUpload(slot.key, f)}
                onClear={() => setFiles((prev) => ({ ...prev, [slot.key]: null }))}
                disabled={isUploading}
              />
            ))}
            {uploadError && (
              <p className="text-xs text-destructive mt-1">{uploadError}</p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">Full Name</label>
          <Input
            placeholder="Your full legal name"
            value={data.fullName ?? ""}
            onChange={(e) => onChange({ fullName: e.target.value })}
            className="mt-1.5"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Date of Birth</label>
            <div className="mt-1.5">
              <DatePicker
                value={data.dateOfBirth ?? ""}
                onChange={(val) => onChange({ dateOfBirth: val })}
                placeholder="Select date of birth"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Country of Birth</label>
            <Input
              placeholder="e.g., India"
              value={data.countryOfBirth ?? ""}
              onChange={(e) => onChange({ countryOfBirth: e.target.value })}
              className="mt-1.5"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Citizenship</label>
          <Input
            placeholder="e.g., India, Canada"
            value={data.citizenship ?? ""}
            onChange={(e) => onChange({ citizenship: e.target.value })}
            className="mt-1.5"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Area of Expertise</label>
            <Input
              placeholder="e.g., Machine Learning"
              value={data.areaOfExpertise ?? ""}
              onChange={(e) => onChange({ areaOfExpertise: e.target.value })}
              className="mt-1.5"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Specific Field/Subfield</label>
            <Input
              placeholder="e.g., Computer Vision"
              value={data.specificField ?? ""}
              onChange={(e) => onChange({ specificField: e.target.value })}
              className="mt-1.5"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Current Job Title</label>
            <Input
              placeholder="e.g., Senior Research Scientist"
              value={data.currentTitle ?? ""}
              onChange={(e) => onChange({ currentTitle: e.target.value })}
              className="mt-1.5"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Current Employer</label>
            <Input
              placeholder="e.g., Google Research"
              value={data.currentEmployer ?? ""}
              onChange={(e) => onChange({ currentEmployer: e.target.value })}
              className="mt-1.5"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Years of Experience</label>
          <Input
            type="number"
            placeholder="e.g., 8"
            value={data.yearsExperience ?? ""}
            onChange={(e) => onChange({ yearsExperience: e.target.value ? Number(e.target.value) : undefined })}
            className="mt-1.5"
          />
        </div>
      </div>
    </div>
  )
}
