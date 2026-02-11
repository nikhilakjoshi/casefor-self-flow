"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { CRITERIA_LABELS } from "@/lib/evidence-verification-schema"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface CriterionResult {
  criterion: string
  version: number
  score: number
  recommendation: string
  data: {
    document_type: string
    evidence_tier: number
    score: number
    verified_claims: string[]
    unverified_claims: string[]
    missing_documentation: string[]
    red_flags: string[]
    recommendation: string
    reasoning: string
    [key: string]: unknown
  }
}

interface DocumentEntry {
  document: {
    id: string
    name: string
    category: string | null
    classificationConfidence: number | null
  }
  criteria: Record<string, CriterionResult>
}

interface EvidenceListPanelProps {
  caseId: string
}

function getRecommendationColor(rec: string) {
  switch (rec) {
    case "STRONG": return "bg-emerald-600 text-white"
    case "INCLUDE_WITH_SUPPORT": return "bg-blue-600 text-white"
    case "NEEDS_MORE_DOCS": return "bg-amber-500 text-white"
    case "EXCLUDE": return "bg-red-600 text-white"
    default: return "bg-muted text-muted-foreground"
  }
}

function getTierColor(tier: number) {
  if (tier <= 1) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
  if (tier <= 2) return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
  if (tier <= 3) return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
  return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
}

function getOverallRecommendation(criteria: Record<string, CriterionResult>): string {
  const recs = Object.values(criteria).map((c) => c.recommendation)
  if (recs.includes("STRONG")) return "STRONG"
  if (recs.includes("INCLUDE_WITH_SUPPORT")) return "INCLUDE_WITH_SUPPORT"
  if (recs.includes("NEEDS_MORE_DOCS")) return "NEEDS_MORE_DOCS"
  return "EXCLUDE"
}

function ScoreBar({ score }: { score: number }) {
  const pct = (score / 10) * 100
  const color = score >= 7 ? "bg-emerald-500" : score >= 5 ? "bg-amber-500" : "bg-red-500"
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground w-7 text-right">{score.toFixed(1)}</span>
    </div>
  )
}

