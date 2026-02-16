"use client"

import { useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import {
  CRITERION_LABELS,
  type StrengthEvaluation,
} from "@/lib/strength-evaluation-schema"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface StrengthEvaluationPanelProps {
  caseId: string
  initialData?: StrengthEvaluation | null
  onEvalComplete?: () => void
}

type CriterionKey = keyof StrengthEvaluation["criteria_evaluations"]

function getTierColor(tier: number) {
  switch (tier) {
    case 1: return { bg: "bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-300", badge: "bg-emerald-600 text-white" }
    case 2: return { bg: "bg-blue-500/15", text: "text-blue-700 dark:text-blue-300", badge: "bg-blue-600 text-white" }
    case 3: return { bg: "bg-amber-500/15", text: "text-amber-700 dark:text-amber-300", badge: "bg-amber-500 text-white" }
    case 4: return { bg: "bg-orange-500/15", text: "text-orange-700 dark:text-orange-300", badge: "bg-orange-500 text-white" }
    case 5: return { bg: "bg-red-500/15", text: "text-red-700 dark:text-red-300", badge: "bg-red-600 text-white" }
    default: return { bg: "bg-muted/60", text: "text-muted-foreground", badge: "bg-muted text-muted-foreground" }
  }
}

function getStrengthColor(strength: string) {
  switch (strength) {
    case "EXCELLENT": return "bg-emerald-600 text-white"
    case "STRONG": return "bg-blue-600 text-white"
    case "MODERATE": return "bg-amber-500 text-white"
    case "WEAK": return "bg-orange-500 text-white"
    case "VERY_WEAK": return "bg-red-600 text-white"
    default: return "bg-muted text-muted-foreground"
  }
}

function getRfeColor(rfe: string) {
  switch (rfe) {
    case "LOW": return "text-emerald-600 dark:text-emerald-400"
    case "MODERATE": return "text-amber-600 dark:text-amber-400"
    case "HIGH": return "text-orange-600 dark:text-orange-400"
    case "VERY_HIGH": return "text-red-600 dark:text-red-400"
    default: return "text-muted-foreground"
  }
}

function CriterionCard({ criterionKey, data }: { criterionKey: CriterionKey; data: StrengthEvaluation["criteria_evaluations"][CriterionKey] }) {
  if (!data) return null
  const tier = getTierColor(data.tier ?? 0)
  const label = CRITERION_LABELS[criterionKey] ?? criterionKey

  // Check if N/A
  const isNA = "applicable" in data && data.applicable === false

  return (
    <Collapsible>
      <div className={cn("rounded-lg border p-3 transition-all", tier.bg, isNA && "opacity-50")}>
        <CollapsibleTrigger className="w-full text-left">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className={cn("shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold", tier.badge)}>
                {isNA ? "N/A" : `T${data.tier}`}
              </span>
              <span className="text-xs font-semibold text-stone-800 dark:text-stone-200 truncate">
                {label}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {data.satisfied && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  Satisfied
                </span>
              )}
              {!isNA && data.rfe_risk !== "N_A" && (
                <span className={cn("text-[10px] font-medium", getRfeColor(data.rfe_risk))}>
                  RFE: {data.rfe_risk}
                </span>
              )}
              <svg className="w-3 h-3 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
            {data.scoring_rationale && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Rationale</p>
                <p className="text-xs text-stone-600 dark:text-stone-400">{data.scoring_rationale}</p>
              </div>
            )}
            {data.key_evidence && data.key_evidence.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Key Evidence</p>
                <ul className="text-xs text-stone-600 dark:text-stone-400 space-y-0.5">
                  {data.key_evidence.map((e, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span className="shrink-0 text-muted-foreground">-</span>
                      <span>{e}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {data.improvement_notes && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Improvements</p>
                <p className="text-xs text-stone-600 dark:text-stone-400">{data.improvement_notes}</p>
              </div>
            )}
            {data.tier_5_flags && data.tier_5_flags.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-red-600 uppercase mb-0.5">Tier 5 Flags</p>
                <ul className="text-xs text-red-600 dark:text-red-400 space-y-0.5">
                  {data.tier_5_flags.map((f, i) => (
                    <li key={i}>- {f}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

function StepBadge({ result }: { result: string }) {
  const color = result === "SATISFIED" || result === "STRONG"
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
    : result === "BORDERLINE" || result === "MODERATE"
    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
  return <span className={cn("px-2 py-0.5 rounded text-xs font-semibold", color)}>{result}</span>
}

export function StrengthEvaluationPanel({ caseId, initialData, onEvalComplete }: StrengthEvaluationPanelProps) {
  const [data, setData] = useState<Partial<StrengthEvaluation> | null>(initialData ?? null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(!!initialData)

  // Load existing on mount if no initial data
  const loadExisting = useCallback(async () => {
    if (hasLoaded) return
    try {
      const res = await fetch(`/api/case/${caseId}/strength-evaluation`)
      if (res.ok) {
        const result = await res.json()
        if (result) setData(result)
      }
    } catch (err) {
      console.error("Failed to load evaluation:", err)
    } finally {
      setHasLoaded(true)
    }
  }, [caseId, hasLoaded])

  // Load on first render
  useState(() => { loadExisting() })

  const runEvaluation = useCallback(async () => {
    setShowConfirm(false)
    setIsStreaming(true)
    setData(null)

    try {
      const res = await fetch(`/api/case/${caseId}/strength-evaluation`, {
        method: "POST",
      })
      if (!res.ok) throw new Error("Evaluation failed")

      const reader = res.body?.getReader()
      if (!reader) throw new Error("No reader")

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const partial = JSON.parse(line.slice(6))
              setData(partial)
            } catch {
              // partial JSON, skip
            }
          }
        }
      }
    } catch (err) {
      console.error("Evaluation error:", err)
    } finally {
      setIsStreaming(false)
      onEvalComplete?.()
    }
  }, [caseId, onEvalComplete])

  // No evaluation state
  if (!data && !isStreaming) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-1">
          Strength Evaluation
        </h3>
        <p className="text-xs text-stone-500 dark:text-stone-400 max-w-xs mb-4">
          Run a comprehensive evaluation of all 10 EB-1A criteria using research-validated scoring thresholds and Kazarian two-step analysis.
        </p>

        {showConfirm ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-stone-600 dark:text-stone-400">
              This will analyze all case data. Proceed?
            </p>
            <div className="flex gap-2">
              <button
                onClick={runEvaluation}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Run Evaluation
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirm(true)}
            className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Run Evaluation
          </button>
        )}
      </div>
    )
  }

  const overall = data?.overall_assessment
  const step1 = data?.step1_assessment
  const step2 = data?.step2_assessment
  const criteria = data?.criteria_evaluations
  const redFlags = data?.red_flags
  const fieldComparison = data?.field_comparison
  const metadata = data?.evaluation_metadata

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              Strength Evaluation
            </h3>
            {isStreaming && (
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            )}
          </div>
          {overall && (
            <div className="flex items-center gap-2">
              <span className={cn("px-2 py-0.5 rounded text-xs font-bold", getStrengthColor(overall.petition_strength))}>
                {overall.petition_strength}
              </span>
              {overall.overall_score != null && overall.overall_score > 0 && (
                <span className="text-xs font-mono text-muted-foreground">
                  {overall.overall_score.toFixed(1)}/10
                </span>
              )}
            </div>
          )}
        </div>
        {data?.detected_field && (
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
              {data.detected_field}
            </span>
            {overall?.approval_probability && (
              <span className="text-[10px] text-muted-foreground">
                Approval: {overall.approval_probability}
              </span>
            )}
            {overall?.recommendation && (
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded font-medium",
                overall.recommendation === "FILE_NOW" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" :
                overall.recommendation === "STRENGTHEN_FIRST" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" :
                "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
              )}>
                {overall.recommendation.replace(/_/g, " ")}
              </span>
            )}
          </div>
        )}
        {!isStreaming && data && (
          <button
            onClick={() => setShowConfirm(true)}
            className="mt-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors underline"
          >
            Re-run evaluation
          </button>
        )}
        {showConfirm && !isStreaming && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-muted-foreground">Re-run?</span>
            <button onClick={runEvaluation} className="text-[10px] text-primary font-medium hover:underline">Yes</button>
            <button onClick={() => setShowConfirm(false)} className="text-[10px] text-muted-foreground hover:underline">No</button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Criteria Grid -- sorted strongest (lowest tier) first */}
        {criteria && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Criteria Evaluation</h4>
            <div className="space-y-2">
              {(Object.keys(criteria) as CriterionKey[])
                .slice()
                .sort((a, b) => {
                  const aNA = "applicable" in (criteria[a] ?? {}) && (criteria[a] as Record<string, unknown>).applicable === false
                  const bNA = "applicable" in (criteria[b] ?? {}) && (criteria[b] as Record<string, unknown>).applicable === false
                  if (aNA !== bNA) return aNA ? 1 : -1
                  return (criteria[a]?.tier ?? 99) - (criteria[b]?.tier ?? 99)
                })
                .map((key) => (
                  <CriterionCard key={key} criterionKey={key} data={criteria[key]} />
                ))}
            </div>
          </div>
        )}

        {/* Recommended Criteria */}
        {overall?.recommended_criteria_to_claim && overall.recommended_criteria_to_claim.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Recommended to Claim</h4>
            <div className="flex flex-wrap gap-1">
              {overall.recommended_criteria_to_claim.map((c) => (
                <span key={c} className="px-2 py-0.5 rounded text-[10px] bg-primary/10 text-primary font-medium">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        {metadata && (
          <div className="text-[10px] text-muted-foreground pt-2 border-t border-border">
            {metadata.data_completeness && <>Data completeness: {metadata.data_completeness}</>}
            {metadata.confidence_level != null && <> | Confidence: {(metadata.confidence_level * 100).toFixed(0)}%</>}
            {metadata.notes && <span> | {metadata.notes}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
