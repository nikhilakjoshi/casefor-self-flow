"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { CRITERIA_LABELS } from "@/lib/evidence-verification-schema"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface RoutedDocument {
  id: string
  documentId: string
  name: string
  category: string | null
  score: number
  recommendation: string
  autoRouted: boolean
}

interface CriterionRouting {
  criterion: string
  documents: RoutedDocument[]
}

interface CaseDocument {
  id: string
  name: string
  category: string | null
}

interface RoutingData {
  routings: Record<string, CriterionRouting>
  documents: CaseDocument[]
}

const ALL_CRITERIA = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10"]

function getRecommendationStyle(rec: string) {
  switch (rec) {
    case "STRONG":
      return "bg-emerald-600 text-white"
    case "INCLUDE_WITH_SUPPORT":
      return "bg-blue-600 text-white"
    case "MANUAL":
      return "bg-purple-600/20 text-purple-700 dark:text-purple-300 border border-purple-400/50"
    default:
      return "bg-muted text-muted-foreground"
  }
}

function ScoreBar({ score }: { score: number }) {
  if (score === 0) return null
  const pct = (score / 10) * 100
  const color = score >= 7 ? "bg-emerald-500" : score >= 5 ? "bg-amber-500" : "bg-red-500"
  return (
    <div className="flex items-center gap-1.5 w-20">
      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground w-6 text-right">{score.toFixed(1)}</span>
    </div>
  )
}

