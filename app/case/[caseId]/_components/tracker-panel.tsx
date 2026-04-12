"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { cn } from "@/lib/utils"
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

interface CoverageRow {
  criterionKey: string
  criterionName: string
  strength: string
  docs: Array<{
    documentId: string
    documentName: string
    score: number
    recommendation: string
  }>
  docCount: number
}

interface DocRow {
  id: string
  name: string
  type: string
  category: string | null
  status: string
  source: string
  criteriaSupported: string[]
  criteriaCount: number
  createdAt: string
}

interface GapRow {
  priority: string
  criterion: string
  criterionName: string
  issue: string
  currentState: string
  requiredState: string
  timeline: string
  existingDocs: number
  actions: string[]
}

interface TrackerData {
  summary: {
    totalCriteria: number
    coveredCriteria: number
    strongCriteria: number
    totalDocs: number
    routedDocs: number
    unroutedDocs: number
    totalGaps: number
    highPriorityGaps: number
  }
  coverageMatrix: CoverageRow[]
  documentTable: DocRow[]
  gaps: GapRow[]
}

type Tab = "coverage" | "documents" | "gaps"

export function TrackerPanel({ caseId }: { caseId: string }) {
  const [data, setData] = useState<TrackerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>("coverage")
  const didFetch = useRef(false)

  const fetchTracker = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/case/${caseId}/tracker`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [caseId])

  useEffect(() => {
    if (didFetch.current) return
    didFetch.current = true
    fetchTracker()
  }, [fetchTracker])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--ash)]" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--ash)] text-sm">
        Failed to load tracker data.
      </div>
    )
  }

  const { summary } = data

  const tabs: { key: Tab; label: string }[] = [
    { key: "coverage", label: "Evidence Coverage" },
    { key: "documents", label: `Documents (${summary.totalDocs})` },
    { key: "gaps", label: `Gaps (${summary.totalGaps})` },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Summary stats */}
      <div className="shrink-0 p-4 border-b border-[var(--cream)]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif text-[1.15rem] font-medium text-[var(--ink)]">
            Case Tracker
          </h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              didFetch.current = false
              fetchTracker()
            }}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Refresh
          </Button>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <Stat
            label="Criteria covered"
            value={`${summary.coveredCriteria}/${summary.totalCriteria}`}
            color={
              summary.coveredCriteria >= summary.totalCriteria
                ? "var(--green-ok)"
                : "var(--amber-warn)"
            }
          />
          <Stat
            label="Strong criteria"
            value={String(summary.strongCriteria)}
            color="var(--green-ok)"
          />
          <Stat
            label="Docs routed"
            value={`${summary.routedDocs}/${summary.totalDocs}`}
            color="var(--accent-gold)"
          />
          <Stat
            label="High-priority gaps"
            value={String(summary.highPriorityGaps)}
            color={
              summary.highPriorityGaps > 0
                ? "var(--red-urgent)"
                : "var(--green-ok)"
            }
          />
        </div>
      </div>

      {/* Tab bar */}
      <div className="shrink-0 flex border-b border-[var(--cream)] px-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "px-3 py-2 text-xs font-medium border-b-2 transition-colors",
              tab === t.key
                ? "border-[var(--accent-gold)] text-[var(--ink)]"
                : "border-transparent text-[var(--ash)] hover:text-[var(--ink)]",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4">
          {tab === "coverage" && (
            <CoverageMatrixView rows={data.coverageMatrix} />
          )}
          {tab === "documents" && (
            <DocumentTableView rows={data.documentTable} />
          )}
          {tab === "gaps" && <GapTableView rows={data.gaps} />}
        </div>
      </ScrollArea>
    </div>
  )
}

function Stat({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: string
}) {
  return (
    <div className="bg-[var(--warm-white)] border border-[rgba(12,11,10,0.04)] rounded-[8px] px-3 py-2.5 shadow-[0_1px_3px_rgba(12,11,10,0.04),0_0_0_1px_rgba(12,11,10,0.03)]">
      <div className="text-[0.68rem] font-medium uppercase tracking-wider text-[var(--ash)] mb-1">
        {label}
      </div>
      <div
        className="font-serif text-[1.3rem] font-medium leading-none tabular-nums"
        style={{ color }}
      >
        {value}
      </div>
    </div>
  )
}

function CoverageMatrixView({ rows }: { rows: CoverageRow[] }) {
  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const strengthColor =
          row.strength === "Strong"
            ? "var(--green-ok)"
            : row.strength === "Weak"
              ? "var(--amber-warn)"
              : "var(--stone)"
        const StrengthIcon =
          row.strength === "Strong"
            ? CheckCircle2
            : row.strength === "Weak"
              ? AlertTriangle
              : XCircle

        return (
          <div
            key={row.criterionKey}
            className="bg-[var(--warm-white)] border border-[rgba(12,11,10,0.04)] rounded-[8px] p-3 shadow-[var(--shadow-card)]"
          >
            <div className="flex items-center gap-2 mb-2">
              <StrengthIcon
                className="w-4 h-4 shrink-0"
                style={{ color: strengthColor }}
              />
              <span className="font-mono text-[0.7rem] text-[var(--ash)] tabular-nums">
                {row.criterionKey}
              </span>
              <span className="text-[0.84rem] font-medium text-[var(--ink)]">
                {row.criterionName}
              </span>
              <span
                className="ml-auto text-[0.68rem] font-medium px-2 py-0.5 rounded-full"
                style={{
                  background:
                    row.strength === "Strong"
                      ? "var(--green-bg)"
                      : row.strength === "Weak"
                        ? "var(--amber-bg)"
                        : "var(--cream)",
                  color: strengthColor,
                }}
              >
                {row.strength}
              </span>
            </div>
            {row.docs.length > 0 ? (
              <div className="space-y-1 pl-6">
                {row.docs.map((d) => (
                  <div
                    key={d.documentId}
                    className="flex items-center gap-2 text-[0.78rem]"
                  >
                    <FileText className="w-3 h-3 text-[var(--ash)] shrink-0" />
                    <span className="text-[var(--charcoal)] truncate flex-1">
                      {d.documentName}
                    </span>
                    <span className="font-mono text-[0.68rem] tabular-nums text-[var(--ash)]">
                      {d.score.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="pl-6 text-[0.75rem] text-[var(--ash)] italic">
                No documents routed to this criterion
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function DocumentTableView({ rows }: { rows: DocRow[] }) {
  return (
    <div className="border border-[var(--cream)] rounded-[8px] overflow-hidden bg-[var(--warm-white)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--cream)] bg-[var(--parchment)]">
            <th className="text-left px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--ash)]">
              Document
            </th>
            <th className="text-left px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--ash)] w-24">
              Category
            </th>
            <th className="text-left px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--ash)] w-16">
              Status
            </th>
            <th className="text-left px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--ash)] w-20">
              Criteria
            </th>
            <th className="text-left px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--ash)] w-16">
              Source
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr
              key={d.id}
              className="border-b border-[rgba(12,11,10,0.03)] last:border-b-0 hover:bg-[var(--accent-gold-subtle)] transition-colors"
            >
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-[var(--ash)] shrink-0" />
                  <span className="truncate max-w-[260px] text-[var(--ink)]">
                    {d.name}
                  </span>
                </div>
              </td>
              <td className="px-3 py-2">
                {d.category ? (
                  <span className="text-[0.68rem] px-1.5 py-0.5 rounded-[4px] bg-[var(--cream)] text-[var(--charcoal)]">
                    {d.category.replace(/_/g, " ").toLowerCase()}
                  </span>
                ) : (
                  <span className="text-[var(--stone)] text-[0.68rem]">--</span>
                )}
              </td>
              <td className="px-3 py-2">
                <span
                  className="text-[0.68rem] px-1.5 py-0.5 rounded-full font-medium"
                  style={{
                    background:
                      d.status === "FINAL"
                        ? "var(--green-bg)"
                        : "var(--amber-bg)",
                    color:
                      d.status === "FINAL"
                        ? "var(--green-ok)"
                        : "var(--amber-warn)",
                  }}
                >
                  {d.status}
                </span>
              </td>
              <td className="px-3 py-2 font-mono text-[0.72rem] tabular-nums text-[var(--charcoal)]">
                {d.criteriaCount > 0 ? d.criteriaCount : "--"}
              </td>
              <td className="px-3 py-2 text-[0.68rem] text-[var(--ash)]">
                {d.source === "USER_UPLOADED" ? "Upload" : "AI"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GapTableView({ rows }: { rows: GapRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--ash)] text-sm">
        No gaps identified. Run gap analysis to populate this view.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {rows.map((g, i) => {
        const priorityColor =
          g.priority === "HIGH"
            ? "var(--red-urgent)"
            : g.priority === "MEDIUM"
              ? "var(--amber-warn)"
              : "var(--green-ok)"
        const priorityBg =
          g.priority === "HIGH"
            ? "var(--red-bg)"
            : g.priority === "MEDIUM"
              ? "var(--amber-bg)"
              : "var(--green-bg)"

        return (
          <div
            key={i}
            className="bg-[var(--warm-white)] border border-[rgba(12,11,10,0.04)] rounded-[8px] p-4 shadow-[var(--shadow-card)]"
          >
            <div className="flex items-start gap-3 mb-2">
              <span
                className="shrink-0 text-[0.65rem] font-semibold px-2 py-0.5 rounded-full uppercase"
                style={{ background: priorityBg, color: priorityColor }}
              >
                {g.priority}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[0.84rem] font-medium text-[var(--ink)]">
                  {g.issue}
                </div>
                <div className="text-[0.72rem] text-[var(--ash)] mt-0.5">
                  {g.criterionName} · {g.existingDocs} doc(s) routed · {g.timeline}
                </div>
              </div>
            </div>
            {g.currentState && (
              <div className="grid grid-cols-2 gap-3 mt-3 text-[0.75rem]">
                <div>
                  <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--ash)] mb-0.5">
                    Current
                  </div>
                  <div className="text-[var(--charcoal)]">{g.currentState}</div>
                </div>
                <div>
                  <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--ash)] mb-0.5">
                    Required
                  </div>
                  <div className="text-[var(--charcoal)]">
                    {g.requiredState}
                  </div>
                </div>
              </div>
            )}
            {g.actions.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[rgba(12,11,10,0.04)]">
                <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--ash)] mb-1">
                  Actions
                </div>
                <ul className="space-y-0.5">
                  {g.actions.map((a, j) => (
                    <li
                      key={j}
                      className="text-[0.75rem] text-[var(--charcoal)] flex items-start gap-1.5"
                    >
                      <span className="text-[var(--accent-gold)] mt-1">--</span>
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
