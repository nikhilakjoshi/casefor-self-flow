"use client"

import { useMemo } from "react"
import {
  X,
  FileText,
  Award,
  ScrollText,
  Users,
  Newspaper,
  Scale,
  Mic,
  DollarSign,
  Building,
  Banknote,
  Palette,
  TrendingUp,
  Lightbulb,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { StrengthEvaluation } from "@/lib/strength-evaluation-schema"
import type { DetailedExtraction } from "@/lib/eb1a-extraction-schema"

const EVIDENCE_CATEGORIES = [
  "publications", "awards", "patents", "memberships", "media_coverage",
  "judging_activities", "speaking_engagements", "grants", "leadership_roles",
  "compensation", "exhibitions", "commercial_success", "original_contributions",
] as const

type EvidenceCategory = (typeof EVIDENCE_CATEGORIES)[number]

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
  commercial_success: { label: "Commercial", icon: TrendingUp },
  original_contributions: { label: "Contributions", icon: Lightbulb },
}

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

const CRITERION_TO_EVAL_KEY: Record<string, string> = {
  C1: "C1_awards", C2: "C2_membership", C3: "C3_press",
  C4: "C4_judging", C5: "C5_contributions", C6: "C6_publications",
  C7: "C7_exhibitions", C8: "C8_leading_role", C9: "C9_salary", C10: "C10_commercial",
}

const TIER_DISPLAY: Record<number, { label: string; dotsFilled: number; dotClass: string; textClass: string }> = {
  1: { label: "Excellent", dotsFilled: 5, dotClass: "bg-emerald-500", textClass: "text-emerald-600 dark:text-emerald-400" },
  2: { label: "Good", dotsFilled: 4, dotClass: "bg-blue-500", textClass: "text-blue-600 dark:text-blue-400" },
  3: { label: "Fair", dotsFilled: 3, dotClass: "bg-amber-500", textClass: "text-amber-600 dark:text-amber-400" },
  4: { label: "Needs work", dotsFilled: 2, dotClass: "bg-orange-500", textClass: "text-orange-600 dark:text-orange-400" },
  5: { label: "Weak", dotsFilled: 1, dotClass: "bg-red-500", textClass: "text-red-600 dark:text-red-400" },
}

function StrengthMeter({ tier }: { tier: number }) {
  const d = TIER_DISPLAY[tier] ?? TIER_DISPLAY[3]
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-[3px]">
        {[1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            className={cn(
              "w-[5px] h-[5px] rounded-full",
              i <= d.dotsFilled ? d.dotClass : "bg-foreground/8"
            )}
          />
        ))}
      </div>
      <span className={cn("text-[10px] font-medium leading-none", d.textClass)}>
        {d.label}
      </span>
    </div>
  )
}

function ItemSummary({ item, category }: { item: Record<string, unknown>; category: string }) {
  switch (category) {
    case "publications": {
      const parts = [item.title as string]
      if (item.venue) parts.push(`in ${item.venue}`)
      if (item.year) parts.push(`(${item.year})`)
      if (item.citations) parts.push(`- ${item.citations} cit.`)
      return <>{parts.join(" ")}</>
    }
    case "awards": {
      const parts = [item.name as string]
      if (item.issuer) parts.push(`by ${item.issuer}`)
      if (item.year) parts.push(`(${item.year})`)
      if (item.scope && item.scope !== "unknown") parts.push(`[${item.scope}]`)
      return <>{parts.join(" ")}</>
    }
    case "patents": {
      const parts = [item.title as string]
      if (item.number) parts.push(`#${item.number}`)
      if (item.status && item.status !== "unknown") parts.push(`(${item.status})`)
      return <>{parts.join(" ")}</>
    }
    case "memberships": {
      const parts = [item.organization as string]
      if (item.role) parts.push(`- ${item.role}`)
      return <>{parts.join(" ")}</>
    }
    case "media_coverage": {
      const parts: string[] = []
      if (item.title) parts.push(item.title as string)
      if (item.outlet) parts.push(`(${item.outlet})`)
      return <>{parts.join(" ") || (item.outlet as string)}</>
    }
    case "judging_activities": {
      const parts: string[] = []
      if (item.type) parts.push((item.type as string).replace(/_/g, " "))
      if (item.organization) parts.push(`at ${item.organization}`)
      if (item.venue) parts.push(`for ${item.venue}`)
      return <>{parts.join(" ")}</>
    }
    case "speaking_engagements": {
      const parts = [item.event as string]
      if (item.type) parts.push(`(${item.type})`)
      if (item.year) parts.push(`${item.year}`)
      return <>{parts.join(" ")}</>
    }
    case "grants": {
      const parts = [item.title as string]
      if (item.funder) parts.push(`from ${item.funder}`)
      if (item.amount != null) parts.push(`${item.currency ?? "$"}${(item.amount as number).toLocaleString("en-US")}`)
      return <>{parts.join(" ")}</>
    }
    case "leadership_roles": {
      const parts = [item.title as string]
      if (item.organization) parts.push(`at ${item.organization}`)
      return <>{parts.join(" ")}</>
    }
    case "compensation": {
      const parts: string[] = []
      if (item.amount != null) parts.push(`${item.currency ?? "$"}${(item.amount as number).toLocaleString("en-US")}`)
      if (item.period) parts.push(`(${item.period})`)
      if (item.context) parts.push(`- ${item.context}`)
      return <>{parts.join(" ")}</>
    }
    case "exhibitions": {
      const parts: string[] = []
      if (item.title) parts.push(item.title as string)
      if (item.venue) parts.push(`at ${item.venue}`)
      if (item.type) parts.push(`(${item.type})`)
      return <>{parts.join(" ") || (item.venue as string)}</>
    }
    case "commercial_success":
      return <>{item.description as string}</>
    case "original_contributions":
      return <>{item.description as string}</>
    default:
      return <>{JSON.stringify(item)}</>
  }
}

