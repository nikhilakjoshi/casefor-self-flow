"use client"

import { useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import type { CaseConsolidation } from "@/lib/case-consolidation-schema"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface CaseConsolidationPanelProps {
  caseId: string
  initialData?: CaseConsolidation | null
  hasCaseStrategy?: boolean
}

type ConsolidationData = CaseConsolidation["case_consolidation"]

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{children}</h4>
}

function ClassificationBadge({ classification }: { classification: string }) {
  const color = classification === "PRIMARY"
    ? "bg-emerald-600 text-white"
    : classification === "BACKUP"
    ? "bg-amber-500 text-white"
    : "bg-red-600 text-white"
  return <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold", color)}>{classification}</span>
}

function RiskBadge({ level }: { level: string }) {
  const color = level === "low" || level === "LOW"
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
    : level === "medium" || level === "MODERATE" || level === "MEDIUM"
    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
  return <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold", color)}>{level.toUpperCase()}</span>
}

function SeverityBadge({ severity }: { severity: string }) {
  const color = severity === "LOW"
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
    : severity === "MEDIUM"
    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
    : severity === "HIGH"
    ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
  return <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold", color)}>{severity}</span>
}

export function CaseConsolidationPanel({ caseId, initialData, hasCaseStrategy }: CaseConsolidationPanelProps) {
  const [data, setData] = useState<Partial<ConsolidationData> | null>(initialData?.case_consolidation ?? null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(!!initialData)

  const loadExisting = useCallback(async () => {
    if (hasLoaded) return
    try {
      const res = await fetch(`/api/case/${caseId}/case-consolidation`)
      if (res.ok) {
        const result = await res.json()
        if (result?.case_consolidation) setData(result.case_consolidation)
      }
    } catch (err) {
      console.error("Failed to load case consolidation:", err)
    } finally {
      setHasLoaded(true)
    }
  }, [caseId, hasLoaded])

  useState(() => { loadExisting() })

  const runConsolidation = useCallback(async () => {
    setShowConfirm(false)
    setIsStreaming(true)
    setData(null)

    try {
      const res = await fetch(`/api/case/${caseId}/case-consolidation`, {
        method: "POST",
      })
      if (!res.ok) throw new Error("Case consolidation failed")

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
              setData(partial?.case_consolidation ?? partial)
            } catch {
              // partial JSON, skip
            }
          }
        }
      }
    } catch (err) {
      console.error("Case consolidation error:", err)
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
            <path d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-1">
          Case Consolidation
        </h3>
        <p className="text-xs text-stone-500 dark:text-stone-400 max-w-xs mb-4">
          Consolidate all upstream outputs into a master case profile for petition drafting.
        </p>

        {!hasCaseStrategy && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">
            Run Case Strategy first before consolidation.
          </p>
        )}

        {showConfirm ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-stone-600 dark:text-stone-400">
              This will consolidate all pipeline data. Proceed?
            </p>
            <div className="flex gap-2">
              <button
                onClick={runConsolidation}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Run Consolidation
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
            disabled={!hasCaseStrategy}
            className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Run Consolidation
          </button>
        )}
      </div>
    )
  }

  const profile = data?.candidate_profile
  const ranking = data?.criteria_ranking
  const inventory = data?.evidence_inventory
  const gaps = data?.gap_remediation_priorities

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              Case Consolidation
            </h3>
            {isStreaming && (
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            )}
          </div>
          {ranking && ranking.length > 0 && (
            <span className="text-xs font-mono text-muted-foreground">
              {ranking.filter(c => c.classification === "PRIMARY").length} primary criteria
            </span>
          )}
        </div>
        {!isStreaming && data && (
          <button
            onClick={() => setShowConfirm(true)}
            className="mt-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors underline"
          >
            Re-run consolidation
          </button>
        )}
        {showConfirm && !isStreaming && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-muted-foreground">Re-run?</span>
            <button onClick={runConsolidation} className="text-[10px] text-primary font-medium hover:underline">Yes</button>
            <button onClick={() => setShowConfirm(false)} className="text-[10px] text-muted-foreground hover:underline">No</button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Candidate Profile */}
        {profile && (
          <div className="space-y-2">
            <SectionHeader>Candidate Profile</SectionHeader>
            <div className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">{profile.name}</span>
                <span className="text-[10px] text-muted-foreground">{profile.years_experience} yrs exp</span>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-400">
                {profile.current_position} at {profile.institution}
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Field: {profile.field_of_expertise}
              </p>
              {profile.education_summary && (
                <p className="text-xs text-stone-500 dark:text-stone-400">{profile.education_summary}</p>
              )}
              {profile.key_metrics && (
                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border/50">
                  {[
                    { label: "Pubs", value: profile.key_metrics.total_publications },
                    { label: "Citations", value: profile.key_metrics.total_citations },
                    { label: "h-index", value: profile.key_metrics.h_index },
                    { label: "Awards", value: profile.key_metrics.awards_count },
                  ].map(({ label, value }) => (
                    <div key={label} className="text-center">
                      <div className="text-sm font-bold text-stone-900 dark:text-stone-100">{value}</div>
                      <div className="text-[10px] text-muted-foreground">{label}</div>
                    </div>
                  ))}
                </div>
              )}
              {profile.geographic_recognition_countries?.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {profile.geographic_recognition_countries.map(c => (
                    <span key={c} className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">{c}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Criteria Ranking */}
        {ranking && ranking.length > 0 && (
          <div className="space-y-2">
            <SectionHeader>Criteria Ranking</SectionHeader>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">#</th>
                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Criterion</th>
                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Class</th>
                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Tier</th>
                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Score</th>
                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">RFE</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((c, i) => (
                    <Collapsible key={i} asChild>
                      <>
                        <CollapsibleTrigger asChild>
                          <tr className="border-b border-border/50 last:border-0 cursor-pointer hover:bg-muted/30">
                            <td className="px-2 py-1.5 font-mono text-muted-foreground">{c.rank}</td>
                            <td className="px-2 py-1.5 font-medium">{c.criterion}: {c.name}</td>
                            <td className="px-2 py-1.5"><ClassificationBadge classification={c.classification} /></td>
                            <td className="px-2 py-1.5 font-mono">{c.tier}</td>
                            <td className="px-2 py-1.5 font-mono">{c.verification_score?.toFixed(1)}</td>
                            <td className="px-2 py-1.5"><RiskBadge level={c.rfe_risk} /></td>
                          </tr>
                        </CollapsibleTrigger>
                        <CollapsibleContent asChild>
                          <tr>
                            <td colSpan={6} className="px-3 py-2 bg-muted/20">
                              <div className="space-y-1.5 text-xs">
                                <p className="text-stone-600 dark:text-stone-400">{c.rationale}</p>
                                {c.evidence_summary && (
                                  <p className="text-stone-500 dark:text-stone-400 italic">{c.evidence_summary}</p>
                                )}
                                <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                                  <span>Verified: {c.verified_claims_count}</span>
                                  <span>Unverified: {c.unverified_claims_count}</span>
                                  {c.red_flags_count > 0 && (
                                    <span className="text-red-500">Red flags: {c.red_flags_count}</span>
                                  )}
                                  <span>Step 1: {c.kazarian_step1_met ? "Met" : "Not met"}</span>
                                </div>
                                {c.red_flag_details?.length > 0 && (
                                  <div className="text-red-600 dark:text-red-400">
                                    {c.red_flag_details.map((f, j) => <p key={j}>- {f}</p>)}
                                  </div>
                                )}
                                {c.missing_documents?.length > 0 && (
                                  <div>
                                    <span className="text-[10px] font-semibold text-muted-foreground">Missing: </span>
                                    {c.missing_documents.join(", ")}
                                  </div>
                                )}
                                {c.rfe_likely_issue && (
                                  <p className="text-amber-600 dark:text-amber-400">RFE issue: {c.rfe_likely_issue}</p>
                                )}
                              </div>
                            </td>
                          </tr>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Evidence Inventory */}
        {inventory && (
          <div className="space-y-2">
            <SectionHeader>Evidence Inventory</SectionHeader>
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex flex-wrap gap-3 text-xs">
                <span>Uploaded: <strong>{inventory.total_documents_uploaded}</strong></span>
                <span>Verified: <strong>{inventory.total_documents_verified}</strong></span>
              </div>

              {inventory.tier_distribution && (
                <div className="flex gap-2">
                  {Object.entries(inventory.tier_distribution).map(([tier, count]) => (
                    <div key={tier} className="text-center px-2 py-1 rounded bg-muted/50">
                      <div className="text-xs font-bold">{count as number}</div>
                      <div className="text-[9px] text-muted-foreground">{tier.replace("_", " ")}</div>
                    </div>
                  ))}
                </div>
              )}

              {inventory.evidence_to_remove?.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="w-full text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 uppercase">
                        Evidence to Remove ({inventory.evidence_to_remove.length})
                      </span>
                      <svg className="w-3 h-3 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-1.5 space-y-1.5">
                      {inventory.evidence_to_remove.map((e, i) => (
                        <div key={i} className="text-xs pl-2 border-l-2 border-red-300 dark:border-red-800">
                          <p className="font-medium text-stone-800 dark:text-stone-200">{e.document} ({e.criterion})</p>
                          <p className="text-stone-500 dark:text-stone-400">{e.reason}</p>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {inventory.evidence_to_obtain?.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="w-full text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase">
                        Evidence to Obtain ({inventory.evidence_to_obtain.length})
                      </span>
                      <svg className="w-3 h-3 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-1.5 space-y-1.5">
                      {inventory.evidence_to_obtain.map((e, i) => (
                        <div key={i} className="text-xs pl-2 border-l-2 border-amber-300 dark:border-amber-800">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-stone-800 dark:text-stone-200">{e.document_type}</span>
                            <SeverityBadge severity={e.priority} />
                          </div>
                          <p className="text-stone-500 dark:text-stone-400">{e.description}</p>
                          <p className="text-[10px] text-muted-foreground">{e.estimated_effort} | If missing: {e.impact_if_missing}</p>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          </div>
        )}

        {/* Gap Remediation Priorities */}
        {gaps && gaps.length > 0 && (
          <div className="space-y-2">
            <SectionHeader>Gap Remediation Priorities</SectionHeader>
            <div className="space-y-2">
              {gaps.map((g, i) => (
                <Collapsible key={i}>
                  <div className="rounded-lg border border-border p-2">
                    <CollapsibleTrigger className="w-full text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-muted-foreground">#{g.priority_rank}</span>
                        <SeverityBadge severity={g.impact_severity} />
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">{g.type?.replace(/_/g, " ")}</span>
                        <span className="text-xs font-medium text-stone-700 dark:text-stone-300 truncate flex-1">
                          {g.description}
                        </span>
                        <svg className="w-3 h-3 text-muted-foreground shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 pt-2 border-t border-border/30 space-y-1.5 text-xs">
                        <p className="text-stone-600 dark:text-stone-400"><strong>Criterion:</strong> {g.criterion}</p>
                        <p className="text-stone-600 dark:text-stone-400"><strong>Action:</strong> {g.action_required}</p>
                        <div className="flex gap-3 text-[10px] text-muted-foreground">
                          <span>Owner: {g.responsible_party}</span>
                          <span>Effort: {g.estimated_effort}</span>
                        </div>
                        <p className="text-red-600 dark:text-red-400 text-[10px]">If unresolved: {g.impact_if_unresolved}</p>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