function CriterionCard({ result }: { result: CriterionResult }) {
  const d = result.data
  return (
    <Collapsible>
      <CollapsibleTrigger className="w-full text-left">
        <div className="flex items-center gap-2 py-1.5">
          <span className="text-xs font-medium text-stone-700 dark:text-stone-300 w-24 shrink-0">
            {result.criterion}
          </span>
          <div className="flex-1 min-w-0">
            <ScoreBar score={result.score} />
          </div>
          <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0", getTierColor(d.evidence_tier))}>
            T{d.evidence_tier}
          </span>
          <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0", getRecommendationColor(result.recommendation))}>
            {result.recommendation.replace(/_/g, " ")}
          </span>
          <svg className="w-3 h-3 text-muted-foreground shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-24 pb-3 space-y-2 text-xs">
          {/* Reasoning */}
          <p className="text-stone-600 dark:text-stone-400 leading-relaxed">{d.reasoning}</p>

          {/* Verified claims */}
          {d.verified_claims?.length > 0 && (
            <div>
              <span className="text-[10px] font-semibold text-emerald-600 uppercase">Verified Claims</span>
              <ul className="mt-0.5 space-y-0.5">
                {d.verified_claims.map((c, i) => (
                  <li key={i} className="text-stone-600 dark:text-stone-400 pl-2 border-l-2 border-emerald-300">{c}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Unverified claims */}
          {d.unverified_claims?.length > 0 && (
            <div>
              <span className="text-[10px] font-semibold text-amber-600 uppercase">Unverified Claims</span>
              <ul className="mt-0.5 space-y-0.5">
                {d.unverified_claims.map((c, i) => (
                  <li key={i} className="text-stone-600 dark:text-stone-400 pl-2 border-l-2 border-amber-300">{c}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Red flags */}
          {d.red_flags?.length > 0 && (
            <div>
              <span className="text-[10px] font-semibold text-red-600 uppercase">Red Flags</span>
              <ul className="mt-0.5 space-y-0.5">
                {d.red_flags.map((f, i) => (
                  <li key={i} className="text-red-600 dark:text-red-400 pl-2 border-l-2 border-red-400 font-medium">{f}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Missing docs */}
          {d.missing_documentation?.length > 0 && (
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Missing Documentation</span>
              <ul className="mt-0.5 space-y-0.5">
                {d.missing_documentation.map((m, i) => (
                  <li key={i} className="text-stone-500 dark:text-stone-400 pl-2 border-l-2 border-muted">{m}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function CriterionSkeleton() {
  return (
    <div className="flex items-center gap-2 py-1.5 animate-pulse">
      <div className="w-24 h-4 bg-muted rounded shrink-0" />
      <div className="flex-1 h-1.5 bg-muted rounded-full" />
      <div className="w-8 h-5 bg-muted rounded shrink-0" />
      <div className="w-16 h-5 bg-muted rounded shrink-0" />
    </div>
  )
}

function DocumentCard({
  entry,
  caseId,
  loadingCriteria,
  onReVerify,
  isReVerifying,
}: {
  entry: DocumentEntry
  caseId: string
  loadingCriteria: Set<string>
  onReVerify: (docId: string) => void
  isReVerifying: boolean
}) {
  const allCriteria = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10"]
  const hasResults = Object.keys(entry.criteria).length > 0
  const overall = hasResults ? getOverallRecommendation(entry.criteria) : null

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Doc header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/30 border-b border-border">
        <svg className="w-4 h-4 text-muted-foreground shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-xs font-medium text-stone-800 dark:text-stone-200 truncate flex-1">
          {entry.document.name}
        </span>
        {entry.document.category && (
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary font-medium shrink-0">
            {entry.document.category.replace(/_/g, " ")}
          </span>
        )}
        {overall && (
          <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0", getRecommendationColor(overall))}>
            {overall.replace(/_/g, " ")}
          </span>
        )}
        <button
          onClick={() => onReVerify(entry.document.id)}
          disabled={isReVerifying}
          className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors shrink-0"
          title="Re-verify"
        >
          {isReVerifying ? (
            <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>

      {/* Criteria results */}
      <div className="px-3 py-2 space-y-0.5">
        {allCriteria.map((c) => {
          const key = `${entry.document.id}-${c}`
          if (loadingCriteria.has(key)) {
            return <CriterionSkeleton key={c} />
          }
          if (entry.criteria[c]) {
            return <CriterionCard key={c} result={entry.criteria[c]} />
          }
          return null
        })}
        {!hasResults && loadingCriteria.size === 0 && (
          <p className="text-xs text-muted-foreground italic py-2">No verification results yet</p>
        )}
      </div>
    </div>
  )
}

export function EvidenceListPanel({ caseId }: EvidenceListPanelProps) {
  const [documents, setDocuments] = useState<DocumentEntry[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [loadingCriteria, setLoadingCriteria] = useState<Set<string>>(new Set())
  const [reVerifyingDocs, setReVerifyingDocs] = useState<Set<string>>(new Set())
  const [dragOver, setDragOver] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load existing results
  useEffect(() => {
    if (hasLoaded) return
    async function load() {
      try {
        const res = await fetch(`/api/case/${caseId}/evidence-verify`)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data)) setDocuments(data)
        }
      } catch (err) {
        console.error("Failed to load evidence verifications:", err)
      } finally {
        setHasLoaded(true)
      }
    }
    load()
  }, [caseId, hasLoaded])

  const processSSE = useCallback(async (response: Response) => {
    const reader = response.body?.getReader()
    if (!reader) return

    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue
        try {
          const event = JSON.parse(line.slice(6))

          if (event.type === "doc_started") {
            const docId = event.documentId as string
            setDocuments((prev) => {
              if (prev.find((d) => d.document.id === docId)) return prev
              return [...prev, {
                document: { id: docId, name: event.name, category: null, classificationConfidence: null },
                criteria: {},
              }]
            })
            // Mark all criteria as loading
            setLoadingCriteria((prev) => {
              const next = new Set(prev)
              for (const c of ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10"]) {
                next.add(`${docId}-${c}`)
              }
              return next
            })
          }

          if (event.type === "criterion_complete") {
            const docId = event.documentId as string
            const criterion = event.criterion as string
            setDocuments((prev) =>
              prev.map((d) =>
                d.document.id === docId
                  ? {
                      ...d,
                      criteria: {
                        ...d.criteria,
                        [criterion]: {
                          criterion,
                          version: 1,
                          score: (event.result as { score: number }).score,
                          recommendation: (event.result as { recommendation: string }).recommendation,
                          data: event.result,
                        },
                      },
                    }
                  : d,
              ),
            )
            setLoadingCriteria((prev) => {
              const next = new Set(prev)
              next.delete(`${docId}-${criterion}`)
              return next
            })
          }

          if (event.type === "doc_complete") {
            const docId = event.documentId as string
            setLoadingCriteria((prev) => {
              const next = new Set(prev)
              for (const c of ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10"]) {
                next.delete(`${docId}-${c}`)
              }
              return next
            })
          }
        } catch {
          // partial JSON
        }
      }
    }
  }, [])

  const handleUpload = useCallback(async (files: FileList | File[]) => {
    if (isUploading || !files.length) return
    setIsUploading(true)

    try {
      const formData = new FormData()
      for (const file of Array.from(files)) {
        formData.append("files", file)
      }

      const res = await fetch(`/api/case/${caseId}/evidence-verify`, {
        method: "POST",
        body: formData,
      })

      if (!res.ok) throw new Error("Upload failed")
      await processSSE(res)
    } catch (err) {
      console.error("Evidence upload error:", err)
    } finally {
      setIsUploading(false)
    }
  }, [caseId, isUploading, processSSE])

  const handleReVerify = useCallback(async (documentId: string) => {
    if (reVerifyingDocs.has(documentId)) return

    setReVerifyingDocs((prev) => new Set(prev).add(documentId))

    // Clear existing results for this doc
    setDocuments((prev) =>
      prev.map((d) => d.document.id === documentId ? { ...d, criteria: {} } : d),
    )

    try {
      const res = await fetch(`/api/case/${caseId}/evidence-verify/${documentId}`, {
        method: "POST",
      })
      if (!res.ok) throw new Error("Re-verify failed")
      await processSSE(res)
    } catch (err) {
      console.error("Re-verify error:", err)
    } finally {
      setReVerifyingDocs((prev) => {
        const next = new Set(prev)
        next.delete(documentId)
        return next
      })
    }
  }, [caseId, reVerifyingDocs, processSSE])

  const handleRunAnalysis = useCallback(async () => {
    // Trigger incremental analysis on all uploaded evidence docs
    try {
      const res = await fetch(`/api/case/${caseId}/upload`, {
        method: "POST",
        body: new FormData(), // empty -- just triggers analysis
      })
      if (!res.ok) {
        console.error("Run analysis failed")
      }
    } catch (err) {
      console.error("Run analysis error:", err)
    }
  }, [caseId])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Upload zone */}
      <div className="shrink-0 p-4 border-b border-border">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={(e) => { e.preventDefault(); setDragOver(false) }}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            if (e.dataTransfer.files.length > 0) handleUpload(e.dataTransfer.files)
          }}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-muted-foreground/50",
            isUploading && "opacity-50 pointer-events-none",
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.md,.csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) handleUpload(e.target.files)
              e.target.value = ""
            }}
          />
          {isUploading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-muted-foreground">Uploading & verifying...</span>
            </div>
          ) : (
            <>
              <svg className="w-6 h-6 mx-auto text-muted-foreground mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="text-xs text-muted-foreground">Drop evidence files or click to upload</p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">PDF, DOCX, TXT, MD, CSV, XLSX -- multi-file supported</p>
            </>
          )}
        </div>

        {/* Action buttons */}
        {documents.length > 0 && (
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleRunAnalysis}
              className="px-3 py-1.5 text-[11px] font-medium rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
            >
              Run Analysis
            </button>
          </div>
        )}
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {documents.length === 0 && hasLoaded && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No evidence documents yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Upload files to verify against EB-1A criteria C1-C10</p>
          </div>
        )}

        {documents.map((entry) => (
          <DocumentCard
            key={entry.document.id}
            entry={entry}
            caseId={caseId}
            loadingCriteria={loadingCriteria}
            onReVerify={handleReVerify}
            isReVerifying={reVerifyingDocs.has(entry.document.id)}
          />
        ))}
      </div>
    </div>
  )
}
