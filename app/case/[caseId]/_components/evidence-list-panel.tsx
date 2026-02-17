"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { CRITERIA_LABELS } from "@/lib/evidence-verification-schema"
import { CRITERIA_METADATA } from "@/lib/eb1a-extraction-schema"
import type { DetailedExtraction, CriteriaSummaryItem } from "@/lib/eb1a-extraction-schema"
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
  Loader2,
  Plus,
  ChevronDown,
} from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { RecommenderForm } from "./recommender-form"
import type { RecommenderData } from "./recommender-form"
import {
  RecommenderCard,
  LETTER_TYPES,
  type DocumentItem as LetterDocItem,
  type Recommender,
} from "./letters-panel"
import { CsvImportModal } from "./csv-import-modal"

// -- Types --

type Strength = "Strong" | "Weak" | "None"

interface CriterionResult {
  criterionId: string
  strength: Strength
  reason: string
  evidence: string[]
}

interface RoutedDocument {
  id: string
  documentId: string
  name: string
  category: string | null
  score: number
  recommendation: string
  autoRouted: boolean
}

interface CriterionRouting {
  criterion: string
  documents: RoutedDocument[]
}

interface RoutingData {
  routings: Record<string, CriterionRouting>
}

interface EvidenceListPanelProps {
  caseId: string
  extraction?: DetailedExtraction | null
  criteriaNames?: Record<string, string>
  criteriaSummary?: CriteriaSummaryItem[]
  criteria?: CriterionResult[]
  docCountsByCriterion?: Record<string, number>
  docCountsByItem?: Record<string, number>
  onFileDropped?: () => void
  onDocumentsRouted?: () => void
  onOpenDraft?: (doc?: { id?: string; name?: string; content?: string; recommenderId?: string; category?: string }) => void
}

// -- Shared utilities --

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

const EVIDENCE_CATEGORIES = [
  "publications", "awards", "patents", "memberships", "media_coverage",
  "judging_activities", "speaking_engagements", "grants", "leadership_roles",
  "compensation", "exhibitions", "commercial_success", "original_contributions",
] as const

type EvidenceCategory = (typeof EVIDENCE_CATEGORIES)[number]

const CRITERION_PRIMARY_CATEGORIES: Record<string, string[]> = {
  C1: ["awards"],
  C2: ["memberships"],
  C3: ["media_coverage"],
  C4: ["judging_activities"],
  C5: ["original_contributions", "patents", "grants"],
  C6: ["publications"],
  C7: ["exhibitions"],
  C8: ["leadership_roles"],
  C9: ["compensation"],
  C10: ["commercial_success"],
}

function getEvidenceForCriterion(
  extraction: DetailedExtraction,
  criterionId: string
): { category: EvidenceCategory; items: Record<string, unknown>[]; primary: boolean }[] {
  const primaryCats = CRITERION_PRIMARY_CATEGORIES[criterionId] ?? []
  const results: { category: EvidenceCategory; items: Record<string, unknown>[]; primary: boolean }[] = []
  for (const cat of EVIDENCE_CATEGORIES) {
    const arr = extraction[cat] as Record<string, unknown>[]
    if (!arr?.length) continue
    const matching = arr.filter((item) => {
      const mc = item.mapped_criteria as string[] | undefined
      return mc?.includes(criterionId)
    })
    if (matching.length > 0) {
      results.push({ category: cat, items: matching, primary: primaryCats.includes(cat) })
    }
  }
  return results
}

function ItemSummary({ item, category }: { item: Record<string, unknown>; category: EvidenceCategory }) {
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
    case "commercial_success":
      return <span>{item.description as string}</span>
    case "original_contributions":
      return <span>{item.description as string}</span>
    default:
      return <span>{JSON.stringify(item)}</span>
  }
}

function getStrengthConfig(strength: Strength) {
  switch (strength) {
    case "Strong":
      return {
        bg: "bg-emerald-500/5",
        border: "border-l-emerald-500",
        headerBg: "bg-emerald-500/10",
        badge: "bg-emerald-600 text-white",
        label: "Strong",
      }
    case "Weak":
      return {
        bg: "bg-amber-500/5",
        border: "border-l-amber-500",
        headerBg: "bg-amber-500/10",
        badge: "bg-amber-500 text-white",
        label: "Weak",
      }
    default:
      return {
        bg: "bg-muted/30",
        border: "border-l-muted-foreground/30",
        headerBg: "bg-muted/50",
        badge: "bg-muted-foreground/70 text-background",
        label: "None",
      }
  }
}

