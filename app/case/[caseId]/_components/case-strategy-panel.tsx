"use client"

import { useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import type { CaseStrategy } from "@/lib/case-strategy-schema"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface CaseStrategyPanelProps {
  caseId: string
  initialData?: CaseStrategy | null
  hasGapAnalysis?: boolean
}

type StrategyData = CaseStrategy["case_strategy"]

function getEffortColor(effort: string) {
  switch (effort) {
    case "LOW": return "bg-emerald-600 text-white"
    case "MEDIUM": return "bg-amber-500 text-white"
    case "HIGH": return "bg-red-600 text-white"
    default: return "bg-muted text-muted-foreground"
  }
}

function getLikelihoodColor(likelihood: string) {
  switch (likelihood) {
    case "LOW": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
    case "MEDIUM": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
    case "HIGH": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
    default: return "bg-muted text-muted-foreground"
  }
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{children}</h4>
}

export function CaseStrategyPanel({ caseId, initialData, hasGapAnalysis }: CaseStrategyPanelProps) {
  const [data, setData] = useState<Partial<StrategyData> | null>(initialData?.case_strategy ?? null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(!!initialData)

  const loadExisting = useCallback(async () => {
    if (hasLoaded) return
    try {
      const res = await fetch(`/api/case/${caseId}/case-strategy`)
      if (res.ok) {
        const result = await res.json()
        if (result?.case_strategy) setData(result.case_strategy)
      }
    } catch (err) {
      console.error("Failed to load case strategy:", err)
    } finally {
      setHasLoaded(true)
    }
  }, [caseId, hasLoaded])

  useState(() => { loadExisting() })

  const runStrategy = useCallback(async () => {
    setShowConfirm(false)
    setIsStreaming(true)
    setData(null)

    try {
      const res = await fetch(`/api/case/${caseId}/case-strategy`, {
        method: "POST",
      })
      if (!res.ok) throw new Error("Case strategy failed")

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
              setData(partial?.case_strategy ?? partial)
            } catch {
              // partial JSON, skip
            }
          }
        }
      }
    } catch (err) {
      console.error("Case strategy error:", err)
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
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-1">
          Case Strategy
        </h3>
        <p className="text-xs text-stone-500 dark:text-stone-400 max-w-xs mb-4">
          Generate an actionable filing plan with criteria selection, evidence priorities, letter strategy, timeline, and budget.
        </p>

        {!hasGapAnalysis && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">
            Run Gap Analysis first before case strategy.
          </p>
        )}

        {showConfirm ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-stone-600 dark:text-stone-400">
              This will analyze all case data + gap analysis. Proceed?
            </p>
            <div className="flex gap-2">
              <button
                onClick={runStrategy}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Run Strategy
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
            disabled={!hasGapAnalysis}
            className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Run Case Strategy
          </button>
        )}
      </div>
    )
  }

  const summary = data?.strategy_summary
  const criteria = data?.recommended_criteria
  const avoid = data?.criteria_to_avoid
  const evidence = data?.evidence_collection_plan
  const letters = data?.recommendation_letter_strategy
  const timeline = data?.filing_timeline
  const budget = data?.budget_estimate
  const risks = data?.risk_mitigation
  const narrative = data?.final_merits_narrative

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              Case Strategy
            </h3>
            {isStreaming && (
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            )}
          </div>
          {criteria && criteria.length > 0 && (
            <span className="text-xs font-mono text-muted-foreground">
              {criteria.length} criteria recommended
            </span>
          )}
        </div>
        {!isStreaming && data && (
          <button
            onClick={() => setShowConfirm(true)}
            className="mt-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors underline"
          >
            Re-run strategy
          </button>
        )}
        {showConfirm && !isStreaming && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-muted-foreground">Re-run?</span>
            <button onClick={runStrategy} className="text-[10px] text-primary font-medium hover:underline">Yes</button>
            <button onClick={() => setShowConfirm(false)} className="text-[10px] text-muted-foreground hover:underline">No</button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Strategy Summary */}
        {summary && (
          <div className="space-y-2">
            <SectionHeader>Strategy Summary</SectionHeader>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">{summary}</p>
            </div>
          </div>
        )}

        {/* Recommended Criteria */}
        {criteria && criteria.length > 0 && (
          <div className="space-y-2">
            <SectionHeader>Recommended Criteria</SectionHeader>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Criterion</th>
                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Strength</th>
                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Effort</th>
                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Key Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {criteria.map((c, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="px-2 py-1.5 font-medium">{c.criterion}</td>
                      <td className="px-2 py-1.5 text-stone-600 dark:text-stone-400 max-w-[180px]">
                        {c.strength_assessment}
                      </td>
                      <td className="px-2 py-1.5">
                        <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold", getEffortColor(c.effort_level))}>
                          {c.effort_level}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-stone-600 dark:text-stone-400">
                        <ul className="space-y-0.5">
                          {c.key_actions?.map((a, j) => <li key={j}>- {a}</li>)}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Criteria to Avoid */}
        {avoid && avoid.length > 0 && (
          <div className="space-y-2">
            <SectionHeader>Criteria to Avoid</SectionHeader>
            <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 p-3 space-y-2">
              {avoid.map((c, i) => (
                <div key={i} className="text-xs">
                  <p className="font-medium text-stone-800 dark:text-stone-200">{c.criterion}</p>
                  <p className="text-stone-500 dark:text-stone-400">{c.reason}</p>
                  <p className="text-red-600 dark:text-red-400 text-[10px]">Risk: {c.risk_if_included}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Evidence Collection Plan */}
        {evidence && (
          <div className="space-y-2">
            <SectionHeader>Evidence Collection Plan</SectionHeader>
            <div className="space-y-2">
              {[
                { label: "Immediate (0-2 weeks)", data: evidence.immediate_actions, color: "border-l-red-500" },
                { label: "Short Term (2-8 weeks)", data: evidence.short_term_actions, color: "border-l-amber-500" },
                { label: "Long Term (2-6 months)", data: evidence.long_term_actions, color: "border-l-blue-500" },
              ].map(({ label, data: actions, color }) => {
                if (!actions?.length) return null
                return (
                  <div key={label} className={cn("rounded-lg border border-border border-l-4 p-3", color)}>
                    <span className="text-xs font-semibold text-stone-800 dark:text-stone-200 block mb-1.5">{label}</span>
                    <div className="space-y-1.5">
                      {actions.map((a, i) => (
                        <div key={i} className="text-xs pl-2 border-l-2 border-primary/30">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-stone-800 dark:text-stone-200">{a.action}</span>
                            <span className="px-1 py-0.5 rounded text-[9px] bg-muted text-muted-foreground">
                              {a.responsible_party}
                            </span>
                          </div>
                          <div className="flex gap-3 text-[10px] text-muted-foreground mt-0.5">
                            {a.deadline && <span>Deadline: {a.deadline}</span>}
                            {a.expected_outcome && <span>Outcome: {a.expected_outcome}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Letter Strategy */}
        {letters && (
          <div className="space-y-2">
            <SectionHeader>Recommendation Letter Strategy</SectionHeader>
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex flex-wrap gap-3 text-xs">
                <span>Total: <strong>{letters.total_letters}</strong></span>
                <span>Independent: <strong>{letters.independent_count}</strong></span>
                <span>Collaborative: <strong>{letters.collaborative_count}</strong></span>
              </div>
              {letters.letter_assignments && letters.letter_assignments.length > 0 && (
                <div className="space-y-2">
                  {letters.letter_assignments.map((letter, i) => (
                    <Collapsible key={i}>
                      <div className="rounded border border-border/50 p-2">
                        <CollapsibleTrigger className="w-full text-left">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-muted-foreground">#{letter.letter_number}</span>
                              <span className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-medium",
                                letter.recommender_type === "INDEPENDENT"
                                  ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                              )}>
                                {letter.recommender_type === "INDEPENDENT" ? "Independent" : "Collaborative"}
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
                            {letter.criteria_addressed?.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {letter.criteria_addressed.map((c) => (
                                  <span key={c} className="px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary font-medium">{c}</span>
                                ))}
                              </div>
                            )}
                            {letter.key_points?.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Key Points</p>
                                <ul className="text-stone-600 dark:text-stone-400 space-y-0.5">
                                  {letter.key_points.map((t, j) => <li key={j}>- {t}</li>)}
                                </ul>
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

        {/* Filing Timeline */}
        {timeline && timeline.phases && timeline.phases.length > 0 && (
          <div className="space-y-2">
            <SectionHeader>Filing Timeline</SectionHeader>
            <div className="space-y-2">
              {timeline.phases.map((phase, i) => {
                const colors = [
                  "border-l-red-500",
                  "border-l-amber-500",
                  "border-l-blue-500",
                  "border-l-emerald-500",
                ]
                return (
                  <div key={i} className={cn("rounded-lg border border-border border-l-4 p-3", colors[i % colors.length])}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-stone-800 dark:text-stone-200">{phase.phase}</span>
                      <span className="text-[10px] text-muted-foreground">{phase.timeframe}</span>
                    </div>
                    <ul className="text-xs text-stone-600 dark:text-stone-400 space-y-1">
                      {phase.tasks?.map((t, j) => <li key={j}>- {t}</li>)}
                    </ul>
                  </div>
                )
              })}
            </div>
            {timeline.critical_path_items && timeline.critical_path_items.length > 0 && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Critical Path</p>
                <ul className="text-xs text-stone-600 dark:text-stone-400 space-y-0.5">
                  {timeline.critical_path_items.map((item, i) => <li key={i}>- {item}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Budget Estimate */}
        {budget && (
          <div className="space-y-2">
            <SectionHeader>Budget Estimate</SectionHeader>
            <div className="rounded-lg border border-border p-3">
              {budget.line_items && budget.line_items.length > 0 && (
                <div className="space-y-1 mb-2">
                  {budget.line_items.map((item, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-stone-600 dark:text-stone-400">{item.category}</span>
                      <span className="font-medium text-stone-800 dark:text-stone-200">{item.estimated_range}</span>
                    </div>
                  ))}
                </div>
              )}
              {budget.total_estimated_range && (
                <div className="flex justify-between text-xs pt-2 border-t border-border font-semibold">
                  <span>Total</span>
                  <span>{budget.total_estimated_range}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Risk Mitigation */}
        {risks && (
          <div className="space-y-2">
            <SectionHeader>Risk Mitigation</SectionHeader>
            <div className="rounded-lg border border-border p-3 space-y-3">
              {risks.primary_risks && risks.primary_risks.length > 0 && (
                <div className="space-y-2">
                  {risks.primary_risks.map((r, i) => (
                    <Collapsible key={i}>
                      <CollapsibleTrigger className="w-full text-left">
                        <div className="flex items-center gap-2">
                          <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold", getLikelihoodColor(r.likelihood))}>
                            {r.likelihood}
                          </span>
                          <span className="text-xs font-medium text-stone-800 dark:text-stone-200">{r.risk}</span>
                          <svg className="w-3 h-3 text-muted-foreground shrink-0 ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <p className="text-xs text-stone-500 dark:text-stone-400 mt-1.5 pl-2 border-l-2 border-primary/30">
                          {r.mitigation}
                        </p>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              )}
              {risks.rfe_preparedness && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">RFE Preparedness</p>
                  <p className="text-xs text-stone-600 dark:text-stone-400">{risks.rfe_preparedness}</p>
                </div>
              )}
              {risks.fallback_plan && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Fallback Plan</p>
                  <p className="text-xs text-stone-600 dark:text-stone-400">{risks.fallback_plan}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Final Merits Narrative */}
        {narrative && (
          <div className="space-y-2">
            <SectionHeader>Final Merits Narrative</SectionHeader>
            <div className="rounded-lg border border-border p-3 space-y-2">
              {narrative.positioning && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Positioning</p>
                  <p className="text-xs text-stone-700 dark:text-stone-300">{narrative.positioning}</p>
                </div>
              )}
              {narrative.sustained_acclaim && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Sustained Acclaim</p>
                  <p className="text-xs text-stone-600 dark:text-stone-400">{narrative.sustained_acclaim}</p>
                </div>
              )}
              {narrative.differentiators && narrative.differentiators.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Differentiators</p>
                  <ul className="text-xs text-stone-600 dark:text-stone-400 space-y-0.5">
                    {narrative.differentiators.map((d, i) => <li key={i}>- {d}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
