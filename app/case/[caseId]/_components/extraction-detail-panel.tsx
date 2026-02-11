"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  type DetailedExtraction,
  type CriteriaSummaryItem,
  type CriterionId,
  CRITERIA_METADATA,
} from "@/lib/eb1a-extraction-schema"
import { ChevronDown, ChevronRight, FileText, Award, ScrollText, Users, Newspaper, Scale, Mic, DollarSign, Building, Palette, TrendingUp, Lightbulb } from "lucide-react"

interface ExtractionDetailPanelProps {
  extraction: DetailedExtraction | null
  criteriaSummary: CriteriaSummaryItem[]
}

function SourceBadge({ source }: { source?: "extracted" | "survey" }) {
  if (!source) return null
  return (
    <span
      className={cn(
        "text-[10px] px-1.5 py-0.5 rounded font-medium",
        source === "survey"
          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
          : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400"
      )}
    >
      {source === "survey" ? "Survey" : "Resume"}
    </span>
  )
}

function StrengthBadge({ strength }: { strength: "Strong" | "Weak" | "None" }) {
  return (
    <span
      className={cn(
        "text-[10px] px-1.5 py-0.5 rounded font-medium",
        strength === "Strong" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
        strength === "Weak" && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
        strength === "None" && "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-500"
      )}
    >
      {strength}
    </span>
  )
}

function CriteriaBadge({ criterionId }: { criterionId: CriterionId }) {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 font-medium">
      {criterionId}
    </span>
  )
}

function CollapsibleSection({
  title,
  icon: Icon,
  count,
  children,
  defaultOpen = false,
}: {
  title: string
  icon: React.ElementType
  count: number
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  if (count === 0) return null

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-muted/50 hover:bg-muted transition-colors text-left"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
        <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="flex-1 text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground bg-background px-1.5 py-0.5 rounded">
          {count}
        </span>
      </button>
      {open && <div className="p-3 space-y-2 bg-background">{children}</div>}
    </div>
  )
}