function getEvidenceForCriterion(
  extraction: DetailedExtraction,
  criterionId: string,
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
  // Primary categories first
  results.sort((a, b) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0))
  return results
}

interface EvidenceGroup {
  key: string
  name: string
  tier?: number
  keyEvidence: string[]
  extractionGroups: { category: EvidenceCategory; items: Record<string, unknown>[]; primary: boolean }[]
  totalItems: number
}

export interface KeyEvidencePanelProps {
  extraction?: DetailedExtraction | null
  strengthEval?: StrengthEvaluation | null
  criteriaNames?: Record<string, string>
  onClose: () => void
}

export function KeyEvidencePanel({
  extraction,
  strengthEval,
  criteriaNames,
  onClose,
}: KeyEvidencePanelProps) {
  const groups = useMemo<EvidenceGroup[]>(() => {
    const criteriaKeys = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10"]
    const result: EvidenceGroup[] = []

    for (const cKey of criteriaKeys) {
      const extractionGroups = extraction ? getEvidenceForCriterion(extraction, cKey) : []
      const evalKey = CRITERION_TO_EVAL_KEY[cKey] as keyof StrengthEvaluation["criteria_evaluations"] | undefined
      const evalData = evalKey ? strengthEval?.criteria_evaluations?.[evalKey] : undefined
      const keyEvidence = evalData?.key_evidence ?? []
      const totalItems = extractionGroups.reduce((n, g) => n + g.items.length, 0)

      if (totalItems === 0 && keyEvidence.length === 0) continue

      result.push({
        key: cKey,
        name: criteriaNames?.[cKey] ?? cKey,
        tier: evalData?.tier,
        keyEvidence,
        extractionGroups,
        totalItems,
      })
    }

    // Strongest first (lowest tier)
    result.sort((a, b) => (a.tier ?? 5) - (b.tier ?? 5))
    return result
  }, [extraction, strengthEval, criteriaNames])

  const totalCount = groups.reduce((n, g) => n + g.totalItems, 0)

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-background sticky top-0 z-10">
        <span className="text-xs font-semibold tracking-tight">Key Evidence</span>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Summary */}
      {totalCount > 0 && (
        <div className="px-3 py-1 text-[10px] text-muted-foreground/70 border-b border-border/50">
          {totalCount} items across {groups.length} criteria
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {groups.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-12">
            No evidence items yet
          </p>
        ) : (
          <div className="divide-y divide-border/40">
            {groups.map((group) => (
              <div key={group.key} className="px-3 py-2.5">
                {/* Criterion header */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[11px] font-semibold text-foreground/90 tracking-tight truncate">
                    {group.name}
                  </span>
                  {group.tier && <StrengthMeter tier={group.tier} />}
                </div>

                {/* Key evidence snippets (fallback when no structured items) */}
                {group.keyEvidence.length > 0 && group.totalItems === 0 && (
                  <div className="space-y-1 mb-1">
                    {group.keyEvidence.slice(0, 3).map((ev, i) => (
                      <p key={i} className="text-[10px] italic text-foreground/40 leading-snug pl-2 border-l-2 border-border/60">
                        {ev}
                      </p>
                    ))}
                  </div>
                )}

                {/* Extraction items */}
                {group.extractionGroups.length > 0 && (
                  <div className="space-y-px">
                    {group.extractionGroups.map(({ category, items }) => {
                      const catConf = CATEGORY_CONFIG[category]
                      if (!catConf) return null
                      const Icon = catConf.icon
                      return items.map((item, j) => (
                        <div key={`${category}-${j}`} className="flex items-start gap-1.5 py-[3px]">
                          <Icon className="w-3 h-3 text-muted-foreground/40 shrink-0 mt-[2px]" />
                          <span className="text-[10px] text-foreground/70 leading-snug line-clamp-2">
                            <ItemSummary item={item} category={category} />
                          </span>
                        </div>
                      ))
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