function getRecommendationColor(rec: string) {
  switch (rec) {
    case "STRONG": return "bg-emerald-600 text-white"
    case "INCLUDE_WITH_SUPPORT": return "bg-blue-600 text-white"
    case "NEEDS_MORE_DOCS": return "bg-amber-500 text-white"
    case "EXCLUDE": return "bg-red-600 text-white"
    default: return "bg-muted text-muted-foreground"
  }
}

function ScoreBar({ score }: { score: number }) {
  const pct = (score / 10) * 100
  const color = score >= 7 ? "bg-emerald-500" : score >= 5 ? "bg-amber-500" : "bg-red-500"
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground w-7 text-right">{score.toFixed(1)}</span>
    </div>
  )
}

// -- SSE processor (kept from original) --

function useSSEProcessor() {
  return useCallback(async (
    response: Response,
    onDocStarted?: (docId: string, name: string) => void,
    onCriterionComplete?: (docId: string, criterion: string, result: Record<string, unknown>) => void,
    onDocComplete?: (docId: string) => void,
  ) => {
    const reader = response.body?.getReader()
    if (!reader) return

    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue
        try {
          const event = JSON.parse(line.slice(6))
          if (event.type === "doc_started") {
            onDocStarted?.(event.documentId, event.name)
          }
          if (event.type === "criterion_complete") {
            onCriterionComplete?.(event.documentId, event.criterion, event.result)
          }
          if (event.type === "doc_complete") {
            onDocComplete?.(event.documentId)
          }
        } catch {
          // partial JSON
        }
      }
    }
  }, [])
}

// -- EvidenceCriterionCard --

