"use client"

import { cn } from "@/lib/utils"
import type { CaseConsolidation } from "@/lib/case-consolidation-schema"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface CaseStrategyConsolidatedPanelProps {
  initialData?: CaseConsolidation | null
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{children}</h4>
}

function ReadinessBadge({ readiness }: { readiness: string }) {
  const color = readiness === "READY"
    ? "bg-emerald-600 text-white"
    : readiness === "READY_WITH_GAPS"
    ? "bg-amber-500 text-white"
    : "bg-red-600 text-white"
  return <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold", color)}>{readiness.replace(/_/g, " ")}</span>
}

function RiskLevelBadge({ level }: { level: string }) {
  const color = level === "LOW"
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
    : level === "MODERATE"
    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
  return <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold", color)}>{level}</span>
}

export function CaseStrategyConsolidatedPanel({ initialData }: CaseStrategyConsolidatedPanelProps) {
  const data = initialData?.case_consolidation

  if (!data) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-1">
          Consolidated Strategy
        </h3>
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Run Consolidation first to view strategy details.
        </p>
      </div>
    )
  }

  const strategy = data.petition_strategy
  const letters = data.recommendation_letter_strategy
  const structure = data.petition_structure
  const risk = data.risk_assessment
  const narrative = data.narrative_anchors

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
            Consolidated Strategy
          </h3>
          {strategy?.filing_readiness && (
            <ReadinessBadge readiness={strategy.filing_readiness} />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Petition Strategy */}
        {strategy && (
          <div className="space-y-2">
            <SectionHeader>Petition Strategy</SectionHeader>
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex flex-wrap gap-3 text-xs">
                <span>Criteria: <strong>{strategy.recommended_criteria_count}</strong></span>
                <span>Approval: <strong>{strategy.approval_probability_range}</strong></span>
                <span>RFE: <strong>{strategy.rfe_probability}</strong></span>
              </div>

              <div className="flex flex-wrap gap-1">
                {strategy.primary_criteria?.map(c => (
                  <span key={c} className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 font-medium">{c}</span>
                ))}
                {strategy.backup_criteria?.map(c => (
                  <span key={c} className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 font-medium">{c}</span>
                ))}
              </div>

              {strategy.kazarian_step1_assessment && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Kazarian Step 1</p>
                  <p className="text-xs text-stone-600 dark:text-stone-400">{strategy.kazarian_step1_assessment}</p>
                </div>
              )}
              {strategy.kazarian_step2_assessment && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Kazarian Step 2</p>
                  <p className="text-xs text-stone-600 dark:text-stone-400">{strategy.kazarian_step2_assessment}</p>
                </div>
              )}
              {strategy.filing_readiness_rationale && (
                <p className="text-xs text-stone-500 dark:text-stone-400 italic">{strategy.filing_readiness_rationale}</p>
              )}

              {strategy.field_specific_context && (
                <Collapsible>
                  <CollapsibleTrigger className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                    Field Context
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-1.5 space-y-1 text-xs text-stone-600 dark:text-stone-400">
                      <p>Field: {strategy.field_specific_context.field}</p>
                      <p>Typical approval: {strategy.field_specific_context.typical_approval_rate}</p>
                      <p>Citation benchmark: {strategy.field_specific_context.citation_benchmark}</p>
                      <p>Pub benchmark: {strategy.field_specific_context.publication_benchmark}</p>
                      <p>vs Benchmark: {strategy.field_specific_context.candidate_vs_benchmark}</p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          </div>
        )}

        {/* Recommendation Letter Strategy */}
        {letters && (
          <div className="space-y-2">
            <SectionHeader>Recommendation Letter Strategy</SectionHeader>
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex flex-wrap gap-3 text-xs">
                <span>Total: <strong>{letters.total_letters_recommended}</strong></span>
                <span>Independence: <strong>{letters.independence_ratio}</strong></span>
              </div>
              <p className="text-[10px] text-muted-foreground">{letters.geographic_distribution}</p>

              {letters.letters_planned?.length > 0 && (
                <div className="space-y-2">
                  {letters.letters_planned.map((letter, i) => (
                    <Collapsible key={i}>
                      <div className="rounded border border-border/50 p-2">
                        <CollapsibleTrigger className="w-full text-left">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-muted-foreground">#{letter.letter_number}</span>
                              <span className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-medium",
                                letter.priority === "ESSENTIAL"
                                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                  : letter.priority === "IMPORTANT"
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                  : "bg-muted text-muted-foreground"
                              )}>
                                {letter.priority}
                              </span>
                              <span className="text-xs font-medium text-stone-700 dark:text-stone-300 truncate">
                                {letter.suggested_profile}
                              </span>
                            </div>
                            <svg className="w-3 h-3 text-muted-foreground shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-2 pt-2 border-t border-border/30 space-y-1.5 text-xs">
                            <p className="text-muted-foreground">{letter.recommender_type} | {letter.independence_level} | {letter.geographic_preference}</p>
                            {letter.criteria_to_cover?.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {letter.criteria_to_cover.map(c => (
                                  <span key={c} className="px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary font-medium">{c}</span>
                                ))}
                              </div>
                            )}
                            {letter.key_points_to_address?.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Key Points</p>
                                <ul className="text-stone-600 dark:text-stone-400 space-y-0.5">
                                  {letter.key_points_to_address.map((p, j) => <li key={j}>- {p}</li>)}
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

              {letters.red_flags_to_avoid?.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="text-[10px] font-semibold text-red-600 dark:text-red-400 uppercase flex items-center gap-1">
                    Red Flags to Avoid
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ul className="mt-1 text-xs text-stone-600 dark:text-stone-400 space-y-0.5">
                      {letters.red_flags_to_avoid.map((f, i) => <li key={i}>- {f}</li>)}
                    </ul>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          </div>
        )}

        {/* Petition Structure */}
        {structure && (
          <div className="space-y-2">
            <SectionHeader>Petition Structure</SectionHeader>
            <div className="rounded-lg border border-border p-3 space-y-3">
              <p className="text-xs text-muted-foreground">Recommended: ~{structure.recommended_total_pages} pages</p>

              {structure.section_outline?.length > 0 && (
                <div className="space-y-1.5">
                  {structure.section_outline.map((s, i) => (
                    <Collapsible key={i}>
                      <CollapsibleTrigger className="w-full text-left">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-stone-800 dark:text-stone-200">
                            {s.section_number}. {s.section_title}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground">{s.recommended_pages}pp</span>
                            <svg className="w-3 h-3 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-1.5 pl-3 border-l-2 border-primary/30 text-xs space-y-1">
                          {s.key_content && <p className="text-stone-600 dark:text-stone-400">{s.key_content}</p>}
                          {s.subsections?.map((sub, j) => (
                            <div key={j} className="pl-2 border-l border-border/50 space-y-0.5">
                              <p className="font-medium text-stone-700 dark:text-stone-300">{sub.criterion}: {sub.criterion_name} ({sub.recommended_pages}pp)</p>
                              <p className="text-stone-500 dark:text-stone-400">{sub.key_argument}</p>
                              <p className="text-[10px] text-muted-foreground">Lead: {sub.lead_evidence}</p>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              )}

              {structure.exhibit_plan?.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                    Exhibit Plan
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-1 space-y-0.5 text-xs">
                      {structure.exhibit_plan.map((e, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="font-mono text-muted-foreground w-8 shrink-0">Ex. {e.exhibit}</span>
                          <span className="text-stone-600 dark:text-stone-400">{e.content}</span>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          </div>
        )}

        {/* Risk Assessment */}
        {risk && (
          <div className="space-y-2">
            <SectionHeader>Risk Assessment</SectionHeader>
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-center gap-2">
                <RiskLevelBadge level={risk.overall_risk_level} />
                <span className="text-xs text-muted-foreground">RFE: {risk.rfe_probability}</span>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-400">{risk.overall_risk_rationale}</p>

              {risk.likely_rfe_targets?.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase">Likely RFE Targets</p>
                  {risk.likely_rfe_targets.map((t, i) => (
                    <div key={i} className="text-xs pl-2 border-l-2 border-amber-300 dark:border-amber-800">
                      <p className="font-medium text-stone-800 dark:text-stone-200">{t.criterion}: {t.likely_challenge}</p>
                      <p className="text-stone-500 dark:text-stone-400">{t.preemptive_strategy}</p>
                    </div>
                  ))}
                </div>
              )}

              {risk.strengths_to_leverage?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Strengths to Leverage</p>
                  <ul className="text-xs text-stone-600 dark:text-stone-400 space-y-0.5">
                    {risk.strengths_to_leverage.map((s, i) => <li key={i}>- {s}</li>)}
                  </ul>
                </div>
              )}

              {risk.mitigation_strategies?.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                    Mitigation Strategies
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-1.5 space-y-1.5">
                      {risk.mitigation_strategies.map((m, i) => (
                        <div key={i} className="text-xs pl-2 border-l-2 border-primary/30">
                          <p className="font-medium text-stone-800 dark:text-stone-200">{m.strategy}</p>
                          <p className="text-stone-500 dark:text-stone-400">{m.implementation}</p>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          </div>
        )}

        {/* Narrative Anchors */}
        {narrative && (
          <div className="space-y-2">
            <SectionHeader>Narrative Anchors</SectionHeader>
            <div className="rounded-lg border border-border p-3 space-y-3">
              {narrative.one_line_summary && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">One-Line Summary</p>
                  <p className="text-xs font-medium text-stone-800 dark:text-stone-200">{narrative.one_line_summary}</p>
                </div>
              )}
              {narrative.three_sentence_narrative && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Three-Sentence Narrative</p>
                  <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">{narrative.three_sentence_narrative}</p>
                </div>
              )}
              {narrative.kazarian_step2_narrative && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Kazarian Step 2 Narrative</p>
                  <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">{narrative.kazarian_step2_narrative}</p>
                </div>
              )}
              {narrative.proposed_field_definition && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Proposed Field Definition</p>
                  <p className="text-xs font-medium text-stone-700 dark:text-stone-300">{narrative.proposed_field_definition}</p>
                  {narrative.field_definition_rationale && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">{narrative.field_definition_rationale}</p>
                  )}
                </div>
              )}
              {narrative.key_differentiators?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Key Differentiators</p>
                  <ul className="text-xs text-stone-600 dark:text-stone-400 space-y-0.5">
                    {narrative.key_differentiators.map((d, i) => <li key={i}>- {d}</li>)}
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
