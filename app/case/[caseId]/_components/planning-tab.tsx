"use client"

import { useState, useEffect, useCallback } from "react"
import { ChevronDown, Loader2, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { GapAnalysisPanel } from "./gap-analysis-panel"
import { CaseStrategyPanel } from "./case-strategy-panel"
import { StrengthEvaluationPanel } from "./strength-evaluation-panel"
import type { GapAnalysis } from "@/lib/gap-analysis-schema"
import type { CaseStrategy } from "@/lib/case-strategy-schema"
import type { StrengthEvaluation } from "@/lib/strength-evaluation-schema"

interface PlanningTabProps {
  caseId: string
  initialGapAnalysis?: GapAnalysis | null
  initialCaseStrategy?: CaseStrategy | null
  initialStrengthEvaluation?: StrengthEvaluation | null
}

function KazarianSummary({
  caseId,
  strengthEvaluation,
}: {
  caseId: string
  strengthEvaluation: StrengthEvaluation
}) {
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const generate = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/case/${caseId}/kazarian-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strengthEvaluation }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSummary(data.summary)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [caseId, strengthEvaluation])

  useEffect(() => {
    generate()
  }, [generate])

  if (loading) {
    return (
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Generating case summary...
        </div>
      </div>
    )
  }

  if (error || !summary) {
    return null
  }

  const overall = strengthEvaluation.overall_assessment
  const step1 = strengthEvaluation.step1_assessment

  return (
    <div className="px-4 py-3 border-b border-border space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Case Summary</h3>
          {overall && (
            <span className={cn(
              "px-1.5 py-0.5 rounded text-[10px] font-bold",
              overall.petition_strength === "EXCELLENT" || overall.petition_strength === "STRONG"
                ? "bg-emerald-600 text-white"
                : overall.petition_strength === "MODERATE"
                  ? "bg-amber-500 text-white"
                  : "bg-red-600 text-white"
            )}>
              {overall.petition_strength}
            </span>
          )}
          {step1 && (
            <span className="text-[10px] text-muted-foreground">
              {step1.criteria_satisfied_count} criteria met
            </span>
          )}
        </div>
        <button
          onClick={generate}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Regenerate summary"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>
      <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
        {summary}
      </p>
    </div>
  )
}

export function PlanningTab({
  caseId,
  initialGapAnalysis,
  initialCaseStrategy,
  initialStrengthEvaluation,
}: PlanningTabProps) {
  const [strengthOpen, setStrengthOpen] = useState(false)
  const [gapOpen, setGapOpen] = useState(true)
  const [strategyOpen, setStrategyOpen] = useState(false)

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Kazarian Executive Summary */}
      {initialStrengthEvaluation && (
        <KazarianSummary
          caseId={caseId}
          strengthEvaluation={initialStrengthEvaluation}
        />
      )}

      {/* Strength Evaluation section */}
      <div className="border-b border-border">
        <button
          onClick={() => setStrengthOpen(!strengthOpen)}
          className="sticky top-0 z-10 bg-background w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors border-b border-border"
        >
          <ChevronDown
            className={cn(
              "w-4 h-4 text-muted-foreground transition-transform",
              !strengthOpen && "-rotate-90"
            )}
          />
          <span className="text-sm font-semibold">Strength Evaluation</span>
        </button>
        {strengthOpen && (
          <StrengthEvaluationPanel
            caseId={caseId}
            initialData={initialStrengthEvaluation}
          />
        )}
      </div>

      {/* Gap Analysis section */}
      <div className="border-b border-border">
        <button
          onClick={() => setGapOpen(!gapOpen)}
          className="sticky top-0 z-10 bg-background w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors border-b border-border"
        >
          <ChevronDown
            className={cn(
              "w-4 h-4 text-muted-foreground transition-transform",
              !gapOpen && "-rotate-90"
            )}
          />
          <span className="text-sm font-semibold">Gap Analysis</span>
        </button>
        {gapOpen && (
          <GapAnalysisPanel
            caseId={caseId}
            initialData={initialGapAnalysis}
            hasStrengthEval={!!initialStrengthEvaluation}
          />
        )}
      </div>

      {/* Case Strategy section */}
      <div className="border-b border-border">
        <button
          onClick={() => setStrategyOpen(!strategyOpen)}
          className="sticky top-0 z-10 bg-background w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors border-b border-border"
        >
          <ChevronDown
            className={cn(
              "w-4 h-4 text-muted-foreground transition-transform",
              !strategyOpen && "-rotate-90"
            )}
          />
          <span className="text-sm font-semibold">Case Strategy</span>
        </button>
        {strategyOpen && (
          <CaseStrategyPanel
            caseId={caseId}
            initialData={initialCaseStrategy}
            hasGapAnalysis={!!initialGapAnalysis}
          />
        )}
      </div>
    </div>
  )
}
