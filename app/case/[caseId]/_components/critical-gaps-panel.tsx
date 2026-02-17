"use client"

import { useMemo } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { GapAnalysis } from "@/lib/gap-analysis-schema"

type CriticalGap = GapAnalysis["gap_analysis"]["critical_gaps"][number]

const PRIORITY: Record<string, { label: string; dotClass: string; textClass: string; bgClass: string; order: number }> = {
  HIGH: { label: "High priority", dotClass: "bg-red-500", textClass: "text-red-600 dark:text-red-400", bgClass: "bg-red-500/8", order: 0 },
  MEDIUM: { label: "Medium", dotClass: "bg-amber-500", textClass: "text-amber-600 dark:text-amber-400", bgClass: "bg-amber-500/8", order: 1 },
  LOW: { label: "Low", dotClass: "bg-emerald-500", textClass: "text-emerald-600 dark:text-emerald-400", bgClass: "bg-emerald-500/8", order: 2 },
}

/** Extract human-readable name from criterion key like "C5_contributions" */
function criterionName(criterion: string, criteriaNames?: Record<string, string>): string {
  const match = criterion.match(/^(C\d+)/)
  if (match && criteriaNames?.[match[1]]) return criteriaNames[match[1]]
  return criterion
    .replace(/^C\d+_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase())
}

function GapCard({
  gap,
  criteriaNames,
}: {
  gap: CriticalGap
  criteriaNames?: Record<string, string>
}) {
  const p = PRIORITY[gap.priority] ?? PRIORITY.MEDIUM
  const name = criterionName(gap.criterion, criteriaNames)
  const clientActions = gap.actions.filter(a => a.responsible_party === "CLIENT" || a.responsible_party === "BOTH")
  const lawyerActions = gap.actions.filter(a => a.responsible_party === "LAWYER")

  return (
    <div className="px-3 py-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-foreground/90 tracking-tight truncate">
          {name}
        </span>
        <span className={cn("flex items-center gap-1 text-[10px] font-medium shrink-0", p.textClass)}>
          <span className={cn("w-[6px] h-[6px] rounded-full", p.dotClass)} />
          {p.label}
        </span>
      </div>

      {/* Issue */}
      <p className="text-[11px] leading-relaxed text-foreground/70">
        {gap.issue}
      </p>

      {/* Goal */}
      <div className={cn("text-[10px] leading-relaxed rounded-md px-2 py-1.5", p.bgClass, p.textClass)}>
        <span className="font-semibold">Goal: </span>
        {gap.required_state}
      </div>

      {/* Your actions */}
      {clientActions.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] font-medium text-muted-foreground">Your actions</span>
          {clientActions.map((a, j) => (
            <div key={j} className="flex items-start gap-1.5 pl-0.5">
              <span className="text-muted-foreground/40 mt-[3px] shrink-0 text-[8px] leading-none">--</span>
              <div>
                <p className="text-[10px] text-foreground/80 leading-snug">{a.action}</p>
                {a.detail && (
                  <p className="text-[10px] text-muted-foreground leading-snug">{a.detail}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Attorney actions */}
      {lawyerActions.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] font-medium text-muted-foreground/60">Attorney actions</span>
          {lawyerActions.map((a, j) => (
            <div key={j} className="flex items-start gap-1.5 pl-0.5">
              <span className="text-muted-foreground/25 mt-[3px] shrink-0 text-[8px] leading-none">--</span>
              <p className="text-[10px] text-muted-foreground/70 leading-snug">{a.action}</p>
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      {gap.timeline && (
        <p className="text-[9px] text-muted-foreground/50 pt-0.5">
          {gap.timeline}
        </p>
      )}
    </div>
  )
}

interface CriticalGapsPanelProps {
  gapAnalysis: GapAnalysis
  criteriaNames?: Record<string, string>
  onClose: () => void
}

export function CriticalGapsPanel({
  gapAnalysis,
  criteriaNames,
  onClose,
}: CriticalGapsPanelProps) {
  const gaps = gapAnalysis.gap_analysis.critical_gaps

  const sorted = useMemo(
    () => [...gaps].sort((a, b) => (PRIORITY[a.priority]?.order ?? 1) - (PRIORITY[b.priority]?.order ?? 1)),
    [gaps]
  )

  const highCount = gaps.filter(g => g.priority === "HIGH").length
  const medCount = gaps.filter(g => g.priority === "MEDIUM").length
  const lowCount = gaps.filter(g => g.priority === "LOW").length

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-background sticky top-0 z-10">
        <span className="text-xs font-semibold tracking-tight">Critical Gaps</span>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Summary counts */}
      {gaps.length > 0 && (
        <div className="px-3 py-1.5 flex items-center gap-3 text-[10px] text-muted-foreground/70 border-b border-border/50">
          {highCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {highCount} high
            </span>
          )}
          {medCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {medCount} medium
            </span>
          )}
          {lowCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {lowCount} low
            </span>
          )}
        </div>
      )}

      {/* Gaps list */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-12">
            No critical gaps identified
          </p>
        ) : (
          <div className="divide-y divide-border/40">
            {sorted.map((gap, i) => (
              <GapCard key={i} gap={gap} criteriaNames={criteriaNames} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
