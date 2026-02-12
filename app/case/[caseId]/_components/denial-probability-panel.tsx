"use client"

import { useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import type { DenialProbability } from "@/lib/denial-probability-schema"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface DenialProbabilityPanelProps {
  caseId: string
  initialData?: DenialProbability | null
  hasStrengthEval?: boolean
  hasGapAnalysis?: boolean
}

function getRiskColor(level: string) {
  switch (level) {
    case "LOW": return { bg: "bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-300", badge: "bg-emerald-600 text-white" }
    case "MEDIUM": return { bg: "bg-amber-500/15", text: "text-amber-700 dark:text-amber-300", badge: "bg-amber-500 text-white" }
    case "HIGH": return { bg: "bg-orange-500/15", text: "text-orange-700 dark:text-orange-300", badge: "bg-orange-500 text-white" }
    case "VERY_HIGH": return { bg: "bg-red-500/15", text: "text-red-700 dark:text-red-300", badge: "bg-red-600 text-white" }
    default: return { bg: "bg-muted/60", text: "text-muted-foreground", badge: "bg-muted text-muted-foreground" }
  }
}

function getClassificationColor(c: string) {
  switch (c) {
    case "PRIMARY": return "bg-emerald-600 text-white"
    case "SECONDARY": return "bg-blue-600 text-white"
    case "WEAK": return "bg-red-600 text-white"
    default: return "bg-muted text-muted-foreground"
  }
}

function getDocStatusColor(s: string) {
  switch (s) {
    case "COMPLETE": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
    case "PARTIAL": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
    case "INSUFFICIENT": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
    default: return "bg-muted text-muted-foreground"
  }
}

function getFilingColor(rec: string) {
  switch (rec) {
    case "FILE_NOW": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
    case "FILE_WITH_CAUTION": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
    case "STRENGTHEN_FIRST": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
    case "MAJOR_GAPS": return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
    case "CONSIDER_ALTERNATIVE": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
    default: return "bg-muted text-muted-foreground"
  }
}

function getComparisonColor(v: string) {
  switch (v) {
    case "ABOVE": return "text-emerald-600 dark:text-emerald-400"
    case "AT": return "text-amber-600 dark:text-amber-400"
    case "BELOW": return "text-red-600 dark:text-red-400"
    default: return "text-muted-foreground"
  }
}

function getMeritsColor(v: string) {
  switch (v) {
    case "STRONG": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
    case "MODERATE": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
    case "WEAK": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
    default: return "bg-muted text-muted-foreground"
  }
}

function RiskBar({ value, max = 100 }: { value: number; max?: number }) {
  if (value == null) return null
  const pct = Math.min((value / max) * 100, 100)
  const color = value <= 30 ? "bg-emerald-500" : value <= 60 ? "bg-amber-500" : "bg-red-500"
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono tabular-nums text-muted-foreground w-8 text-right">{value}</span>
    </div>
  )
}