function ItemCard({
  title,
  subtitle,
  source,
  mappedCriteria,
  extra,
}: {
  title: string
  subtitle?: string
  source?: "extracted" | "survey"
  mappedCriteria?: CriterionId[]
  extra?: React.ReactNode
}) {
  return (
    <div className="p-2 rounded border border-border bg-muted/30">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground truncate">{title}</p>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
          )}
          {extra}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <SourceBadge source={source} />
          {mappedCriteria?.map((c) => (
            <CriteriaBadge key={c} criterionId={c} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function ExtractionDetailPanel({
  extraction,
  criteriaSummary,
}: ExtractionDetailPanelProps) {
  const [selectedCriterion, setSelectedCriterion] = useState<CriterionId | "all">("all")

  if (!extraction) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center text-muted-foreground">
          <p className="text-sm">No extraction data</p>
          <p className="text-xs mt-1">Analysis will appear here after processing</p>
        </div>
      </div>
    )
  }

  // Filter function
  const filterByCriterion = <T extends { mapped_criteria?: CriterionId[] }>(items: T[]): T[] => {
    if (selectedCriterion === "all") return items
    return items.filter((item) => item.mapped_criteria?.includes(selectedCriterion))
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header with criteria filter */}
      <div className="shrink-0 p-3 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Extracted Evidence</h3>
          <select
            value={selectedCriterion}
            onChange={(e) => setSelectedCriterion(e.target.value as CriterionId | "all")}
            className="text-xs border border-border rounded px-2 py-1 bg-background"
          >
            <option value="all">All Criteria</option>
            {Object.entries(CRITERIA_METADATA).map(([id, meta]) => (
              <option key={id} value={id}>
                {id}: {meta.name}
              </option>
            ))}
          </select>
        </div>

        {/* Criteria summary grid */}
        <div className="grid grid-cols-5 gap-1.5">
          {criteriaSummary.map((summary) => (
            <button
              key={summary.criterion_id}
              onClick={() =>
                setSelectedCriterion(
                  selectedCriterion === summary.criterion_id ? "all" : summary.criterion_id
                )
              }
              className={cn(
                "flex flex-col items-center p-1.5 rounded border transition-colors",
                selectedCriterion === summary.criterion_id
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-muted/50",
                summary.strength === "Strong" && "border-emerald-300 dark:border-emerald-800",
                summary.strength === "Weak" && "border-amber-300 dark:border-amber-800"
              )}
            >
              <span className="text-[10px] font-medium">{summary.criterion_id}</span>
              <span
                className={cn(
                  "text-xs font-bold",
                  summary.strength === "Strong" && "text-emerald-600 dark:text-emerald-400",
                  summary.strength === "Weak" && "text-amber-600 dark:text-amber-400",
                  summary.strength === "None" && "text-muted-foreground"
                )}
              >
                {summary.evidence_count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {/* Publications */}
        <CollapsibleSection
          title="Publications"
          icon={FileText}
          count={filterByCriterion(extraction.publications).length}
          defaultOpen
        >
          {filterByCriterion(extraction.publications).map((pub, i) => (
            <ItemCard
              key={i}
              title={pub.title}
              subtitle={pub.venue ? `${pub.venue}${pub.year ? ` (${pub.year})` : ""}` : undefined}
              source={pub.source}
              mappedCriteria={pub.mapped_criteria}
              extra={
                <div className="flex items-center gap-2 mt-1">
                  {pub.venue_tier && pub.venue_tier !== "unknown" && (
                    <span className="text-[10px] text-muted-foreground">
                      {pub.venue_tier === "top_tier" ? "Top tier" : pub.venue_tier}
                    </span>
                  )}
                  {pub.citations != null && (
                    <span className="text-[10px] text-muted-foreground">
                      {pub.citations} citations
                    </span>
                  )}
                </div>
              }
            />
          ))}
        </CollapsibleSection>

        {/* Awards */}
        <CollapsibleSection
          title="Awards"
          icon={Award}
          count={filterByCriterion(extraction.awards).length}
          defaultOpen
        >
          {filterByCriterion(extraction.awards).map((award, i) => (
            <ItemCard
              key={i}
              title={award.name}
              subtitle={award.issuer ? `${award.issuer}${award.year ? ` (${award.year})` : ""}` : undefined}
              source={award.source}
              mappedCriteria={award.mapped_criteria}
              extra={
                award.scope && award.scope !== "unknown" && (
                  <span className="text-[10px] text-muted-foreground capitalize">
                    {award.scope}
                  </span>
                )
              }
            />
          ))}
        </CollapsibleSection>

        {/* Patents */}
        <CollapsibleSection
          title="Patents"
          icon={ScrollText}
          count={filterByCriterion(extraction.patents).length}
        >
          {filterByCriterion(extraction.patents).map((patent, i) => (
            <ItemCard
              key={i}
              title={patent.title}
              subtitle={patent.number}
              source={patent.source}
              mappedCriteria={patent.mapped_criteria}
              extra={
                patent.status && (
                  <span className="text-[10px] text-muted-foreground capitalize">
                    {patent.status}
                  </span>
                )
              }
            />
          ))}
        </CollapsibleSection>

        {/* Memberships */}
        <CollapsibleSection
          title="Memberships"
          icon={Users}
          count={filterByCriterion(extraction.memberships).length}
        >
          {filterByCriterion(extraction.memberships).map((mem, i) => (
            <ItemCard
              key={i}
              title={mem.organization}
              subtitle={mem.role}
              source={mem.source}
              mappedCriteria={mem.mapped_criteria}
            />
          ))}
        </CollapsibleSection>

        {/* Media Coverage */}
        <CollapsibleSection
          title="Media Coverage"
          icon={Newspaper}
          count={filterByCriterion(extraction.media_coverage).length}
        >
          {filterByCriterion(extraction.media_coverage).map((media, i) => (
            <ItemCard
              key={i}
              title={media.outlet}
              subtitle={media.title}
              source={media.source}
              mappedCriteria={media.mapped_criteria}
              extra={
                media.about_the_person && (
                  <span className="text-[10px] text-blue-600 dark:text-blue-400">
                    About applicant
                  </span>
                )
              }
            />
          ))}
        </CollapsibleSection>

        {/* Judging Activities */}
        <CollapsibleSection
          title="Judging Activities"
          icon={Scale}
          count={filterByCriterion(extraction.judging_activities).length}
        >
          {filterByCriterion(extraction.judging_activities).map((judge, i) => (
            <ItemCard
              key={i}
              title={judge.type.replace(/_/g, " ")}
              subtitle={judge.organization || judge.venue}
              source={judge.source}
              mappedCriteria={judge.mapped_criteria}
            />
          ))}
        </CollapsibleSection>

        {/* Speaking Engagements */}
        <CollapsibleSection
          title="Speaking Engagements"
          icon={Mic}
          count={filterByCriterion(extraction.speaking_engagements).length}
        >
          {filterByCriterion(extraction.speaking_engagements).map((speak, i) => (
            <ItemCard
              key={i}
              title={speak.event}
              subtitle={speak.type ? `${speak.type}${speak.year ? ` (${speak.year})` : ""}` : undefined}
              source={speak.source}
              mappedCriteria={speak.mapped_criteria}
            />
          ))}
        </CollapsibleSection>

        {/* Grants */}
        <CollapsibleSection
          title="Grants"
          icon={DollarSign}
          count={filterByCriterion(extraction.grants).length}
        >
          {filterByCriterion(extraction.grants).map((grant, i) => (
            <ItemCard
              key={i}
              title={grant.title}
              subtitle={grant.funder}
              source={grant.source}
              mappedCriteria={grant.mapped_criteria}
              extra={
                grant.amount && (
                  <span className="text-[10px] text-muted-foreground">
                    {grant.currency ?? "$"}{grant.amount.toLocaleString("en-US")}
                  </span>
                )
              }
            />
          ))}
        </CollapsibleSection>

        {/* Leadership Roles */}
        <CollapsibleSection
          title="Leadership Roles"
          icon={Building}
          count={filterByCriterion(extraction.leadership_roles).length}
        >
          {filterByCriterion(extraction.leadership_roles).map((role, i) => (
            <ItemCard
              key={i}
              title={role.title}
              subtitle={role.organization}
              source={role.source}
              mappedCriteria={role.mapped_criteria}
            />
          ))}
        </CollapsibleSection>

        {/* Exhibitions */}
        <CollapsibleSection
          title="Exhibitions"
          icon={Palette}
          count={filterByCriterion(extraction.exhibitions).length}
        >
          {filterByCriterion(extraction.exhibitions).map((exh, i) => (
            <ItemCard
              key={i}
              title={exh.venue}
              subtitle={exh.title}
              source={exh.source}
              mappedCriteria={exh.mapped_criteria}
            />
          ))}
        </CollapsibleSection>

        {/* Commercial Success */}
        <CollapsibleSection
          title="Commercial Success"
          icon={TrendingUp}
          count={filterByCriterion(extraction.commercial_success).length}
        >
          {filterByCriterion(extraction.commercial_success).map((comm, i) => (
            <ItemCard
              key={i}
              title={comm.description}
              subtitle={comm.metrics}
              source={comm.source}
              mappedCriteria={comm.mapped_criteria}
            />
          ))}
        </CollapsibleSection>

        {/* Original Contributions */}
        <CollapsibleSection
          title="Original Contributions"
          icon={Lightbulb}
          count={filterByCriterion(extraction.original_contributions).length}
        >
          {filterByCriterion(extraction.original_contributions).map((contrib, i) => (
            <ItemCard
              key={i}
              title={contrib.description}
              subtitle={contrib.impact}
              source={contrib.source}
              mappedCriteria={contrib.mapped_criteria}
            />
          ))}
        </CollapsibleSection>
      </div>
    </div>
  )
}
