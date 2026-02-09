"use client"

import { useEffect, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { ExtractionRawPanel } from "./extraction-raw-panel"
import { StrengthEvaluationPanel } from "./strength-evaluation-panel"
import { GapAnalysisPanel } from "./gap-analysis-panel"
import type { DetailedExtraction, CriteriaSummaryItem } from "@/lib/eb1a-extraction-schema"
import { CRITERIA_METADATA } from "@/lib/eb1a-extraction-schema"
import type { StrengthEvaluation } from "@/lib/strength-evaluation-schema"
import type { GapAnalysis } from "@/lib/gap-analysis-schema"
import {
  FileText,
  Award,
  ScrollText,
  Users,
  Newspaper,
  Scale,
  Mic,
  DollarSign,
  Building,
  Palette,
  TrendingUp,
  Lightbulb,
  Banknote,
} from "lucide-react"

type Strength = "Strong" | "Weak" | "None"

interface CriterionResult {
  criterionId: string
  strength: Strength
  reason: string
  evidence: string[]
}

interface Analysis {
  criteria: CriterionResult[]
  extraction?: DetailedExtraction | null
  criteria_summary?: CriteriaSummaryItem[]
  strongCount: number
  weakCount: number
  version?: number
  criteriaNames?: Record<string, string>
  criteriaThreshold?: number
  mergedWithSurvey?: boolean
}

interface ReportPanelProps {
  caseId: string
  initialAnalysis?: Analysis | null
  version?: number
  threshold?: number
  onThresholdChange?: (threshold: number) => void
  onStrongCountChange?: (count: number) => void
  initialStrengthEvaluation?: StrengthEvaluation | null
  initialGapAnalysis?: GapAnalysis | null
}

function getStrengthConfig(strength: Strength) {
  switch (strength) {
    case "Strong":
      return {
        bg: "bg-emerald-500/5",
        border: "border-l-emerald-500",
        headerBg: "bg-emerald-500/10",
        badge: "bg-emerald-600 text-white",
        icon: (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      }
    case "Weak":
      return {
        bg: "bg-amber-500/5",
        border: "border-l-amber-500",
        headerBg: "bg-amber-500/10",
        badge: "bg-amber-500 text-white",
        icon: (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M5 12h14" strokeLinecap="round" />
          </svg>
        ),
      }
    default:
      return {
        bg: "bg-muted/30",
        border: "border-l-muted-foreground/30",
        headerBg: "bg-muted/50",
        badge: "bg-muted-foreground/70 text-background",
        icon: (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      }
  }
}

// -- Category config for extraction items --
const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ElementType }> = {
  publications: { label: "Publications", icon: FileText },
  awards: { label: "Awards", icon: Award },
  patents: { label: "Patents", icon: ScrollText },
  memberships: { label: "Memberships", icon: Users },
  media_coverage: { label: "Media Coverage", icon: Newspaper },
  judging_activities: { label: "Judging", icon: Scale },
  speaking_engagements: { label: "Speaking", icon: Mic },
  grants: { label: "Grants", icon: DollarSign },
  leadership_roles: { label: "Leadership", icon: Building },
  compensation: { label: "Compensation", icon: Banknote },
  exhibitions: { label: "Exhibitions", icon: Palette },
  commercial_success: { label: "Commercial Success", icon: TrendingUp },
  original_contributions: { label: "Original Contributions", icon: Lightbulb },
}

// Array categories that have mapped_criteria
const EVIDENCE_CATEGORIES = [
  "publications", "awards", "patents", "memberships", "media_coverage",
  "judging_activities", "speaking_engagements", "grants", "leadership_roles",
  "compensation", "exhibitions", "commercial_success", "original_contributions",
] as const

type EvidenceCategory = (typeof EVIDENCE_CATEGORIES)[number]

function getEvidenceForCriterion(
  extraction: DetailedExtraction,
  criterionId: string
): { category: EvidenceCategory; items: Record<string, unknown>[] }[] {
  const results: { category: EvidenceCategory; items: Record<string, unknown>[] }[] = []
  for (const cat of EVIDENCE_CATEGORIES) {
    const arr = extraction[cat] as Record<string, unknown>[]
    if (!arr?.length) continue
    const matching = arr.filter((item) => {
      const mc = item.mapped_criteria as string[] | undefined
      return mc?.includes(criterionId)
    })
    if (matching.length > 0) {
      results.push({ category: cat, items: matching })
    }
  }
  return results
}

function ItemSummary({ item, category }: { item: Record<string, unknown>; category: EvidenceCategory }) {
  // Render a compact one-liner based on category
  switch (category) {
    case "publications": {
      const parts = [item.title as string]
      if (item.venue) parts.push(`in ${item.venue}`)
      if (item.year) parts.push(`(${item.year})`)
      if (item.citations) parts.push(`- ${item.citations} citations`)
      return <span>{parts.join(" ")}</span>
    }
    case "awards": {
      const parts = [item.name as string]
      if (item.issuer) parts.push(`by ${item.issuer}`)
      if (item.year) parts.push(`(${item.year})`)
      if (item.scope && item.scope !== "unknown") parts.push(`[${item.scope}]`)
      return <span>{parts.join(" ")}</span>
    }
    case "patents": {
      const parts = [item.title as string]
      if (item.number) parts.push(`#${item.number}`)
      if (item.status && item.status !== "unknown") parts.push(`(${item.status})`)
      return <span>{parts.join(" ")}</span>
    }
    case "memberships": {
      const parts = [item.organization as string]
      if (item.role) parts.push(`- ${item.role}`)
      return <span>{parts.join(" ")}</span>
    }
    case "media_coverage": {
      const parts: string[] = []
      if (item.title) parts.push(item.title as string)
      if (item.outlet) parts.push(`(${item.outlet})`)
      return <span>{parts.join(" ") || item.outlet as string}</span>
    }
    case "judging_activities": {
      const parts: string[] = []
      if (item.type) parts.push((item.type as string).replace(/_/g, " "))
      if (item.organization) parts.push(`at ${item.organization}`)
      if (item.venue) parts.push(`for ${item.venue}`)
      return <span>{parts.join(" ")}</span>
    }
    case "speaking_engagements": {
      const parts = [item.event as string]
      if (item.type) parts.push(`(${item.type})`)
      if (item.year) parts.push(`${item.year}`)
      return <span>{parts.join(" ")}</span>
    }
    case "grants": {
      const parts = [item.title as string]
      if (item.funder) parts.push(`from ${item.funder}`)
      if (item.amount != null) parts.push(`${item.currency ?? "$"}${(item.amount as number).toLocaleString()}`)
      return <span>{parts.join(" ")}</span>
    }
    case "leadership_roles": {
      const parts = [item.title as string]
      if (item.organization) parts.push(`at ${item.organization}`)
      return <span>{parts.join(" ")}</span>
    }
    case "compensation": {
      const parts: string[] = []
      if (item.amount != null) parts.push(`${item.currency ?? "$"}${(item.amount as number).toLocaleString()}`)
      if (item.period) parts.push(`(${item.period})`)
      if (item.context) parts.push(`- ${item.context}`)
      return <span>{parts.join(" ")}</span>
    }
    case "exhibitions": {
      const parts: string[] = []
      if (item.title) parts.push(item.title as string)
      if (item.venue) parts.push(`at ${item.venue}`)
      if (item.type) parts.push(`(${item.type})`)
      return <span>{parts.join(" ") || item.venue as string}</span>
    }
    case "commercial_success": {
      return <span>{item.description as string}</span>
    }
    case "original_contributions": {
      return <span>{item.description as string}</span>
    }
    default:
      return <span>{JSON.stringify(item)}</span>
  }
}

function CriterionSection({
  criterion,
  criteriaNames,
  criteriaSummary,
  extraction,
  caseId,
  onCriterionUpdated,
}: {
  criterion: CriterionResult
  criteriaNames?: Record<string, string>
  criteriaSummary?: CriteriaSummaryItem
  extraction?: DetailedExtraction | null
  caseId: string
  onCriterionUpdated: (criterionId: string, result: { strength: Strength; reason: string; evidence: string[] }) => void
}) {
  const config = getStrengthConfig(criterion.strength)
  const [expanded, setExpanded] = useState(criterion.strength !== "None")
  const [dragOver, setDragOver] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [showContext, setShowContext] = useState(false)
  const [contextText, setContextText] = useState("")

  const meta = CRITERIA_METADATA[criterion.criterionId as keyof typeof CRITERIA_METADATA]
  const displayName = criteriaNames?.[criterion.criterionId] ?? meta?.name ?? criterion.criterionId
  const evidenceCount = criteriaSummary?.evidence_count ?? criterion.evidence?.length ?? 0
  const summary = criteriaSummary?.summary ?? criterion.reason
  const keyEvidence = criteriaSummary?.key_evidence ?? []
  const extractionGroups = extraction ? getEvidenceForCriterion(extraction, criterion.criterionId) : []

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)

    const file = e.dataTransfer.files?.[0]
    if (!file || evaluating) return

    setEvaluating(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("criterionId", criterion.criterionId)

      const res = await fetch(`/api/case/${caseId}/criterion`, {
        method: "POST",
        body: formData,
      })
      if (!res.ok) throw new Error("Evaluation failed")
      const data = await res.json()
      onCriterionUpdated(criterion.criterionId, data)
    } catch (err) {
      console.error("Criterion file eval error:", err)
    } finally {
      setEvaluating(false)
    }
  }, [caseId, criterion.criterionId, evaluating, onCriterionUpdated])

  const handleContextSubmit = useCallback(async () => {
    if (!contextText.trim() || evaluating) return
    setEvaluating(true)
    try {
      const res = await fetch(`/api/case/${caseId}/criterion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criterionId: criterion.criterionId, context: contextText.trim() }),
      })
      if (!res.ok) throw new Error("Evaluation failed")
      const data = await res.json()
      onCriterionUpdated(criterion.criterionId, data)
      setContextText("")
      setShowContext(false)
    } catch (err) {
      console.error("Criterion context eval error:", err)
    } finally {
      setEvaluating(false)
    }
  }, [caseId, criterion.criterionId, contextText, evaluating, onCriterionUpdated])

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "rounded-lg border border-l-4 overflow-hidden transition-all relative",
        config.border, config.bg,
        dragOver ? "border-primary ring-2 ring-primary/30" : "border-border",
      )}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div className="absolute inset-0 z-10 bg-primary/10 flex items-center justify-center pointer-events-none">
          <span className="text-xs font-medium text-primary">Drop file to evaluate</span>
        </div>
      )}

      {/* Loading overlay */}
      {evaluating && (
        <div className="absolute inset-0 z-10 bg-background/60 backdrop-blur-[2px] flex items-center justify-center">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-muted-foreground">Evaluating...</span>
          </div>
        </div>
      )}

      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5", config.headerBg)}
      >
        <span className={cn("flex items-center justify-center w-6 h-6 rounded-full shrink-0", config.badge)}>
          {config.icon}
        </span>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-stone-800 dark:text-stone-200">{displayName}</span>
          {meta?.description && (
            <span className="ml-2 text-xs text-muted-foreground hidden sm:inline">{meta.description}</span>
          )}
        </div>
        {evidenceCount > 0 && (
          <span className="text-xs text-muted-foreground shrink-0">{evidenceCount} items</span>
        )}
        <svg
          className={cn("w-4 h-4 text-muted-foreground shrink-0 transition-transform", expanded && "rotate-180")}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-3">
          {/* Summary */}
          {summary && (
            <p className="text-xs leading-relaxed text-stone-600 dark:text-stone-400">{summary}</p>
          )}

          {/* Key evidence quotes */}
          {keyEvidence.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Key Evidence</span>
              {keyEvidence.map((ev, i) => (
                <p key={i} className="text-xs text-foreground/80 pl-2.5 border-l-2 border-stone-300 dark:border-stone-600 leading-relaxed">
                  {ev}
                </p>
              ))}
            </div>
          )}

          {/* Legacy evidence strings (no extraction) */}
          {!criteriaSummary && criterion.evidence?.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Evidence</span>
              {criterion.evidence.map((ev, i) => (
                <p key={i} className="text-xs text-foreground/80 pl-2.5 border-l-2 border-stone-300 dark:border-stone-600">
                  {ev}
                </p>
              ))}
            </div>
          )}

          {/* Supporting extraction items */}
          {extractionGroups.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Supporting Items</span>
              {extractionGroups.map(({ category, items }) => {
                const catConf = CATEGORY_CONFIG[category]
                if (!catConf) return null
                const Icon = catConf.icon
                return (
                  <div key={category} className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Icon className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[11px] font-medium text-muted-foreground">{catConf.label}</span>
                    </div>
                    {items.map((item, j) => (
                      <div key={j} className="text-xs text-foreground/80 pl-4 py-0.5">
                        <ItemSummary item={item} category={category} />
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}

          {/* Nothing state */}
          {criterion.strength === "None" && !summary && keyEvidence.length === 0 && extractionGroups.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No evidence found for this criterion.</p>
          )}

          {/* Add context toggle */}
          {!showContext ? (
            <button
              onClick={() => setShowContext(true)}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              + Add context
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                value={contextText}
                onChange={(e) => setContextText(e.target.value)}
                placeholder="Paste additional context, achievements, or details..."
                className="w-full text-xs p-2 rounded-md border border-border bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleContextSubmit}
                  disabled={!contextText.trim() || evaluating}
                  className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  Evaluate
                </button>
                <button
                  onClick={() => { setShowContext(false); setContextText("") }}
                  className="px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

type ReportTab = "summary" | "strength" | "gap" | "raw"

export function ReportPanel({
  caseId,
  initialAnalysis,
  version = 0,
  threshold = 3,
  onThresholdChange,
  onStrongCountChange,
  initialStrengthEvaluation,
  initialGapAnalysis,
}: ReportPanelProps) {
  const [analysis, setAnalysis] = useState<Analysis | null>(initialAnalysis ?? null)
  const [activeTab, setActiveTab] = useState<ReportTab>("summary")
  const [isLoading, setIsLoading] = useState(!initialAnalysis)

  useEffect(() => {
    let cancelled = false
    let retryCount = 0
    const maxRetries = 5

    async function fetchAnalysis() {
      try {
        // Brief delay on refetches to let agent tool calls commit to DB
        if (version > 0 || retryCount > 0) {
          await new Promise((r) => setTimeout(r, 1500))
        }
        if (cancelled) return
        const res = await fetch(`/api/case/${caseId}/analysis`, {
          cache: "no-store",
        })
        if (res.ok && !cancelled) {
          const data = await res.json()
          if (data && data.criteria && data.criteria.length > 0) {
            setAnalysis(data)
            setIsLoading(false)
            if (data.criteriaThreshold != null) {
              onThresholdChange?.(data.criteriaThreshold)
            }
            if (data.strongCount != null) {
              onStrongCountChange?.(data.strongCount)
            }
          } else if (retryCount < maxRetries && !cancelled) {
            // Retry if no analysis found (might still be saving)
            retryCount++
            fetchAnalysis()
          } else {
            setIsLoading(false)
          }
        } else {
          setIsLoading(false)
        }
      } catch (err) {
        console.error("Failed to fetch analysis:", err)
        setIsLoading(false)
      }
    }

    fetchAnalysis()
    return () => {
      cancelled = true
    }
  }, [caseId, version, onThresholdChange, onStrongCountChange])

  if (!analysis) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center text-stone-400 dark:text-stone-500">
          {isLoading ? (
            <>
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm">Loading analysis...</p>
            </>
          ) : (
            <>
              <p className="text-sm">No analysis yet</p>
              <p className="text-xs mt-1">
                The analysis will appear here as your case develops
              </p>
            </>
          )}
        </div>
      </div>
    )
  }

  const meetsThreshold = analysis.strongCount >= threshold

  async function updateThreshold(newVal: number) {
    if (newVal < 1 || newVal > 10) return
    const prev = threshold
    onThresholdChange?.(newVal)
    try {
      const res = await fetch(`/api/case/${caseId}/threshold`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threshold: newVal }),
      })
      if (!res.ok) onThresholdChange?.(prev)
    } catch {
      onThresholdChange?.(prev)
    }
  }

  const handleCriterionUpdated = useCallback(
    (criterionId: string, result: { strength: Strength; reason: string; evidence: string[] }) => {
      setAnalysis((prev) => {
        if (!prev) return prev
        const updatedCriteria = prev.criteria.map((c) =>
          c.criterionId === criterionId ? { ...c, ...result } : c
        )
        const updatedSummary = prev.criteria_summary?.map((s) =>
          s.criterion_id === criterionId
            ? { ...s, strength: result.strength, summary: result.reason, key_evidence: result.evidence, evidence_count: result.evidence.length }
            : s
        )
        const strongCount = updatedCriteria.filter((c) => c.strength === "Strong").length
        const weakCount = updatedCriteria.filter((c) => c.strength === "Weak").length
        onStrongCountChange?.(strongCount)
        return { ...prev, criteria: updatedCriteria, criteria_summary: updatedSummary, strongCount, weakCount }
      })
    },
    [onStrongCountChange]
  )

  const hasExtraction = !!analysis.extraction

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
            EB-1A Analysis{analysis.version ? ` v${analysis.version}` : ""}
            {analysis.mergedWithSurvey && (
              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                Updated
              </span>
            )}
          </h3>
          <div
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
              meetsThreshold
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
            )}
          >
            <span>
              {analysis.strongCount}/{threshold}
            </span>
            <button
              onClick={() => updateThreshold(threshold - 1)}
              disabled={threshold <= 1}
              className="w-4 h-4 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30"
            >
              -
            </button>
            <button
              onClick={() => updateThreshold(threshold + 1)}
              disabled={threshold >= 10}
              className="w-4 h-4 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30"
            >
              +
            </button>
          </div>
        </div>
        <div className="flex gap-3 mt-2 text-xs text-stone-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            {analysis.strongCount} strong
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            {analysis.weakCount} weak
          </span>
        </div>

        {/* Tabs */}
        {hasExtraction && (
          <div className="flex items-end gap-3 mt-3">
            {/* Phase 1 group */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 pl-0.5">
                Phase 1
              </span>
              <div className="flex gap-1 p-1 rounded-lg bg-muted border border-border/50">
                <button
                  onClick={() => setActiveTab("summary")}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                    activeTab === "summary"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                  )}
                >
                  Criteria
                </button>
                <button
                  onClick={() => setActiveTab("strength")}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                    activeTab === "strength"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                  )}
                >
                  Strength Eval
                </button>
                <button
                  onClick={() => setActiveTab("gap")}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                    activeTab === "gap"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                  )}
                >
                  Gap Analysis
                </button>
              </div>
            </div>

            {/* Separator */}
            <div className="h-8 w-px bg-border/50 shrink-0 mb-1" />

            {/* Raw Data - outside phase group */}
            <button
              onClick={() => setActiveTab("raw")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors mb-1",
                activeTab === "raw"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              Raw Data
            </button>
          </div>
        )}
      </div>

      {/* Tab content */}
      {activeTab === "summary" ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {analysis.criteria.map((c) => {
            const cs = analysis.criteria_summary?.find(
              (s) => s.criterion_id === c.criterionId
            )
            return (
              <CriterionSection
                key={c.criterionId}
                criterion={c}
                criteriaNames={analysis.criteriaNames}
                criteriaSummary={cs}
                extraction={analysis.extraction}
                caseId={caseId}
                onCriterionUpdated={handleCriterionUpdated}
              />
            )
          })}
        </div>
      ) : activeTab === "strength" ? (
        <StrengthEvaluationPanel
          caseId={caseId}
          initialData={initialStrengthEvaluation}
        />
      ) : activeTab === "gap" ? (
        <GapAnalysisPanel
          caseId={caseId}
          initialData={initialGapAnalysis}
          hasStrengthEval={!!initialStrengthEvaluation}
        />
      ) : (
        <ExtractionRawPanel extraction={analysis.extraction ?? null} />
      )}
    </div>
  )
}