function SemiCircleGauge({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value))
  // Arc from 180deg (left) to 0deg (right), so angle maps 0->180
  const angle = (clamped / 100) * 180
  const radius = 70
  const cx = 80
  const cy = 80
  const strokeWidth = 12

  // Convert angle to radians, starting from left (180deg = PI)
  const startAngle = Math.PI
  const endAngle = Math.PI - (angle * Math.PI) / 180

  const x = cx + radius * Math.cos(endAngle)
  const y = cy - radius * Math.sin(endAngle)

  const largeArc = angle > 180 ? 1 : 0

  // Background arc (full semicircle)
  const bgPath = `M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`
  // Value arc
  const valuePath = angle > 0
    ? `M ${cx - radius} ${cy} A ${radius} ${radius} 0 ${largeArc} 1 ${x} ${y}`
    : ""

  // Color based on value
  const strokeColor = clamped < 30
    ? "stroke-emerald-500"
    : clamped < 60
    ? "stroke-amber-500"
    : "stroke-red-500"

  const textColor = clamped < 30
    ? "text-emerald-600 dark:text-emerald-400"
    : clamped < 60
    ? "text-amber-600 dark:text-amber-400"
    : "text-red-600 dark:text-red-400"

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 160 90" className="w-48 h-auto">
        {/* Background track */}
        <path
          d={bgPath}
          fill="none"
          className="stroke-muted"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Value arc */}
        {valuePath && (
          <path
            d={valuePath}
            fill="none"
            className={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}
        {/* Tick marks */}
        {[0, 30, 60, 100].map((tick) => {
          const a = Math.PI - (tick / 100) * Math.PI
          const inner = radius - strokeWidth / 2 - 3
          const outer = radius - strokeWidth / 2 - 8
          return (
            <line
              key={tick}
              x1={cx + inner * Math.cos(a)}
              y1={cy - inner * Math.sin(a)}
              x2={cx + outer * Math.cos(a)}
              y2={cy - outer * Math.sin(a)}
              className="stroke-muted-foreground/30"
              strokeWidth="1"
            />
          )
        })}
      </svg>
      <div className={cn("text-2xl font-bold tabular-nums -mt-2", textColor)}>
        {Math.round(clamped)}%
      </div>
      <p className="text-[10px] text-muted-foreground mt-0.5">Denial Probability</p>
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{children}</h4>
}

export function DenialProbabilityPanel({ caseId, initialData, hasStrengthEval, hasGapAnalysis }: DenialProbabilityPanelProps) {
  const [data, setData] = useState<Partial<DenialProbability> | null>(initialData ?? null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(!!initialData)

  const loadExisting = useCallback(async () => {
    if (hasLoaded) return
    try {
      const res = await fetch(`/api/case/${caseId}/denial-probability`)
      if (res.ok) {
        const result = await res.json()
        if (result) setData(result)
      }
    } catch (err) {
      console.error("Failed to load denial probability:", err)
    } finally {
      setHasLoaded(true)
    }
  }, [caseId, hasLoaded])

  useState(() => { loadExisting() })

  const runAssessment = useCallback(async () => {
    setShowConfirm(false)
    setIsStreaming(true)
    setData(null)

    try {
      const res = await fetch(`/api/case/${caseId}/denial-probability`, {
        method: "POST",
      })
      if (!res.ok) throw new Error("Assessment failed")

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
      console.error("Denial probability error:", err)
    } finally {
      setIsStreaming(false)
    }
  }, [caseId])

  const canRun = hasStrengthEval && hasGapAnalysis

  // Empty state
  if (!data && !isStreaming) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-1">
          Denial Probability Assessment
        </h3>
        <p className="text-xs text-stone-500 dark:text-stone-400 max-w-xs mb-4">
          Synthesize all case data into a comprehensive risk report with probability calculations and filing recommendations.
        </p>

        {!canRun && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">
            {!hasStrengthEval && !hasGapAnalysis
              ? "Run Strength Evaluation and Gap Analysis first."
              : !hasStrengthEval
              ? "Run Strength Evaluation first."
              : "Run Gap Analysis first."}
          </p>
        )}

        {showConfirm ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-stone-600 dark:text-stone-400">
              This will analyze all case data, strength eval, and gap analysis. Proceed?
            </p>
            <div className="flex gap-2">
              <button
                onClick={runAssessment}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Run Assessment
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
            disabled={!canRun}
            className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Run Assessment
          </button>
        )}
      </div>
    )
  }

  const overall = data?.overall_assessment
  const kazarian = data?.kazarian_analysis
  const fieldCtx = data?.field_context
  const criteria = data?.criterion_risk_assessments
  const letters = data?.letter_analysis
  const flags = data?.red_flags
  const strengths = data?.strengths
  const recs = data?.recommendations
  const filing = data?.filing_recommendation
  const breakdown = data?.probability_breakdown

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              Risk Assessment
            </h3>
            {isStreaming && (
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            )}
          </div>
          {overall?.risk_level && (
            <div className="flex items-center gap-2">
              <span className={cn("px-2 py-0.5 rounded text-xs font-bold", getRiskColor(overall.risk_level).badge)}>
                {overall.risk_level.replace(/_/g, " ")}
              </span>
              {overall.confidence && (
                <span className="text-[10px] text-muted-foreground">
                  Confidence: {overall.confidence}
                </span>
              )}
            </div>
          )}
        </div>
        {overall && (
          <div className="flex items-center gap-3 mt-1.5 text-[10px]">
            {overall.denial_probability_pct != null && (
              <span className="text-muted-foreground">
                Denial: <strong className="text-foreground">{Math.round(overall.denial_probability_pct)}%</strong>
              </span>
            )}
            {overall.rfe_probability_pct != null && (
              <span className="text-muted-foreground">
                RFE: <strong className="text-foreground">{Math.round(overall.rfe_probability_pct)}%</strong>
              </span>
            )}
          </div>
        )}
        {!isStreaming && data && (
          <button
            onClick={() => setShowConfirm(true)}
            className="mt-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors underline"
          >
            Re-run assessment
          </button>
        )}
        {showConfirm && !isStreaming && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-muted-foreground">Re-run?</span>
            <button onClick={runAssessment} className="text-[10px] text-primary font-medium hover:underline">Yes</button>
            <button onClick={() => setShowConfirm(false)} className="text-[10px] text-muted-foreground hover:underline">No</button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Gauge */}
        {overall?.denial_probability_pct != null && (
          <div className="flex justify-center">
            <SemiCircleGauge value={overall.denial_probability_pct} />
          </div>
        )}

        {/* Summary */}
        {overall?.summary && (
          <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">{overall.summary}</p>
        )}

        {/* Kazarian Two-Step */}
        {kazarian && (
          <div className="space-y-2">
            <SectionHeader>Kazarian Two-Step</SectionHeader>
            {kazarian.step1 && (
              <div className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Step 1: Criteria Threshold</span>
                  {kazarian.step1.critical_threshold_met != null && (
                  <span className={cn(
                    "px-2 py-0.5 rounded text-xs font-semibold",
                    kazarian.step1.critical_threshold_met
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                  )}>
                    {kazarian.step1.critical_threshold_met ? "MET" : "NOT MET"}
                  </span>
                  )}
                </div>
                <div className="flex gap-3 mt-1.5 text-[10px] text-muted-foreground">
                  <span>Claimed: {kazarian.step1.criteria_claimed}</span>
                  <span>Likely satisfied: {kazarian.step1.criteria_likely_satisfied}</span>
                </div>
                {kazarian.step1.status && (
                  <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">{kazarian.step1.status}</p>
                )}
              </div>
            )}
            {kazarian.step2 && (
              <div className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Step 2: Final Merits</span>
                  {kazarian.step2.risk_score != null && (
                    <span className="text-[10px] font-mono text-muted-foreground">
                      Risk: {kazarian.step2.risk_score}/100
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {kazarian.step2.sustained_acclaim && (
                    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", getMeritsColor(kazarian.step2.sustained_acclaim))}>
                      Acclaim: {kazarian.step2.sustained_acclaim}
                    </span>
                  )}
                  {kazarian.step2.top_of_field && (
                    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", getMeritsColor(kazarian.step2.top_of_field))}>
                      Top of field: {kazarian.step2.top_of_field}
                    </span>
                  )}
                  {kazarian.step2.geographic_scope && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                      {kazarian.step2.geographic_scope}
                    </span>
                  )}
                  {kazarian.step2.timeline_coverage && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                      {kazarian.step2.timeline_coverage}
                    </span>
                  )}
                </div>
                {kazarian.step2.risk_score != null && (
                  <div className="mt-2">
                    <RiskBar value={kazarian.step2.risk_score} />
                  </div>
                )}
                {kazarian.step2.status && (
                  <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">{kazarian.step2.status}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Field Context */}
        {fieldCtx && (
          <div className="space-y-2">
            <SectionHeader>Field Context</SectionHeader>
            <div className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center gap-2">
                {fieldCtx.field && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                    {fieldCtx.field}
                  </span>
                )}
                {fieldCtx.baseline_approval_rate != null && (
                  <span className="text-[10px] text-muted-foreground">
                    Baseline approval: {fieldCtx.baseline_approval_rate}%
                  </span>
                )}
                {fieldCtx.case_vs_typical && (
                  <span className={cn("text-[10px] font-medium", getComparisonColor(fieldCtx.case_vs_typical))}>
                    vs Typical: {fieldCtx.case_vs_typical}
                  </span>
                )}
              </div>
              {fieldCtx.benchmarks && Object.keys(fieldCtx.benchmarks).length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Benchmarks</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                    {Object.entries(fieldCtx.benchmarks).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
                        <span className="font-medium text-stone-700 dark:text-stone-300">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {fieldCtx.profile_comparison && Object.keys(fieldCtx.profile_comparison).length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Applicant Profile</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                    {Object.entries(fieldCtx.profile_comparison).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
                        <span className="font-medium text-stone-700 dark:text-stone-300">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Criterion Risk Assessments */}
        {criteria && criteria.length > 0 && (
          <div className="space-y-2">
            <SectionHeader>Criterion Risk Assessments</SectionHeader>
            <div className="space-y-2">
              {criteria.map((c, i) => {
                const borderColor = (c.denial_risk ?? 0) > 60
                  ? "border-l-red-500"
                  : (c.denial_risk ?? 0) > 30
                  ? "border-l-amber-500"
                  : "border-l-emerald-500"

                return (
                  <Collapsible key={i}>
                    <div className={cn("rounded-lg border border-l-4 p-3", borderColor)}>
                      <CollapsibleTrigger className="w-full text-left">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {c.classification && (
                            <span className={cn("shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold", getClassificationColor(c.classification))}>
                              {c.classification}
                            </span>
                            )}
                            <span className="text-xs font-semibold text-stone-800 dark:text-stone-200 truncate">
                              {c.criterion_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {c.documentation_status && (
                            <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", getDocStatusColor(c.documentation_status))}>
                              {c.documentation_status}
                            </span>
                            )}
                            <svg className="w-3 h-3 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </div>
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span className="w-16">Evidence</span>
                            <div className="flex-1"><RiskBar value={c.evidence_strength} /></div>
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              <span className="w-16">RFE Risk</span>
                              <div className="flex-1"><RiskBar value={c.rfe_risk} /></div>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              <span className="w-16">Denial Risk</span>
                              <div className="flex-1"><RiskBar value={c.denial_risk} /></div>
                            </div>
                          </div>
                          {c.issues && c.issues.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Issues</p>
                              <ul className="text-xs text-stone-600 dark:text-stone-400 space-y-0.5">
                                {c.issues.map((issue, j) => (
                                  <li key={j} className="flex gap-1.5">
                                    <span className="shrink-0 text-muted-foreground">-</span>
                                    <span>{issue}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                )
              })}
            </div>
          </div>
        )}

        {/* Letter Portfolio Analysis */}
        {letters && (
          <div className="space-y-2">
            <SectionHeader>Letter Portfolio</SectionHeader>
            <div className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center gap-2">
                {letters.portfolio_risk && (
                <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold", getRiskColor(letters.portfolio_risk).badge)}>
                  {letters.portfolio_risk}
                </span>
                )}
                <span className="text-xs text-muted-foreground">{letters.total_letters} total letters</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Independent</span>
                  <p className="font-semibold">{letters.independent_count} ({letters.independent_pct}%)</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Collaborative</span>
                  <p className="font-semibold">{letters.collaborative_count}</p>
                </div>
                {letters.geographic_diversity && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Geographic diversity</span>
                    <p className="font-medium">{letters.geographic_diversity}</p>
                  </div>
                )}
              </div>
              {letters.issues && letters.issues.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Issues</p>
                  <ul className="text-xs text-stone-600 dark:text-stone-400 space-y-0.5">
                    {letters.issues.map((issue, i) => (
                      <li key={i} className="flex gap-1.5">
                        <span className="shrink-0 text-muted-foreground">-</span>
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Red Flags */}
        {flags && flags.length > 0 && (
          <div className="space-y-2">
            <SectionHeader>Red Flags ({flags.length})</SectionHeader>
            <div className="space-y-1.5">
              {flags.map((flag, i) => {
                const fColor = flag.level === "HIGH"
                  ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50"
                  : flag.level === "MEDIUM"
                  ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50"
                  : "bg-muted/50 border-border"
                const badgeColor = flag.level === "HIGH"
                  ? "bg-red-600 text-white"
                  : flag.level === "MEDIUM"
                  ? "bg-amber-500 text-white"
                  : "bg-stone-400 text-white"
                return (
                  <div key={i} className={cn("rounded-lg border p-2.5 flex items-start gap-2", fColor)}>
                    <span className={cn("shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold mt-0.5", badgeColor)}>
                      {flag.level}
                    </span>
                    <span className="text-xs text-stone-700 dark:text-stone-300">{flag.description}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Strengths */}
        {strengths && strengths.length > 0 && (
          <div className="space-y-2">
            <SectionHeader>Strengths</SectionHeader>
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-3">
              <ul className="text-xs text-stone-600 dark:text-stone-400 space-y-1">
                {strengths.map((s, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="shrink-0 text-emerald-500">-</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Recommendations */}
        {recs && (
          <div className="space-y-2">
            <SectionHeader>Recommendations</SectionHeader>
            {recs.critical && recs.critical.length > 0 && (
              <Collapsible defaultOpen>
                <div className="rounded-lg border border-l-4 border-l-red-500 border-border">
                  <CollapsibleTrigger className="w-full text-left px-3 py-2.5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-red-700 dark:text-red-300">
                      Critical ({recs.critical.length})
                    </span>
                    <svg className="w-3 h-3 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-3 pb-3 space-y-2">
                      {recs.critical.map((r, i) => (
                        <div key={i} className="text-xs">
                          <p className="font-semibold text-stone-800 dark:text-stone-200">{r.action}</p>
                          <p className="text-stone-500 dark:text-stone-400 mt-0.5">{r.guidance}</p>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )}
            {recs.high_priority && recs.high_priority.length > 0 && (
              <Collapsible>
                <div className="rounded-lg border border-l-4 border-l-amber-500 border-border">
                  <CollapsibleTrigger className="w-full text-left px-3 py-2.5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                      High Priority ({recs.high_priority.length})
                    </span>
                    <svg className="w-3 h-3 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-3 pb-3 space-y-2">
                      {recs.high_priority.map((r, i) => (
                        <div key={i} className="text-xs">
                          <p className="font-semibold text-stone-800 dark:text-stone-200">{r.action}</p>
                          <p className="text-stone-500 dark:text-stone-400 mt-0.5">{r.guidance}</p>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )}
            {recs.moderate_priority && recs.moderate_priority.length > 0 && (
              <Collapsible>
                <div className="rounded-lg border border-l-4 border-l-blue-500 border-border">
                  <CollapsibleTrigger className="w-full text-left px-3 py-2.5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                      Moderate ({recs.moderate_priority.length})
                    </span>
                    <svg className="w-3 h-3 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-3 pb-3 space-y-2">
                      {recs.moderate_priority.map((r, i) => (
                        <div key={i} className="text-xs">
                          <p className="font-semibold text-stone-800 dark:text-stone-200">{r.action}</p>
                          <p className="text-stone-500 dark:text-stone-400 mt-0.5">{r.guidance}</p>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )}
          </div>
        )}

        {/* Filing Recommendation */}
        {filing && (
          <div className="space-y-2">
            <SectionHeader>Filing Recommendation</SectionHeader>
            <div className="rounded-lg border border-border p-3">
              {filing.recommendation && (
              <span className={cn("px-2.5 py-1 rounded text-xs font-bold", getFilingColor(filing.recommendation))}>
                {filing.recommendation.replace(/_/g, " ")}
              </span>
              )}
              {filing.rationale && (
                <p className="text-xs text-stone-600 dark:text-stone-400 mt-2 leading-relaxed">{filing.rationale}</p>
              )}
            </div>
          </div>
        )}

        {/* Probability Breakdown */}
        {breakdown && (
          <div className="space-y-2">
            <SectionHeader>Probability Breakdown</SectionHeader>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground">Factor</th>
                    <th className="text-right px-3 py-1.5 font-semibold text-muted-foreground">Impact</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50">
                    <td className="px-3 py-1.5 font-medium text-stone-700 dark:text-stone-300">Base denial rate</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                      {breakdown.base_denial_rate}%
                    </td>
                  </tr>
                  {breakdown.adjustments?.map((adj, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="px-3 py-1.5 text-stone-600 dark:text-stone-400 pl-5">{adj.factor}</td>
                      <td className={cn(
                        "px-3 py-1.5 text-right font-mono tabular-nums font-medium",
                        adj.delta_pct > 0 ? "text-red-600 dark:text-red-400" : adj.delta_pct < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                      )}>
                        {adj.delta_pct > 0 ? "+" : ""}{adj.delta_pct}%
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-muted/30 font-semibold">
                    <td className="px-3 py-2 text-stone-800 dark:text-stone-200">Final denial probability</td>
                    <td className={cn(
                      "px-3 py-2 text-right font-mono tabular-nums",
                      (breakdown.final_denial_probability ?? 0) > 60
                        ? "text-red-600 dark:text-red-400"
                        : (breakdown.final_denial_probability ?? 0) > 30
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    )}>
                      {breakdown.final_denial_probability}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
