"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { ExtractionRawPanel } from "./extraction-raw-panel"
import { CriteriaTab } from "./criteria-tab"
import { PlanningTab } from "./planning-tab"
import { EvidenceListPanel } from "./evidence-list-panel"
import { CriteriaRoutingPanel } from "./criteria-routing-panel"
import { ConsolidationTab } from "./consolidation-tab"
import { LettersPanel } from "./letters-panel"
import { DenialProbabilityPanel } from "./denial-probability-panel"
import type { DetailedExtraction, CriteriaSummaryItem } from "@/lib/eb1a-extraction-schema"
import { CRITERIA_METADATA } from "@/lib/eb1a-extraction-schema"
import type { StrengthEvaluation } from "@/lib/strength-evaluation-schema"
import type { GapAnalysis } from "@/lib/gap-analysis-schema"
import type { CaseStrategy } from "@/lib/case-strategy-schema"
import type { CaseConsolidation } from "@/lib/case-consolidation-schema"
import type { DenialProbability } from "@/lib/denial-probability-schema"
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
  ShieldAlert,
  Trash2,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

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
  docCountsByCriterion?: Record<string, number>
  docCountsByItem?: Record<string, number>
}

interface ReportPanelProps {
  caseId: string
  initialAnalysis?: Analysis | null
  version?: number
  threshold?: number
  onThresholdChange?: (threshold: number) => void
  onStrongCountChange?: (count: number) => void
  onDocumentsRouted?: () => void
  initialStrengthEvaluation?: StrengthEvaluation | null
  initialGapAnalysis?: GapAnalysis | null
  initialCaseStrategy?: CaseStrategy | null
  initialCaseConsolidation?: CaseConsolidation | null
  initialDenialProbability?: DenialProbability | null
  onOpenDraft?: (doc?: { id?: string; name?: string; content?: string; recommenderId?: string; category?: string }) => void
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
      if (item.amount != null) parts.push(`${item.currency ?? "$"}${(item.amount as number).toLocaleString("en-US")}`)
      return <span>{parts.join(" ")}</span>
    }
    case "leadership_roles": {
      const parts = [item.title as string]
      if (item.organization) parts.push(`at ${item.organization}`)
      return <span>{parts.join(" ")}</span>
    }
    case "compensation": {
      const parts: string[] = []
      if (item.amount != null) parts.push(`${item.currency ?? "$"}${(item.amount as number).toLocaleString("en-US")}`)
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
  docCount,
  docCountsByItem,
  onNavigateToRouting,
  onCriterionUpdated,
  onFileDropped,
}: {
  criterion: CriterionResult
  criteriaNames?: Record<string, string>
  criteriaSummary?: CriteriaSummaryItem
  extraction?: DetailedExtraction | null
  caseId: string
  docCount: number
  docCountsByItem?: Record<string, number>
  onNavigateToRouting: () => void
  onCriterionUpdated: (criterionId: string, result: { strength: Strength; reason: string; evidence: string[] }) => void
  onFileDropped?: () => void
}) {
  const config = getStrengthConfig(criterion.strength)
  const [expanded, setExpanded] = useState(criterion.strength !== "None")
  const [dragOver, setDragOver] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [showContext, setShowContext] = useState(false)
  const [contextText, setContextText] = useState("")
  const [removing, setRemoving] = useState<string | null>(null)

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

      // Show post-drop feedback based on evidence verification result
      if (data.verification) {
        const v = data.verification as { recommendation: string; score: number; verified_claims: string[]; red_flags: string[] }
        if (v.recommendation === "STRONG") {
          toast.success(`Evidence verified for ${displayName}`, {
            description: v.verified_claims.length > 0
              ? v.verified_claims.slice(0, 2).join("; ")
              : `Score: ${v.score}/10`,
            duration: 6000,
          })
        } else if (v.recommendation === "INCLUDE_WITH_SUPPORT") {
          toast(`Partially relevant evidence for ${displayName}`, {
            description: [
              v.verified_claims.length > 0 ? `Verified: ${v.verified_claims[0]}` : null,
              v.red_flags.length > 0 ? `Gaps: ${v.red_flags[0]}` : null,
            ].filter(Boolean).join(" | "),
            duration: 8000,
          })
        } else if (v.recommendation === "NEEDS_MORE_DOCS") {
          toast(`Weak evidence for ${displayName}`, {
            description: v.red_flags.length > 0
              ? v.red_flags.slice(0, 2).join("; ")
              : "Additional documentation recommended",
            duration: 8000,
          })
        } else {
          toast.error(`Not relevant to ${displayName}`, {
            description: v.red_flags.length > 0
              ? v.red_flags[0]
              : "This document may be better suited for a different criterion",
            duration: 8000,
          })
        }
      }

      // Refresh doc counts so evidence badges update
      onFileDropped?.()
    } catch (err) {
      console.error("Criterion file eval error:", err)
      toast.error("Failed to evaluate dropped file")
    } finally {
      setEvaluating(false)
    }
  }, [caseId, criterion.criterionId, evaluating, onCriterionUpdated, displayName, onFileDropped])

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

  const handleRemoveEvidence = useCallback(async (
    index: number,
    source: "key_evidence" | "evidence" | "extraction_item",
    category?: string,
    label?: string,
  ) => {
    const key = `${source}-${category ?? ""}-${index}`
    if (removing) return
    setRemoving(key)
    try {
      const res = await fetch(`/api/case/${caseId}/criterion`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          criterionId: criterion.criterionId,
          evidenceIndex: index,
          evidenceSource: source,
          category,
        }),
      })
      if (!res.ok) throw new Error("Removal failed")
      const data = await res.json()
      onCriterionUpdated(criterion.criterionId, data)
      toast("Evidence removed", {
        description: label ? `Removed: ${label.slice(0, 80)}${label.length > 80 ? "..." : ""}` : undefined,
        duration: 5000,
      })
    } catch (err) {
      console.error("Evidence removal error:", err)
      toast.error("Failed to remove evidence")
    } finally {
      setRemoving(null)
    }
  }, [caseId, criterion.criterionId, removing, onCriterionUpdated])

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
        {docCount > 0 ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onNavigateToRouting() }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onNavigateToRouting() } }}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300 hover:bg-teal-200 dark:hover:bg-teal-900/60 transition-colors shrink-0 cursor-pointer"
          >
            <FileText className="w-3 h-3" />
            {docCount} {docCount === 1 ? "doc" : "docs"}
          </span>
        ) : criterion.strength !== "None" ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 shrink-0">
            Mentioned
          </span>
        ) : null}
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
                <div key={i} className="group flex items-start gap-1.5">
                  <p className="flex-1 text-xs text-foreground/80 pl-2.5 border-l-2 border-stone-300 dark:border-stone-600 leading-relaxed">
                    {ev}
                  </p>
                  <button
                    onClick={() => handleRemoveEvidence(i, "key_evidence", undefined, ev)}
                    disabled={removing !== null}
                    className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 mt-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-600 transition-all disabled:opacity-30"
                  >
                    {removing === `key_evidence--${i}` ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Legacy evidence strings (no extraction) */}
          {!criteriaSummary && criterion.evidence?.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Evidence</span>
              {criterion.evidence.map((ev, i) => (
                <div key={i} className="group flex items-start gap-1.5">
                  <p className="flex-1 text-xs text-foreground/80 pl-2.5 border-l-2 border-stone-300 dark:border-stone-600">
                    {ev}
                  </p>
                  <button
                    onClick={() => handleRemoveEvidence(i, "evidence", undefined, ev)}
                    disabled={removing !== null}
                    className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 mt-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-600 transition-all disabled:opacity-30"
                  >
                    {removing === `evidence--${i}` ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                  </button>
                </div>
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
                    {items.map((item, j) => {
                      const itemId = item.id as string | undefined
                      const itemDocCount = itemId ? (docCountsByItem?.[itemId] ?? 0) : 0
                      return (
                      <div key={j} className="group/item flex items-center gap-1.5 text-xs text-foreground/80 pl-4 py-0.5">
                        <span className="flex-1"><ItemSummary item={item} category={category} /></span>
                        {itemDocCount > 0 ? (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); onNavigateToRouting() }}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onNavigateToRouting() } }}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 transition-colors shrink-0 cursor-pointer"
                          >
                            <FileText className="w-2.5 h-2.5" />
                            Evidence in Vault
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded-full text-[10px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 shrink-0">
                            Evidence Required
                          </span>
                        )}
                        <button
                          onClick={() => handleRemoveEvidence(j, "extraction_item", category)}
                          disabled={removing !== null}
                          className="opacity-0 group-hover/item:opacity-100 shrink-0 p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-600 transition-all disabled:opacity-30"
                        >
                          {removing === `extraction_item-${category}-${j}` ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                      )
                    })}
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
              + Add or update context
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                value={contextText}
                onChange={(e) => setContextText(e.target.value)}
                placeholder="Add context, remove incorrect evidence, or describe changes..."
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

type ReportTab = "summary" | "planning" | "evidence" | "routing" | "consolidation" | "letters" | "denial" | "raw"

export function ReportPanel({
  caseId,
  initialAnalysis,
  version = 0,
  threshold = 3,
  onThresholdChange,
  onStrongCountChange,
  onDocumentsRouted,
  initialStrengthEvaluation,
  initialGapAnalysis,
  initialCaseStrategy,
  initialCaseConsolidation,
  initialDenialProbability,
  onOpenDraft,
}: ReportPanelProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const validSubTabs = useMemo(() => new Set<ReportTab>(["summary", "planning", "evidence", "routing", "consolidation", "letters", "denial", "raw"]), [])
  const subtabParam = searchParams.get('subtab')
  const initialSubTab = subtabParam && validSubTabs.has(subtabParam as ReportTab)
    ? (subtabParam as ReportTab)
    : 'summary'

  const [analysis, setAnalysis] = useState<Analysis | null>(initialAnalysis ?? null)
  const [activeTab, setActiveTab] = useState<ReportTab>(initialSubTab)
  const [isLoading, setIsLoading] = useState(!initialAnalysis)

  // Sync activeTab when URL subtab param changes externally
  useEffect(() => {
    const param = searchParams.get('subtab')
    if (param && validSubTabs.has(param as ReportTab)) {
      setActiveTab(param as ReportTab)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const handleSubTabChange = useCallback((tab: ReportTab) => {
    setActiveTab(tab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('subtab', tab)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [searchParams, router, pathname])

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

  const refetchDocCounts = useCallback(async () => {
    try {
      const res = await fetch(`/api/case/${caseId}/analysis`, { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        if (data) {
          setAnalysis((prev) => prev ? {
            ...prev,
            docCountsByCriterion: data.docCountsByCriterion,
            docCountsByItem: data.docCountsByItem,
          } : prev)
        }
      }
    } catch { /* non-fatal */ }
  }, [caseId])

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
          <TooltipProvider delayDuration={300}>
          <div className="flex items-end gap-3 mt-3">
            {/* Phase 1 group */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 pl-0.5">
                Phase 1
              </span>
              <div className="flex gap-1 p-1 rounded-lg bg-muted border border-border/50">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleSubTabChange("summary")}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                        activeTab === "summary"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                      )}
                    >
                      Criteria
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Criteria breakdown, strength evaluation, and tier scoring</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleSubTabChange("planning")}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                        activeTab === "planning"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                      )}
                    >
                      Planning
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Gap analysis, filing strategy, and evidence roadmap</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Separator */}
            <div className="h-8 w-px bg-border/50 shrink-0 mb-1" />

            {/* Phase 2 group */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 pl-0.5">
                Phase 2
              </span>
              <div className="flex gap-1 p-1 rounded-lg bg-muted border border-border/50">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleSubTabChange("evidence")}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                        activeTab === "evidence"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                      )}
                    >
                      Evidence List
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Uploaded documents and evidence items</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleSubTabChange("routing")}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                        activeTab === "routing"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                      )}
                    >
                      Routing
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Document-to-criteria routing and scoring</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Separator */}
            <div className="h-8 w-px bg-border/50 shrink-0 mb-1" />

            {/* Phase 3 group */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 pl-0.5">
                Phase 3
              </span>
              <div className="flex gap-1 p-1 rounded-lg bg-muted border border-border/50">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleSubTabChange("consolidation")}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                        activeTab === "consolidation"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                      )}
                    >
                      Consolidation
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Consolidated analysis, strategy, and filing readiness</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Separator */}
            <div className="h-8 w-px bg-border/50 shrink-0 mb-1" />

            {/* Phase 4 group */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 pl-0.5">
                Phase 4
              </span>
              <div className="flex gap-1 p-1 rounded-lg bg-muted border border-border/50">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleSubTabChange("letters")}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                        activeTab === "letters"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                      )}
                    >
                      Letters
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Recommendation letter drafts and management</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleSubTabChange("denial")}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1",
                        activeTab === "denial"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                      )}
                    >
                      <ShieldAlert className="w-3 h-3" />
                      Risk
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Denial probability, red flags, and filing recommendation</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Separator */}
            <div className="h-8 w-px bg-border/50 shrink-0 mb-1" />

            {/* Raw Data - outside phase group */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleSubTabChange("raw")}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md transition-colors mb-1",
                    activeTab === "raw"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  Raw Data
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Raw extraction JSON from resume parsing</TooltipContent>
            </Tooltip>
          </div>
          </TooltipProvider>
        )}
      </div>

      {/* Tab content */}
      {activeTab === "summary" ? (
        <CriteriaTab
          caseId={caseId}
          criteriaContent={
            analysis.criteria.map((c) => {
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
                  docCount={analysis.docCountsByCriterion?.[c.criterionId] ?? 0}
                  docCountsByItem={analysis.docCountsByItem}
                  onNavigateToRouting={() => handleSubTabChange("routing")}
                  onCriterionUpdated={handleCriterionUpdated}
                  onFileDropped={refetchDocCounts}
                />
              )
            })
          }
          initialStrengthEvaluation={initialStrengthEvaluation}
        />
      ) : activeTab === "planning" ? (
        <PlanningTab
          caseId={caseId}
          initialGapAnalysis={initialGapAnalysis}
          initialCaseStrategy={initialCaseStrategy}
          hasStrengthEval={!!initialStrengthEvaluation}
        />
      ) : activeTab === "evidence" ? (
        <EvidenceListPanel
          caseId={caseId}
          extraction={analysis.extraction}
          criteriaNames={analysis.criteriaNames}
          criteriaSummary={analysis.criteria_summary}
          criteria={analysis.criteria}
          docCountsByCriterion={analysis.docCountsByCriterion}
          docCountsByItem={analysis.docCountsByItem}
          onFileDropped={refetchDocCounts}
          onDocumentsRouted={onDocumentsRouted}
        />
      ) : activeTab === "routing" ? (
        <CriteriaRoutingPanel caseId={caseId} />
      ) : activeTab === "consolidation" ? (
        <ConsolidationTab
          caseId={caseId}
          initialCaseConsolidation={initialCaseConsolidation}
          initialCaseStrategy={!!initialCaseStrategy}
        />
      ) : activeTab === "letters" ? (
        <div className="flex-1 overflow-y-auto">
          <LettersPanel caseId={caseId} onOpenDraft={onOpenDraft ?? (() => {})} denialProbability={initialDenialProbability} />
        </div>
      ) : activeTab === "denial" ? (
        <DenialProbabilityPanel
          caseId={caseId}
          initialData={initialDenialProbability}
          hasStrengthEval={!!initialStrengthEvaluation}
          hasGapAnalysis={!!initialGapAnalysis}
        />
      ) : (
        <ExtractionRawPanel extraction={analysis.extraction ?? null} />
      )}
    </div>
  )
}