function AssignDropdown({
  criterion,
  documents,
  alreadyAssigned,
  onAssign,
}: {
  criterion: string
  documents: CaseDocument[]
  alreadyAssigned: Set<string>
  onAssign: (documentId: string, criterion: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  const available = documents.filter((d) => !alreadyAssigned.has(d.id))

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        disabled={available.length === 0}
        className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground rounded border border-dashed border-border hover:border-muted-foreground/50 transition-colors disabled:opacity-30 disabled:cursor-default"
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" />
          <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
        </svg>
        Assign doc
      </button>
      {open && available.length > 0 && (
        <div className="absolute top-full left-0 mt-1 z-50 w-64 max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
          {available.map((doc) => (
            <button
              key={doc.id}
              onClick={() => {
                onAssign(doc.id, criterion)
                setOpen(false)
              }}
              className="w-full text-left px-3 py-2 text-xs text-stone-700 dark:text-stone-300 hover:bg-muted/60 transition-colors flex items-center gap-2 border-b border-border/50 last:border-0"
            >
              <svg className="w-3 h-3 text-muted-foreground shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="truncate">{doc.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CriterionSection({
  criterion,
  routing,
  allDocuments,
  onRemove,
  onAssign,
}: {
  criterion: string
  routing: CriterionRouting | undefined
  allDocuments: CaseDocument[]
  onRemove: (documentId: string, criterion: string) => void
  onAssign: (documentId: string, criterion: string) => void
}) {
  const docs = routing?.documents ?? []
  const isEmpty = docs.length === 0
  const assignedIds = new Set(docs.map((d) => d.documentId))

  return (
    <Collapsible defaultOpen={!isEmpty}>
      <div className={cn(
        "rounded-lg border transition-colors",
        isEmpty ? "border-border/50 bg-muted/20" : "border-border"
      )}>
        <CollapsibleTrigger className="w-full text-left">
          <div className={cn(
            "flex items-center gap-2 px-3 py-2",
            isEmpty ? "opacity-50" : ""
          )}>
            <span className="text-[10px] font-bold text-muted-foreground w-7 shrink-0">{criterion}</span>
            <span className="text-xs font-medium text-stone-800 dark:text-stone-200 flex-1 truncate">
              {CRITERIA_LABELS[criterion] ?? criterion}
            </span>
            <span className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
              docs.length > 0
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground"
            )}>
              {docs.length} doc{docs.length !== 1 ? "s" : ""}
            </span>
            <svg className="w-3 h-3 text-muted-foreground shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border/50">
            {docs.length > 0 ? (
              <div className="divide-y divide-border/30">
                {docs.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-2 px-3 py-2 group">
                    <svg className="w-3 h-3 text-muted-foreground shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round" />
                      <polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-xs text-stone-700 dark:text-stone-300 truncate flex-1 min-w-0">
                      {doc.name}
                    </span>
                    <ScoreBar score={doc.score} />
                    <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 uppercase tracking-wide", getRecommendationStyle(doc.recommendation))}>
                      {doc.recommendation.replace(/_/g, " ")}
                    </span>
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[9px] shrink-0",
                      doc.autoRouted
                        ? "bg-muted text-muted-foreground"
                        : "border border-purple-400/60 text-purple-600 dark:text-purple-400"
                    )}>
                      {doc.autoRouted ? "auto" : "manual"}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemove(doc.documentId, criterion)
                      }}
                      className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                      title="Remove from criterion"
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-3 py-3">
                <p className="text-[11px] text-muted-foreground/60 italic">No documents routed</p>
              </div>
            )}
            <div className="px-3 py-2 border-t border-border/30 bg-muted/20">
              <AssignDropdown
                criterion={criterion}
                documents={allDocuments}
                alreadyAssigned={assignedIds}
                onAssign={onAssign}
              />
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

export function CriteriaRoutingPanel({ caseId }: { caseId: string }) {
  const [data, setData] = useState<RoutingData | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [isReRouting, setIsReRouting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/case/${caseId}/criteria-routing`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (err) {
      console.error("Failed to load routing data:", err)
    } finally {
      setHasLoaded(true)
    }
  }, [caseId])

  useEffect(() => {
    if (!hasLoaded) load()
  }, [hasLoaded, load])

  const handleRemove = useCallback(async (documentId: string, criterion: string) => {
    // Optimistic update
    setData((prev) => {
      if (!prev) return prev
      const updated = { ...prev, routings: { ...prev.routings } }
      if (updated.routings[criterion]) {
        updated.routings[criterion] = {
          ...updated.routings[criterion],
          documents: updated.routings[criterion].documents.filter((d) => d.documentId !== documentId),
        }
      }
      return updated
    })

    try {
      await fetch(`/api/case/${caseId}/criteria-routing`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, criterion, action: "remove" }),
      })
    } catch {
      load() // revert on error
    }
  }, [caseId, load])

  const handleAssign = useCallback(async (documentId: string, criterion: string) => {
    const doc = data?.documents.find((d) => d.id === documentId)
    if (!doc) return

    // Optimistic update
    setData((prev) => {
      if (!prev) return prev
      const updated = { ...prev, routings: { ...prev.routings } }
      if (!updated.routings[criterion]) {
        updated.routings[criterion] = { criterion, documents: [] }
      }
      updated.routings[criterion] = {
        ...updated.routings[criterion],
        documents: [...updated.routings[criterion].documents, {
          id: "temp-" + documentId,
          documentId,
          name: doc.name,
          category: doc.category,
          score: 0,
          recommendation: "MANUAL",
          autoRouted: false,
        }],
      }
      return updated
    })

    try {
      await fetch(`/api/case/${caseId}/criteria-routing`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, criterion, action: "add" }),
      })
      load() // refresh to get real IDs
    } catch {
      load()
    }
  }, [caseId, data, load])

  const handleReRoute = useCallback(async () => {
    setIsReRouting(true)
    try {
      await fetch(`/api/case/${caseId}/criteria-routing`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "re-route" }),
      })
      await load()
    } catch (err) {
      console.error("Re-route error:", err)
    } finally {
      setIsReRouting(false)
    }
  }, [caseId, load])

  const totalRouted = data
    ? Object.values(data.routings).reduce((sum, r) => sum + r.documents.length, 0)
    : 0

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header bar */}
      <div className="shrink-0 px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-xs font-medium text-stone-800 dark:text-stone-200">
              Criteria Routing
            </p>
            {hasLoaded && data && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {totalRouted} assignment{totalRouted !== 1 ? "s" : ""} across {Object.values(data.routings).filter((r) => r.documents.length > 0).length} criteria
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handleReRoute}
          disabled={isReRouting}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors disabled:opacity-50"
        >
          {isReRouting ? (
            <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          Re-route all
        </button>
      </div>

      {/* Criteria list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {!hasLoaded && (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {hasLoaded && data && data.documents.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No evidence documents</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Upload and verify evidence in the Evidence List tab first</p>
          </div>
        )}

        {hasLoaded && data && data.documents.length > 0 && ALL_CRITERIA.map((c) => (
          <CriterionSection
            key={c}
            criterion={c}
            routing={data.routings[c]}
            allDocuments={data.documents}
            onRemove={handleRemove}
            onAssign={handleAssign}
          />
        ))}
      </div>
    </div>
  )
}
