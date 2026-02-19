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
  Upload,
  Trash2,
  Stamp,
  BookOpen,
  ClipboardCheck,
  Plane,
  CreditCard,
  Globe,
  Mail,
  AlertTriangle,
  Reply,
  Fingerprint,
  ArrowRightLeft,
  CalendarCheck,
  FilePlus,
  Camera,
  Heart,
  ShieldCheck,
  Briefcase,
  Receipt,
  GraduationCap,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
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
        bg: "bg-emerald-50 dark:bg-emerald-950/40",
        border: "border-l-emerald-500",
        headerBg: "bg-emerald-100/80 dark:bg-emerald-900/50",
        badge: "bg-emerald-600 text-white",
        badgeRing: "ring-1 ring-emerald-700/20",
        label: "Strong",
        idColor: "text-emerald-700 dark:text-emerald-400",
      }
    case "Weak":
      return {
        bg: "bg-amber-50 dark:bg-amber-950/30",
        border: "border-l-amber-500",
        headerBg: "bg-amber-100/70 dark:bg-amber-900/40",
        badge: "bg-amber-500 text-white",
        badgeRing: "ring-1 ring-amber-600/20",
        label: "Weak",
        idColor: "text-amber-700 dark:text-amber-400",
      }
    default:
      return {
        bg: "bg-muted/50",
        border: "border-l-stone-300 dark:border-l-stone-600",
        headerBg: "bg-stone-100 dark:bg-stone-800/60",
        badge: "bg-stone-400 dark:bg-stone-600 text-white",
        badgeRing: "ring-1 ring-stone-500/20",
        label: "None",
        idColor: "text-stone-500 dark:text-stone-400",
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
      <div className="flex-1 h-1.5 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-foreground/70 w-7 text-right">{score.toFixed(1)}</span>
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
        "rounded-lg border-l-[3px] border border-border overflow-hidden transition-all relative shadow-xs",
        config.border, config.bg,
        dragOver && "ring-2 ring-primary/40 border-primary",
      )}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div className="absolute inset-0 z-10 bg-primary/10 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2 bg-primary/90 text-primary-foreground px-3 py-1.5 rounded-md shadow-sm">
            <Upload className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Drop to evaluate for {criterionId}</span>
          </div>
        </div>
      )}

      {/* Evaluating overlay */}
      {evaluating && (
        <div className="absolute inset-0 z-10 bg-background/70 backdrop-blur-[2px] flex items-center justify-center">
          <div className="flex items-center gap-2 bg-card px-3 py-1.5 rounded-md shadow-sm border">
            <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
            <span className="text-xs font-medium text-foreground">Evaluating...</span>
          </div>
        </div>
      )}

      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors",
          "hover:brightness-95 dark:hover:brightness-110",
          config.headerBg,
        )}
      >
        <span className={cn("text-[11px] font-extrabold tracking-tight shrink-0 font-mono", config.idColor)}>
          {criterionId}
        </span>
        <span className="text-[13px] font-semibold text-foreground truncate flex-1 min-w-0">
          {fullName}
        </span>
        <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 tracking-wide", config.badge, config.badgeRing)}>
          {config.label}
        </span>
        {routedDocs.length > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200 shrink-0 ring-1 ring-teal-200 dark:ring-teal-800">
            <FileText className="w-3 h-3" />
            {routedDocs.length}
          </span>
        )}
        {totalItems > 0 && (
          <span className="text-[11px] font-medium text-foreground/60 shrink-0">{totalItems} items</span>
        )}
        <ChevronDown
          className={cn("w-4 h-4 text-foreground/40 shrink-0 transition-transform", expanded && "rotate-180")}
        />
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 pt-2 space-y-3">
          {/* Supporting extraction items -- primary */}
          {extractionGroups.filter(g => g.primary).length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/50">Supporting Items</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              {extractionGroups.filter(g => g.primary).map(({ category, items }) => {
                const catConf = CATEGORY_CONFIG[category]
                if (!catConf) return null
                const Icon = catConf.icon
                return (
                  <div key={category} className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 text-foreground/50" />
                      <span className="text-[11px] font-semibold text-foreground/70">{catConf.label}</span>
                    </div>
                    {items.map((item, j) => {
                      const itemId = item.id as string | undefined
                      const itemDocCount = itemId ? (docCountsByItem?.[itemId] ?? 0) : 0
                      return (
                        <div key={j} className="flex items-start gap-2 text-xs text-foreground/80 pl-5 py-1 rounded-md hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                          <span className="flex-1 leading-relaxed"><ItemSummary item={item} category={category} /></span>
                          {itemDocCount > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200 shrink-0 ring-1 ring-emerald-200 dark:ring-emerald-800">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              In Vault
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200 shrink-0 ring-1 ring-orange-200 dark:ring-orange-800">
                              <AlertCircle className="w-2.5 h-2.5" />
                              Required
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
                <CollapsibleTrigger className="group/also flex items-center gap-1.5 w-full text-left py-1.5 rounded-md px-1 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors">
                  <ChevronRight
                    className="w-3 h-3 text-foreground/40 transition-transform group-data-[state=open]/also:rotate-90"
                  />
                  <span className="text-[10px] font-semibold text-foreground/45 uppercase tracking-wider">
                    Also relevant
                  </span>
                  <span className="text-[10px] font-medium text-foreground/35 bg-muted rounded-full px-1.5">{crossCount}</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-1 pt-1 pl-2 border-l-2 border-border ml-1.5">
                    {crossGroups.map(({ category, items }) => {
                      const catConf = CATEGORY_CONFIG[category]
                      if (!catConf) return null
                      const Icon = catConf.icon
                      return (
                        <div key={category} className="space-y-0.5">
                          <div className="flex items-center gap-1.5 pl-2">
                            <Icon className="w-3 h-3 text-foreground/35" />
                            <span className="text-[10px] font-medium text-foreground/45">{catConf.label}</span>
                          </div>
                          {items.map((item, j) => {
                            const itemId = item.id as string | undefined
                            const itemDocCount = itemId ? (docCountsByItem?.[itemId] ?? 0) : 0
                            return (
                              <div key={j} className="flex items-center gap-1.5 text-[11px] text-foreground/50 pl-5 py-0.5">
                                <span className="flex-1"><ItemSummary item={item} category={category} /></span>
                                {itemDocCount > 0 ? (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded-md text-[9px] font-semibold bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 shrink-0">
                                    <CheckCircle2 className="w-2 h-2" />
                                    In Vault
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded-md text-[9px] font-semibold bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 shrink-0">
                                    Required
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
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/50">Routed Documents</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-1.5">
                {routedDocs.map((doc) => {
                  const isExpanded = expandedDocs.has(doc.id)
                  return (
                    <div key={doc.id} className="rounded-md border border-border bg-card overflow-hidden shadow-xs">
                      <button
                        onClick={() => toggleDocExpanded(doc.id)}
                        className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-muted/50 transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5 text-foreground/40 shrink-0" />
                        <span className="text-xs font-medium text-foreground truncate flex-1 min-w-0">
                          {doc.name}
                        </span>
                        <div className="w-16 shrink-0">
                          <ScoreBar score={doc.score} />
                        </div>
                        <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 uppercase tracking-wide", getRecommendationColor(doc.recommendation))}>
                          {doc.recommendation.replace(/_/g, " ")}
                        </span>
                        <ChevronDown
                          className={cn("w-3.5 h-3.5 text-foreground/40 shrink-0 transition-transform", isExpanded && "rotate-180")}
                        />
                      </button>
                      {isExpanded && (
                        <div className="px-2.5 pb-2 pt-1 border-t border-border text-xs space-y-1.5 bg-muted/30">
                          <p className="text-[11px] text-foreground/60">
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
            <div className="text-center py-4 border border-dashed border-border rounded-lg bg-muted/30">
              <p className="text-xs font-medium text-foreground/50">No supporting items or documents yet</p>
              <p className="text-[11px] text-foreground/35 mt-1">Drop a file here to evaluate for {criterionId}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// -- Immigration Documents --

const IMMIGRATION_DOC_TYPES = [
  // Identity & Status
  { category: 'PASSPORT_ID', label: 'Passport', description: 'Valid passport bio page', group: 'identity', icon: FileText },
  { category: 'I20', label: 'I-20', description: 'Certificate of Eligibility', group: 'identity', icon: BookOpen },
  { category: 'VISA_STAMP', label: 'Visa Stamps', description: 'US visa stamps from passport', group: 'identity', icon: Stamp },
  { category: 'DS2019', label: 'DS-2019', description: 'Certificate of Eligibility (J-1)', group: 'identity', icon: BookOpen },
  { category: 'EAD_CARD', label: 'EAD Card', description: 'Employment Authorization Document', group: 'identity', icon: CreditCard },
  { category: 'NATIONAL_ID', label: 'National ID', description: 'Government-issued national ID card', group: 'identity', icon: Globe },
  { category: 'I94', label: 'I-94', description: 'Arrival/Departure record', group: 'identity', icon: Plane },
  // Core Petition Forms
  { category: 'I140', label: 'I-140', description: 'Immigrant Petition for Alien Workers', group: 'petition_forms', icon: FileText },
  { category: 'I907', label: 'I-907', description: 'Request for Premium Processing', group: 'petition_forms', icon: FileText },
  { category: 'G28', label: 'G-28', description: 'Notice of Entry of Appearance as Attorney', group: 'petition_forms', icon: FileText },
  { category: 'G1145', label: 'G-1145', description: 'E-Notification of Application Acceptance', group: 'petition_forms', icon: Mail },
  { category: 'COVER_LETTER', label: 'Cover Letter', description: 'Petition cover letter', group: 'petition_forms', icon: FileText },
  { category: 'G1450', label: 'G-1450', description: 'Authorization for Credit Card Payment', group: 'petition_forms', icon: CreditCard },
  // USCIS Notices
  { category: 'I797_APPROVAL', label: 'I-797 Approval', description: 'USCIS approval notice', group: 'uscis_notices', icon: ClipboardCheck },
  { category: 'I797C_RECEIPT', label: 'I-797C Receipt', description: 'USCIS receipt notice', group: 'uscis_notices', icon: Receipt },
  { category: 'I797E_RFE', label: 'I-797E RFE', description: 'Request for Evidence notice', group: 'uscis_notices', icon: AlertTriangle },
  { category: 'RFE_RESPONSE', label: 'RFE Response', description: 'Response to Request for Evidence', group: 'uscis_notices', icon: Reply },
  { category: 'NOID', label: 'NOID', description: 'Notice of Intent to Deny', group: 'uscis_notices', icon: AlertTriangle },
  { category: 'TRANSFER_NOTICE', label: 'Transfer Notice', description: 'Case transfer notification', group: 'uscis_notices', icon: ArrowRightLeft },
  { category: 'INTERVIEW_NOTICE', label: 'Interview Notice', description: 'Interview scheduling notice', group: 'uscis_notices', icon: CalendarCheck },
  { category: 'BIOMETRICS_NOTICE', label: 'Biometrics Notice', description: 'Biometrics appointment notice', group: 'uscis_notices', icon: Fingerprint },
  // Adjustment of Status
  { category: 'I485', label: 'I-485', description: 'Application to Register Permanent Residence', group: 'adjustment', icon: FilePlus },
  { category: 'I485_SUPPLEMENT_J', label: 'I-485 Supp J', description: 'Confirmation of Bona Fide Job Offer', group: 'adjustment', icon: FilePlus },
  { category: 'I765', label: 'I-765', description: 'Application for Employment Authorization', group: 'adjustment', icon: FileText },
  { category: 'I131', label: 'I-131', description: 'Application for Travel Document', group: 'adjustment', icon: Plane },
  { category: 'PASSPORT_PHOTOS', label: 'Passport Photos', description: 'USCIS-compliant passport photos', group: 'adjustment', icon: Camera },
  // Civil Documents
  { category: 'BIRTH_CERTIFICATE', label: 'Birth Certificate', description: 'Certified birth certificate', group: 'civil', icon: FileText },
  { category: 'MARRIAGE_CERTIFICATE', label: 'Marriage Certificate', description: 'Certified marriage certificate', group: 'civil', icon: Heart },
  { category: 'DIVORCE_DECREE', label: 'Divorce Decree', description: 'Final divorce decree', group: 'civil', icon: FileText },
  { category: 'NAME_CHANGE_ORDER', label: 'Name Change Order', description: 'Court-ordered name change', group: 'civil', icon: FileText },
  // Medical
  { category: 'I693', label: 'I-693', description: 'Report of Medical Examination', group: 'medical', icon: ShieldCheck },
  { category: 'VACCINATION_RECORDS', label: 'Vaccination Records', description: 'Immunization history', group: 'medical', icon: ShieldCheck },
  // Employment / Financial
  { category: 'EMPLOYMENT_VERIFICATION', label: 'Employment Verification', description: 'Employment verification letter', group: 'employment', icon: Briefcase },
  { category: 'EMPLOYMENT_CONTRACT', label: 'Employment Contract', description: 'Signed employment contract', group: 'employment', icon: Briefcase },
  { category: 'OFFER_LETTER', label: 'Offer Letter', description: 'Job offer letter', group: 'employment', icon: Mail },
  { category: 'TAX_RETURNS', label: 'Tax Returns', description: 'Federal/state tax returns', group: 'employment', icon: Receipt },
  { category: 'W2_FORMS', label: 'W-2 Forms', description: 'W-2 wage and tax statements', group: 'employment', icon: Receipt },
  { category: 'PAY_STUBS', label: 'Pay Stubs', description: 'Recent pay stubs', group: 'employment', icon: Receipt },
  { category: 'SALARY_DOCUMENTATION', label: 'Salary Documentation', description: 'Other salary/compensation evidence', group: 'employment', icon: DollarSign },
  // Petition Support
  { category: 'RESUME_CV', label: 'Resume / CV', description: 'Resume or curriculum vitae', group: 'petition_support', icon: FileText },
  { category: 'EXECUTIVE_RESUME', label: 'Executive Resume', description: 'Executive-format resume', group: 'petition_support', icon: FileText },
  { category: 'PERSONAL_STATEMENT', label: 'Personal Statement', description: 'Personal statement or declaration', group: 'petition_support', icon: FileText },
  { category: 'CREDENTIAL_EVALUATION', label: 'Credential Evaluation', description: 'Foreign credential evaluation report', group: 'petition_support', icon: GraduationCap },
  { category: 'DEGREE_CERTIFICATE', label: 'Degree Certificate', description: 'Academic degree or diploma', group: 'petition_support', icon: GraduationCap },
  { category: 'PROFESSIONAL_LICENSE', label: 'Professional License', description: 'Professional license or certification', group: 'petition_support', icon: ShieldCheck },
  { category: 'USCIS_ADVISORY_LETTER', label: 'Advisory Letter', description: 'USCIS advisory or expert opinion letter', group: 'petition_support', icon: FileText },
] as const

const IMMIGRATION_GROUPS = [
  { key: 'identity', label: 'Identity & Status' },
  { key: 'petition_forms', label: 'Core Petition Forms' },
  { key: 'uscis_notices', label: 'USCIS Notices' },
  { key: 'adjustment', label: 'Adjustment of Status' },
  { key: 'civil', label: 'Civil Documents' },
  { key: 'medical', label: 'Medical' },
  { key: 'employment', label: 'Employment / Financial' },
  { key: 'petition_support', label: 'Petition Support' },
] as const

const IMMIGRATION_CATEGORIES = IMMIGRATION_DOC_TYPES.map(d => d.category)

function ImmigrationDocCard({
  docType,
  docs,
  caseId,
  onUploaded,
}: {
  docType: typeof IMMIGRATION_DOC_TYPES[number]
  docs: LetterDocItem[]
  caseId: string
  onUploaded: () => void
}) {
  const Icon = docType.icon
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('category', docType.category)
      const res = await fetch(`/api/case/${caseId}/documents`, {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        toast.success(`Uploaded ${file.name}`)
        onUploaded()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Upload failed')
      }
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (docId: string) => {
    setDeleting(docId)
    try {
      const res = await fetch(`/api/case/${caseId}/documents/${docId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Deleted')
        onUploaded()
      } else {
        toast.error('Delete failed')
      }
    } catch {
      toast.error('Delete failed')
    } finally {
      setDeleting(null)
    }
  }

  const hasUploads = docs.length > 0

  return (
    <div
      className={cn(
        'rounded-md border overflow-hidden transition-all',
        hasUploads
          ? 'border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20'
          : 'border-border bg-card',
        dragOver && 'border-primary ring-1 ring-primary/30 bg-primary/5'
      )}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file) handleUpload(file)
      }}
    >
      <div className="flex items-center gap-2.5 px-3 py-2">
        <div className={cn(
          "w-7 h-7 rounded-md flex items-center justify-center shrink-0",
          hasUploads
            ? "bg-emerald-100 dark:bg-emerald-900/50"
            : "bg-stone-100 dark:bg-stone-800"
        )}>
          <Icon className={cn(
            "w-3.5 h-3.5",
            hasUploads
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-foreground/50"
          )} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-semibold text-foreground">{docType.label}</h4>
          <p className="text-[10px] text-foreground/50 truncate">{docType.description}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {docs.length > 0 && (
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 rounded-full px-2 py-0.5">
              {docs.length}
            </span>
          )}
          <button
            className={cn(
              "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors disabled:opacity-50",
              "border border-border hover:bg-muted hover:border-foreground/20 text-foreground/70 hover:text-foreground"
            )}
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Upload className="w-3 h-3" />
            )}
            Upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.docx,.doc"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleUpload(file)
              e.target.value = ''
            }}
          />
        </div>
      </div>
      {docs.length > 0 && (
        <div className="px-3 pb-2 space-y-1">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/60 dark:bg-white/5 border border-border/50 group">
              <FileText className="w-3 h-3 text-foreground/40 shrink-0" />
              <span className="text-[11px] font-medium text-foreground/80 truncate flex-1 min-w-0">{doc.name}</span>
              <button
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-destructive/10 text-foreground/40 hover:text-destructive disabled:opacity-50"
                disabled={deleting === doc.id}
                onClick={() => handleDelete(doc.id)}
              >
                {deleting === doc.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3" />
                )}
              </button>
            </div>
          ))}
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
  const [immigrationDocsOpen, setImmigrationDocsOpen] = useState(true)
  const [evidenceOpen, setEvidenceOpen] = useState(true)
  const [recommenders, setRecommenders] = useState<Recommender[]>([])
  const [recLetterDocs, setRecLetterDocs] = useState<LetterDocItem[]>([])
  const [immigrationDocs, setImmigrationDocs] = useState<LetterDocItem[]>([])
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
        setImmigrationDocs(docs.filter((d) => d.category && IMMIGRATION_CATEGORIES.includes(d.category as typeof IMMIGRATION_CATEGORIES[number])))
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
      <div
        className={cn(
          "shrink-0 transition-all",
          isUploading
            ? "bg-primary/5 border-b-2 border-primary/40"
            : uploadDragOver
              ? "bg-primary/8 border-b-2 border-primary"
              : "border-b border-border hover:bg-muted/40",
        )}
        onDragOver={(e) => { e.preventDefault(); setUploadDragOver(true) }}
        onDragLeave={(e) => { e.preventDefault(); setUploadDragOver(false) }}
        onDrop={(e) => {
          e.preventDefault()
          setUploadDragOver(false)
          if (e.dataTransfer.files.length > 0) handleUpload(e.dataTransfer.files)
        }}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInputRef.current?.click() } }}
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
        <div className="flex items-center gap-3 px-4 py-3 cursor-pointer">
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
              <div className="flex-1">
                <span className="text-xs font-medium text-foreground">
                  Verifying against C1-C10...
                </span>
                {streamingDocs.size > 0 && (
                  <span className="text-[11px] text-foreground/60 ml-2">
                    ({streamingDocs.size} doc{streamingDocs.size > 1 ? "s" : ""} processing)
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <div className={cn(
                "w-8 h-8 rounded-lg border-2 border-dashed flex items-center justify-center transition-colors",
                uploadDragOver
                  ? "border-primary bg-primary/10"
                  : "border-foreground/20 bg-muted/50"
              )}>
                <Upload className={cn("w-4 h-4", uploadDragOver ? "text-primary" : "text-foreground/40")} />
              </div>
              <div className="flex-1">
                <span className={cn(
                  "text-xs font-medium",
                  uploadDragOver ? "text-primary" : "text-foreground/70"
                )}>
                  {uploadDragOver ? "Drop to upload & auto-classify" : "Drop evidence files or click to upload"}
                </span>
                <span className="text-[10px] text-foreground/40 hidden sm:inline ml-2">PDF, DOCX, TXT, MD, CSV, XLSX</span>
              </div>
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
            className="sticky top-0 z-10 bg-stone-50 dark:bg-stone-900/50 w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-stone-100 dark:hover:bg-stone-800/50 transition-colors border-b border-border"
          >
            <ChevronDown
              className={cn(
                "w-4 h-4 text-foreground/50 transition-transform",
                !recommendersOpen && "-rotate-90"
              )}
            />
            <span className="text-[13px] font-bold text-foreground tracking-tight">Recommendation Letters</span>
            {recommenders.length > 0 && (
              <span className="text-[10px] font-bold text-foreground/60 bg-muted rounded-full px-2 py-0.5 ring-1 ring-border">
                {recommenders.length}
              </span>
            )}
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

        {/* Immigration Documents section */}
        <div className="border-b border-border">
          <button
            onClick={() => setImmigrationDocsOpen(!immigrationDocsOpen)}
            className="sticky top-0 z-10 bg-stone-50 dark:bg-stone-900/50 w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-stone-100 dark:hover:bg-stone-800/50 transition-colors border-b border-border"
          >
            <ChevronDown
              className={cn(
                "w-4 h-4 text-foreground/50 transition-transform",
                !immigrationDocsOpen && "-rotate-90"
              )}
            />
            <span className="text-[13px] font-bold text-foreground tracking-tight">Immigration Documents</span>
            {immigrationDocs.length > 0 && (
              <span className="text-[10px] font-bold text-foreground/60 bg-muted rounded-full px-2 py-0.5 ring-1 ring-border">
                {immigrationDocs.length}
              </span>
            )}
          </button>
          {immigrationDocsOpen && (
            <div className="p-3 space-y-1.5">
              {IMMIGRATION_GROUPS.map((group) => {
                const groupDocs = IMMIGRATION_DOC_TYPES.filter(d => d.group === group.key)
                const groupUploadedCount = groupDocs.reduce(
                  (n, dt) => n + immigrationDocs.filter(d => d.category === dt.category).length,
                  0
                )
                return (
                  <Collapsible key={group.key} defaultOpen={group.key === 'identity' || group.key === 'petition_forms'}>
                    <CollapsibleTrigger className="group/imm flex items-center gap-2 w-full text-left px-2 py-2 rounded-md hover:bg-muted/60 transition-colors">
                      <ChevronDown className="w-3.5 h-3.5 text-foreground/40 transition-transform group-data-[state=closed]/imm:-rotate-90" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/60">{group.label}</span>
                      {groupUploadedCount > 0 && (
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 rounded-full px-2 py-0 ring-1 ring-emerald-200 dark:ring-emerald-800">
                          {groupUploadedCount}
                        </span>
                      )}
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-1.5 pb-2 pt-1 pl-1">
                        {groupDocs.map((docType) => (
                          <ImmigrationDocCard
                            key={docType.category}
                            docType={docType}
                            docs={immigrationDocs.filter(d => d.category === docType.category)}
                            caseId={caseId}
                            onUploaded={fetchRecommenderData}
                          />
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )
              })}
            </div>
          )}
        </div>

        {/* Evidence by Criterion section */}
        <div className="border-b border-border">
          <button
            onClick={() => setEvidenceOpen(!evidenceOpen)}
            className="sticky top-0 z-10 bg-stone-50 dark:bg-stone-900/50 w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-stone-100 dark:hover:bg-stone-800/50 transition-colors border-b border-border"
          >
            <ChevronDown
              className={cn(
                "w-4 h-4 text-foreground/50 transition-transform",
                !evidenceOpen && "-rotate-90"
              )}
            />
            <span className="text-[13px] font-bold text-foreground tracking-tight">Evidence by Criterion</span>
          </button>
          {evidenceOpen && (
            <div className="p-3 space-y-2.5">
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