function EvidenceCriterionCard({
  criterionId,
  criterion,
  extraction,
  criteriaSummary,
  criteriaNames,
  docCountsByItem,
  routedDocs,
  caseId,
  onFileDropped,
}: {
  criterionId: string
  criterion?: CriterionResult
  extraction?: DetailedExtraction | null
  criteriaSummary?: CriteriaSummaryItem
  criteriaNames?: Record<string, string>
  docCountsByItem?: Record<string, number>
  routedDocs: RoutedDocument[]
  caseId: string
  onFileDropped?: () => void
}) {
  const strength = criterion?.strength ?? "None"
  const config = getStrengthConfig(strength)
  const meta = CRITERIA_METADATA[criterionId as keyof typeof CRITERIA_METADATA]
  const displayName = criteriaNames?.[criterionId] ?? meta?.name ?? criterionId
  const fullName = CRITERIA_LABELS[criterionId] ?? displayName
  const extractionGroups = extraction ? getEvidenceForCriterion(extraction, criterionId) : []
  const totalItems = extractionGroups.reduce((sum, g) => sum + g.items.length, 0)

  const [expanded, setExpanded] = useState(strength !== "None" || routedDocs.length > 0)
  const [dragOver, setDragOver] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set())

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
      formData.append("criterionId", criterionId)

      const res = await fetch(`/api/case/${caseId}/criterion`, {
        method: "POST",
        body: formData,
      })
      if (!res.ok) throw new Error("Evaluation failed")
      const data = await res.json()

      // Post-drop feedback toast
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
          toast(`Partially relevant for ${displayName}`, {
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
              : "May be better suited for a different criterion",
            duration: 8000,
          })
        }
      }

      onFileDropped?.()
    } catch (err) {
      console.error("Criterion file eval error:", err)
      toast.error("Failed to evaluate dropped file")
    } finally {
      setEvaluating(false)
    }
  }, [caseId, criterionId, evaluating, displayName, onFileDropped])

  const toggleDocExpanded = useCallback((docId: string) => {
    setExpandedDocs((prev) => {
      const next = new Set(prev)
      if (next.has(docId)) next.delete(docId)
      else next.add(docId)
      return next
    })
  }, [])

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
          <span className="text-xs font-medium text-primary">Drop to evaluate for {criterionId}</span>
        </div>
      )}

      {/* Evaluating overlay */}
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
        <span className="text-xs font-bold text-muted-foreground shrink-0">{criterionId}</span>
        <span className="text-sm font-semibold text-stone-800 dark:text-stone-200 truncate flex-1 min-w-0">
          {fullName}
        </span>
        <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0", config.badge)}>
          {config.label}
        </span>
        {routedDocs.length > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300 shrink-0">
            <FileText className="w-3 h-3" />
            {routedDocs.length} {routedDocs.length === 1 ? "doc" : "docs"}
          </span>
        )}
        {totalItems > 0 && (
          <span className="text-[11px] text-muted-foreground shrink-0">{totalItems} items</span>
        )}
        <svg
          className={cn("w-4 h-4 text-muted-foreground shrink-0 transition-transform", expanded && "rotate-180")}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-3">
          {/* Supporting extraction items -- primary */}
          {extractionGroups.filter(g => g.primary).length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Supporting Items</span>
              {extractionGroups.filter(g => g.primary).map(({ category, items }) => {
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
                        <div key={j} className="flex items-center gap-1.5 text-xs text-foreground/80 pl-4 py-0.5">
                          <span className="flex-1"><ItemSummary item={item} category={category} /></span>
                          {itemDocCount > 0 ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 shrink-0">
                              <FileText className="w-2.5 h-2.5" />
                              Evidence in Vault
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded-full text-[10px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 shrink-0">
                              Evidence Required
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}

          {/* Cross-criterion items -- "Also relevant" */}
          {(() => {
            const crossGroups = extractionGroups.filter(g => !g.primary)
            const crossCount = crossGroups.reduce((n, g) => n + g.items.length, 0)
            if (crossCount === 0) return null
            return (
              <Collapsible>
                <CollapsibleTrigger className="group/also flex items-center gap-1.5 w-full text-left py-1">
                  <svg
                    className="w-3 h-3 text-muted-foreground/50 transition-transform group-data-[state=open]/also:rotate-90"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                    Also relevant
                  </span>
                  <span className="text-[10px] text-muted-foreground/40">{crossCount}</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-1 pt-0.5 pl-1 border-l border-dashed border-border ml-1">
                    {crossGroups.map(({ category, items }) => {
                      const catConf = CATEGORY_CONFIG[category]
                      if (!catConf) return null
                      const Icon = catConf.icon
                      return (
                        <div key={category} className="space-y-0.5">
                          <div className="flex items-center gap-1 pl-2">
                            <Icon className="w-2.5 h-2.5 text-muted-foreground/40" />
                            <span className="text-[10px] font-medium text-muted-foreground/50">{catConf.label}</span>
                          </div>
                          {items.map((item, j) => {
                            const itemId = item.id as string | undefined
                            const itemDocCount = itemId ? (docCountsByItem?.[itemId] ?? 0) : 0
                            return (
                              <div key={j} className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 pl-5 py-px">
                                <span className="flex-1"><ItemSummary item={item} category={category} /></span>
                                {itemDocCount > 0 ? (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded-full text-[10px] font-medium bg-emerald-100/60 text-emerald-600/70 dark:bg-emerald-900/20 dark:text-emerald-400/60 shrink-0">
                                    <FileText className="w-2.5 h-2.5" />
                                    Evidence in Vault
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded-full text-[10px] font-medium bg-orange-100/60 text-orange-600/70 dark:bg-orange-900/20 dark:text-orange-400/60 shrink-0">
                                    Evidence Required
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )
          })()}

          {/* Routed documents */}
          {routedDocs.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Routed Documents</span>
              <div className="space-y-1">
                {routedDocs.map((doc) => {
                  const isExpanded = expandedDocs.has(doc.id)
                  return (
                    <div key={doc.id} className="rounded border border-border/50 overflow-hidden">
                      <button
                        onClick={() => toggleDocExpanded(doc.id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-muted/30 transition-colors"
                      >
                        <svg className="w-3 h-3 text-muted-foreground shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round" />
                          <polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="text-xs text-stone-700 dark:text-stone-300 truncate flex-1 min-w-0">
                          {doc.name}
                        </span>
                        <div className="w-16 shrink-0">
                          <ScoreBar score={doc.score} />
                        </div>
                        <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 uppercase tracking-wide", getRecommendationColor(doc.recommendation))}>
                          {doc.recommendation.replace(/_/g, " ")}
                        </span>
                        <svg
                          className={cn("w-3 h-3 text-muted-foreground shrink-0 transition-transform", isExpanded && "rotate-180")}
                          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        >
                          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      {isExpanded && (
                        <div className="px-2 pb-2 pt-1 border-t border-border/30 text-xs space-y-1.5">
                          <p className="text-[10px] text-muted-foreground italic">
                            {doc.autoRouted ? "Auto-routed" : "Manually routed"} -- Score: {doc.score.toFixed(1)}/10
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {extractionGroups.length === 0 && routedDocs.length === 0 && (
            <div className="text-center py-3">
              <p className="text-xs text-muted-foreground italic">No supporting items or documents yet</p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">Drop a file here to evaluate for {criterionId}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// -- Main panel --

export function EvidenceListPanel({
  caseId,
  extraction,
  criteriaNames,
  criteriaSummary,
  criteria,
  docCountsByCriterion,
  docCountsByItem,
  onFileDropped,
  onDocumentsRouted,
  onOpenDraft,
}: EvidenceListPanelProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadDragOver, setUploadDragOver] = useState(false)
  const [routingData, setRoutingData] = useState<RoutingData | null>(null)
  const [streamingDocs, setStreamingDocs] = useState<Set<string>>(new Set())
  const [showAddRecommender, setShowAddRecommender] = useState(false)
  const [showCsvImport, setShowCsvImport] = useState(false)
  const [recommendersOpen, setRecommendersOpen] = useState(true)
  const [evidenceOpen, setEvidenceOpen] = useState(true)
  const [recommenders, setRecommenders] = useState<Recommender[]>([])
  const [recLetterDocs, setRecLetterDocs] = useState<LetterDocItem[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const processSSE = useSSEProcessor()

  const allCriteria = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10"]

  // Fetch routing data
  const fetchRouting = useCallback(async () => {
    try {
      const res = await fetch(`/api/case/${caseId}/criteria-routing`)
      if (res.ok) {
        const json = await res.json()
        setRoutingData(json)
      }
    } catch (err) {
      console.error("Failed to load routing data:", err)
    }
  }, [caseId])

  // Fetch recommenders + recommendation letter docs
  const fetchRecommenderData = useCallback(async () => {
    try {
      const [recRes, docsRes] = await Promise.all([
        fetch(`/api/case/${caseId}/recommenders`),
        fetch(`/api/case/${caseId}/documents`),
      ])
      if (recRes.ok) setRecommenders(await recRes.json())
      if (docsRes.ok) {
        const docs: LetterDocItem[] = await docsRes.json()
        setRecLetterDocs(docs.filter((d) => d.category === "RECOMMENDATION_LETTER"))
      }
    } catch (err) {
      console.error("Failed to load recommender data:", err)
    }
  }, [caseId])

  const getDocsForRecommender = useCallback(
    (recommenderId: string) =>
      recLetterDocs.filter((d) => d.recommenderId === recommenderId),
    [recLetterDocs]
  )

  const handleRecommenderSaved = useCallback((_rec: RecommenderData) => {
    setShowAddRecommender(false)
    fetchRecommenderData()
  }, [fetchRecommenderData])

  useEffect(() => {
    fetchRouting()
    fetchRecommenderData()
  }, [fetchRouting, fetchRecommenderData])

  // Global upload handler (full C1-C10 verification via SSE)
  const handleUpload = useCallback(async (files: FileList | File[]) => {
    if (isUploading || !files.length) return
    setIsUploading(true)

    try {
      const formData = new FormData()
      for (const file of Array.from(files)) {
        formData.append("files", file)
      }

      const res = await fetch(`/api/case/${caseId}/evidence-verify`, {
        method: "POST",
        body: formData,
      })

      if (!res.ok) throw new Error("Upload failed")

      await processSSE(
        res,
        (docId) => {
          setStreamingDocs((prev) => new Set(prev).add(docId))
        },
        () => { /* criterion_complete - no-op, badges update via refetch */ },
        (docId) => {
          setStreamingDocs((prev) => {
            const next = new Set(prev)
            next.delete(docId)
            return next
          })
        },
      )

      // After SSE complete, refresh routing + doc counts
      await fetchRouting()
      onFileDropped?.()
      onDocumentsRouted?.()
    } catch (err) {
      console.error("Evidence upload error:", err)
      toast.error("Upload failed")
    } finally {
      setIsUploading(false)
    }
  }, [caseId, isUploading, processSSE, fetchRouting, onFileDropped, onDocumentsRouted])

  // Per-criterion file dropped: refetch routing + doc counts
  const handleCriterionFileDropped = useCallback(async () => {
    await fetchRouting()
    onFileDropped?.()
  }, [fetchRouting, onFileDropped])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Upload bar -- global drop zone for all C1-C10 */}
      <div className="shrink-0 p-3 border-b border-border">
        <div
          onDragOver={(e) => { e.preventDefault(); setUploadDragOver(true) }}
          onDragLeave={(e) => { e.preventDefault(); setUploadDragOver(false) }}
          onDrop={(e) => {
            e.preventDefault()
            setUploadDragOver(false)
            if (e.dataTransfer.files.length > 0) handleUpload(e.dataTransfer.files)
          }}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-lg p-3 text-center transition-colors",
            isUploading
              ? "border-primary/50 bg-primary/5 pointer-events-none"
              : uploadDragOver
                ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                : "border-border hover:border-muted-foreground/50 cursor-pointer",
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.md,.csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) handleUpload(e.target.files)
              e.target.value = ""
            }}
          />
          {isUploading ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
              <span className="text-xs text-muted-foreground">
                Uploading & verifying all criteria...
                {streamingDocs.size > 0 && ` (${streamingDocs.size} doc${streamingDocs.size > 1 ? "s" : ""})`}
              </span>
            </div>
          ) : (
            <>
              <svg className="w-5 h-5 mx-auto text-muted-foreground mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="text-xs text-muted-foreground">
                {uploadDragOver ? "Drop to upload & auto-classify all C1-C10" : "Drop evidence files or click to upload"}
              </p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">PDF, DOCX, TXT, MD, CSV, XLSX -- auto-verified against C1-C10</p>
            </>
          )}
        </div>

      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Recommendation Letters section */}
        <div className="border-b border-border">
          <button
            onClick={() => setRecommendersOpen(!recommendersOpen)}
            className="sticky top-0 z-10 bg-background w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors border-b border-border"
          >
            <ChevronDown
              className={cn(
                "w-4 h-4 text-muted-foreground transition-transform",
                !recommendersOpen && "-rotate-90"
              )}
            />
            <span className="text-sm font-semibold">Recommendation Letters</span>
          </button>
          {recommendersOpen && (
            <div className="p-3">
              {(() => {
                const recLetterType = LETTER_TYPES.find((lt) => lt.key === "recommendation")!
                return (
                  <RecommenderCard
                    letterType={recLetterType}
                    recommenders={recommenders}
                    allRecDocs={recLetterDocs}
                    getDocsForRecommender={getDocsForRecommender}
                    caseId={caseId}
                    onOpenDraft={onOpenDraft ?? (() => {})}
                    onAddRecommender={() => setShowAddRecommender(true)}
                    onImportCsv={() => setShowCsvImport(true)}
                    onUploaded={fetchRecommenderData}
                  />
                )
              })()}
            </div>
          )}
        </div>

        {/* Evidence by Criterion section */}
        <div className="border-b border-border">
          <button
            onClick={() => setEvidenceOpen(!evidenceOpen)}
            className="sticky top-0 z-10 bg-background w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors border-b border-border"
          >
            <ChevronDown
              className={cn(
                "w-4 h-4 text-muted-foreground transition-transform",
                !evidenceOpen && "-rotate-90"
              )}
            />
            <span className="text-sm font-semibold">Evidence by Criterion</span>
          </button>
          {evidenceOpen && (
            <div className="p-3 space-y-3">
              {[...allCriteria].sort((a, b) => {
                const order: Record<string, number> = { Strong: 0, Weak: 1, None: 2 }
                const sa = criteria?.find((c) => c.criterionId === a)?.strength ?? "None"
                const sb = criteria?.find((c) => c.criterionId === b)?.strength ?? "None"
                return (order[sa] ?? 2) - (order[sb] ?? 2)
              }).map((cId) => {
                const criterion = criteria?.find((c) => c.criterionId === cId)
                const cs = criteriaSummary?.find((s) => s.criterion_id === cId)
                const routedDocs = routingData?.routings?.[cId]?.documents ?? []

                return (
                  <EvidenceCriterionCard
                    key={cId}
                    criterionId={cId}
                    criterion={criterion}
                    extraction={extraction}
                    criteriaSummary={cs}
                    criteriaNames={criteriaNames}
                    docCountsByItem={docCountsByItem}
                    routedDocs={routedDocs}
                    caseId={caseId}
                    onFileDropped={handleCriterionFileDropped}
                  />
                )
              })}
            </div>
          )}
        </div>
      </div>

      <Dialog open={showAddRecommender} onOpenChange={setShowAddRecommender}>
        <DialogContent className="sm:max-w-lg p-0 gap-0 max-h-[85vh] overflow-hidden" showCloseButton={false}>
          <DialogTitle className="sr-only">Add Recommender</DialogTitle>
          <RecommenderForm
            caseId={caseId}
            onSave={handleRecommenderSaved}
            onCancel={() => setShowAddRecommender(false)}
          />
        </DialogContent>
      </Dialog>

      <CsvImportModal
        caseId={caseId}
        open={showCsvImport}
        onOpenChange={setShowCsvImport}
        onImported={fetchRecommenderData}
      />
    </div>
  )
}
