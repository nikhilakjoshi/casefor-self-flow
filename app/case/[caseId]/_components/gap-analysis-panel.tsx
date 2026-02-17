"use client"

import { useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { CRITERION_LABELS, type GapAnalysis } from "@/lib/gap-analysis-schema"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface GapAnalysisPanelProps {
  caseId: string
  initialData?: GapAnalysis | null
  hasStrengthEval?: boolean
}

type GapData = GapAnalysis["gap_analysis"]

function getPriorityColor(priority: string) {
  switch (priority) {
    case "HIGH": return { bg: "bg-red-500/10", text: "text-red-700 dark:text-red-300", badge: "bg-red-600 text-white" }
    case "MEDIUM": return { bg: "bg-amber-500/10", text: "text-amber-700 dark:text-amber-300", badge: "bg-amber-500 text-white" }
    case "LOW": return { bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-300", badge: "bg-emerald-600 text-white" }
    default: return { bg: "bg-muted/60", text: "text-muted-foreground", badge: "bg-muted text-muted-foreground" }
  }
}

function getStrengthColor(strength: string) {
  switch (strength) {
    case "STRONG": return "bg-emerald-600 text-white"
    case "MODERATE": return "bg-amber-500 text-white"
    case "WEAK": return "bg-orange-500 text-white"
    case "NOT_READY": return "bg-red-600 text-white"
    default: return "bg-muted text-muted-foreground"
  }
}

function getRecommendationColor(rec: string) {
  switch (rec) {
    case "FILE_NOW": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
    case "WAIT_3_MONTHS": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
    case "WAIT_6_MONTHS": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
    case "WAIT_12_MONTHS": return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
    case "CONSIDER_ALTERNATIVE": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
    default: return "bg-muted text-muted-foreground"
  }
}

function getDamageColor(level: string) {
  switch (level) {
    case "CRITICAL": return "bg-red-600 text-white"
    case "MODERATE": return "bg-amber-500 text-white"
    case "MINOR": return "bg-stone-400 text-white"
    default: return "bg-muted text-muted-foreground"
  }
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{children}</h4>
}

export function GapAnalysisPanel({ caseId, initialData, hasStrengthEval }: GapAnalysisPanelProps) {
  const [data, setData] = useState<Partial<GapData> | null>(initialData?.gap_analysis ?? null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(!!initialData)

  // Load existing on mount if no initial data
  const loadExisting = useCallback(async () => {
    if (hasLoaded) return
    try {
      const res = await fetch(`/api/case/${caseId}/gap-analysis`)
      if (res.ok) {
        const result = await res.json()
        if (result?.gap_analysis) setData(result.gap_analysis)
      }
    } catch (err) {
      console.error("Failed to load gap analysis:", err)
    } finally {
      setHasLoaded(true)
    }
  }, [caseId, hasLoaded])

  useState(() => { loadExisting() })

  const runAnalysis = useCallback(async () => {
    setShowConfirm(false)
    setIsStreaming(true)
    setData(null)

    try {
      const res = await fetch(`/api/case/${caseId}/gap-analysis`, {
        method: "POST",
      })
      if (!res.ok) throw new Error("Gap analysis failed")

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
              setData(partial?.gap_analysis ?? partial)
            } catch {
              // partial JSON, skip
            }
          }
        }
      }
    } catch (err) {
      console.error("Gap analysis error:", err)
    } finally {
      setIsStreaming(false)
    }
  }, [caseId])

  // Empty state
  if (!data && !isStreaming) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-1">
          Gap Analysis
        </h3>
        <p className="text-xs text-stone-500 dark:text-stone-400 max-w-xs mb-4">
          Run a comprehensive gap analysis to identify weaknesses, prioritize actions, and get AAO-informed recommendations.
        </p>

        {!hasStrengthEval && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">
            Run Strength Evaluation first before gap analysis.
          </p>
        )}

        {showConfirm ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-stone-600 dark:text-stone-400">
              This will analyze all case data + strength eval. Proceed?
            </p>
            <div className="flex gap-2">
              <button
                onClick={runAnalysis}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Run Analysis
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
            disabled={!hasStrengthEval}
            className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Run Gap Analysis
          </button>
        )}
      </div>
    )
  }

  const exec = data?.executive_summary
  const gaps = data?.critical_gaps
  const filing = data?.filing_decision
  const evidence = data?.evidence_to_remove
  const letters = data?.expert_letter_strategy
  const roadmap = data?.evidence_building_roadmap
  const step2 = data?.step2_strengthening

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              Gap Analysis
            </h3>
            {isStreaming && (
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            )}
          </div>
          {/* Strength badge hidden */}
        </div>
        {exec && (
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            {exec.high_priority_gaps > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 font-medium">
                {exec.high_priority_gaps} high
              </span>
            )}
            {exec.medium_priority_gaps > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 font-medium">
                {exec.medium_priority_gaps} medium
              </span>
            )}
            {exec.low_priority_gaps > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 font-medium">
                {exec.low_priority_gaps} low
              </span>
            )}
            {exec.estimated_timeline_to_ready && (
              <span className="text-[10px] text-muted-foreground">
                Timeline: {exec.estimated_timeline_to_ready}
              </span>
            )}
          </div>
        )}
        {!isStreaming && data && (
          <button
            onClick={() => setShowConfirm(true)}
            className="mt-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors underline"
          >
            Re-run analysis
          </button>
        )}
        {showConfirm && !isStreaming && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-muted-foreground">Re-run?</span>
            <button onClick={runAnalysis} className="text-[10px] text-primary font-medium hover:underline">Yes</button>
            <button onClick={() => setShowConfirm(false)} className="text-[10px] text-muted-foreground hover:underline">No</button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Gap Summary Table */}
        {gaps && gaps.length > 0 && (
          <div className="space-y-2">
            <SectionHeader>Gap Summary</SectionHeader>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Criterion</th>
                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Priority</th>
                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Issue</th>
                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">RFE Risk</th>
                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {[...gaps]
                    .sort((a, b) => {
                      const order = { HIGH: 0, MEDIUM: 1, LOW: 2 }
                      return (order[a.priority] ?? 3) - (order[b.priority] ?? 3)
                    })
                    .map((gap, i) => {
                      const pColor = getPriorityColor(gap.priority)
                      const rfeColor = getPriorityColor(gap.rfe_risk_if_unfixed)
                      return (
                        <tr key={i} className={cn("border-b border-border/50 last:border-0", pColor.bg)}>
                          <td className="px-2 py-1.5 font-medium">
                            {CRITERION_LABELS[`${gap.criterion}_${Object.keys(CRITERION_LABELS).find(k => k.startsWith(gap.criterion))?.split("_").slice(1).join("_") ?? ""}`] ?? gap.criterion}
                          </td>
                          <td className="px-2 py-1.5">
                            <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold", pColor.badge)}>
                              {gap.priority}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-stone-600 dark:text-stone-400 max-w-[200px] truncate">
                            {gap.issue}
                          </td>
                          <td className="px-2 py-1.5">
                            <span className={cn("text-[10px] font-medium", rfeColor.text)}>
                              {gap.rfe_risk_if_unfixed}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-stone-600 dark:text-stone-400">
                            {gap.impact}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Executive Summary and Filing Decision hidden */}

        {/* Critical Gaps Detail */}
        {gaps && gaps.length > 0 && (
          <div className="space-y-2">
            <SectionHeader>Critical Gaps</SectionHeader>
            <div className="space-y-2">
              {[...gaps]
                .sort((a, b) => {
                  const order = { HIGH: 0, MEDIUM: 1, LOW: 2 }
                  return (order[a.priority] ?? 3) - (order[b.priority] ?? 3)
                })
                .map((gap, i) => {
                  const pColor = getPriorityColor(gap.priority)
                  return (
                    <Collapsible key={i}>
                      <div className={cn("rounded-lg border p-3", pColor.bg)}>
                        <CollapsibleTrigger className="w-full text-left">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={cn("shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold", pColor.badge)}>
                                {gap.priority}
                              </span>
                              <span className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                                {gap.criterion}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {gap.timeline && (
                                <span className="text-[10px] text-muted-foreground">{gap.timeline}</span>
                              )}
                              <svg className="w-3 h-3 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
                          </div>
                          <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">{gap.issue}</p>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                            {gap.aao_basis && (
                              <div>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">AAO Basis</p>
                                <p className="text-xs text-stone-600 dark:text-stone-400">{gap.aao_basis}</p>
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {gap.current_state && (
                                <div>
                                  <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Current</p>
                                  <p className="text-stone-600 dark:text-stone-400">{gap.current_state}</p>
                                </div>
                              )}
                              {gap.required_state && (
                                <div>
                                  <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Required</p>
                                  <p className="text-stone-600 dark:text-stone-400">{gap.required_state}</p>
                                </div>
                              )}
                            </div>
                            {gap.actions && gap.actions.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Actions</p>
                                <div className="space-y-1.5">
                                  {gap.actions.map((a, j) => (
                                    <div key={j} className="text-xs pl-2 border-l-2 border-primary/30">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-medium text-stone-800 dark:text-stone-200">{a.action}</span>
                                        <span className="px-1 py-0.5 rounded text-[9px] bg-muted text-muted-foreground">
                                          {a.responsible_party}
                                        </span>
                                      </div>
                                      {a.detail && (
                                        <p className="text-stone-500 dark:text-stone-400 mt-0.5">{a.detail}</p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                              {gap.estimated_cost && <span>Cost: {gap.estimated_cost}</span>}
                              {gap.impact && <span>Impact: {gap.impact}</span>}
                              {gap.rfe_risk_if_unfixed && <span>RFE if unfixed: {gap.rfe_risk_if_unfixed}</span>}
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  )
                })}
            </div>
          </div>
        )}

        {/* Evidence to Remove */}
        {evidence && evidence.length > 0 && (
          <div className="space-y-2">
            <SectionHeader>Evidence to Remove</SectionHeader>
            <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 p-3 space-y-2">
              {evidence.map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className={cn("shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold mt-0.5", getDamageColor(item.damage_level))}>
                    {item.damage_level}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-stone-800 dark:text-stone-200">{item.item}</p>
                    <p className="text-stone-500 dark:text-stone-400">
                      {item.category} | {item.criterion_affected} | {item.reason_for_removal}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expert Letter Strategy */}
        {letters && (
          <div className="space-y-2">
            <SectionHeader>Expert Letter Strategy</SectionHeader>
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex flex-wrap gap-3 text-xs">
                <span>Total: <strong>{letters.total_letters_needed}</strong></span>
                <span>Inner: <strong>{letters.inner_circle_count}</strong></span>
                <span>Outer: <strong>{letters.outer_circle_count}</strong></span>
              </div>
              {letters.geographic_diversity && (
                <p className="text-xs text-stone-500 dark:text-stone-400">{letters.geographic_diversity}</p>
              )}
              {letters.letters && letters.letters.length > 0 && (
                <div className="space-y-2">
                  {letters.letters.map((letter, i) => (
                    <Collapsible key={i}>
                      <div className="rounded border border-border/50 p-2">
                        <CollapsibleTrigger className="w-full text-left">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-muted-foreground">#{letter.letter_number}</span>
                              <span className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-medium",
                                letter.recommender_type === "INNER_CIRCLE"
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                  : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                              )}>
                                {letter.recommender_type === "INNER_CIRCLE" ? "Inner" : "Outer"}
                              </span>
                              <span className="text-xs font-medium text-stone-700 dark:text-stone-300 truncate">
                                {letter.target_profile}
                              </span>
                            </div>
                            <svg className="w-3 h-3 text-muted-foreground shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-2 pt-2 border-t border-border/30 space-y-1.5 text-xs">
                            {letter.criteria_to_address?.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {letter.criteria_to_address.map((c) => (
                                  <span key={c} className="px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary font-medium">{c}</span>
                                ))}
                              </div>
                            )}
                            {letter.key_topics?.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Topics</p>
                                <ul className="text-stone-600 dark:text-stone-400 space-y-0.5">
                                  {letter.key_topics.map((t, j) => <li key={j}>- {t}</li>)}
                                </ul>
                              </div>
                            )}
                            {letter.independence_requirement && (
                              <div>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Independence</p>
                                <p className="text-stone-600 dark:text-stone-400">{letter.independence_requirement}</p>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Evidence Building Roadmap */}
        {roadmap && (
          <div className="space-y-2">
            <SectionHeader>Evidence Building Roadmap</SectionHeader>
            <div className="space-y-2">
              {[
                { label: "Immediate", data: roadmap.immediate_actions, color: "border-l-red-500" },
                { label: "Short Term", data: roadmap.short_term, color: "border-l-amber-500" },
                { label: "Medium Term", data: roadmap.medium_term, color: "border-l-blue-500" },
                { label: "Long Term", data: roadmap.long_term, color: "border-l-emerald-500" },
              ].map(({ label, data: phase, color }) => {
                if (!phase?.actions?.length) return null
                return (
                  <div key={label} className={cn("rounded-lg border border-border border-l-4 p-3", color)}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-stone-800 dark:text-stone-200">{label}</span>
                      <span className="text-[10px] text-muted-foreground">{phase.timeframe}</span>
                    </div>
                    <ul className="text-xs text-stone-600 dark:text-stone-400 space-y-1">
                      {phase.actions.map((a, i) => <li key={i}>- {a}</li>)}
                    </ul>
                    {phase.only_if && (
                      <p className="text-[10px] text-muted-foreground mt-1 italic">Only if: {phase.only_if}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Step 2 Strengthening */}
        {step2 && (
          <div className="space-y-2">
            <SectionHeader>Step 2 Strengthening</SectionHeader>
            <div className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex flex-wrap gap-2">
                {step2.sustained_acclaim_assessment && (
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-medium",
                    step2.sustained_acclaim_assessment === "STRONG"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                      : step2.sustained_acclaim_assessment === "MODERATE"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                  )}>
                    Acclaim: {step2.sustained_acclaim_assessment}
                  </span>
                )}
                {step2.geographic_scope && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                    Scope: {step2.geographic_scope}
                  </span>
                )}
                {step2.temporal_coverage && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                    Coverage: {step2.temporal_coverage}
                  </span>
                )}
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                  Field comparison: {step2.field_comparison_available ? "Yes" : "No"}
                </span>
              </div>
              {step2.actions_to_strengthen_step2 && step2.actions_to_strengthen_step2.length > 0 && (
                <ul className="text-xs text-stone-600 dark:text-stone-400 space-y-1">
                  {step2.actions_to_strengthen_step2.map((a, i) => <li key={i}>- {a}</li>)}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
