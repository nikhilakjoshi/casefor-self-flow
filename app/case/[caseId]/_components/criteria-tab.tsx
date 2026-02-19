"use client"

import { useState } from "react"
import { Layers, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { KeyEvidencePanel } from "./evidence-checklist-panel"
import { CriticalGapsPanel } from "./critical-gaps-panel"
import type { StrengthEvaluation } from "@/lib/strength-evaluation-schema"
import type { GapAnalysis } from "@/lib/gap-analysis-schema"
import type { DetailedExtraction } from "@/lib/eb1a-extraction-schema"

type SidePanel = "evidence" | "gaps" | null

interface CriteriaTabProps {
  caseId: string
  criteriaContent: React.ReactNode
  onNavigateToEvidence: () => void
  strengthEval?: StrengthEvaluation | null
  criteriaNames?: Record<string, string>
  gapAnalysis?: GapAnalysis | null
  extraction?: DetailedExtraction | null
}

export function CriteriaTab({
  caseId,
  criteriaContent,
  onNavigateToEvidence,
  strengthEval,
  criteriaNames,
  gapAnalysis,
  extraction,
}: CriteriaTabProps) {
  const [sidePanel, setSidePanel] = useState<SidePanel>(null)

  const togglePanel = (panel: "evidence" | "gaps") => {
    setSidePanel(prev => (prev === panel ? null : panel))
  }

  const highGapCount = gapAnalysis?.gap_analysis.critical_gaps.filter(g => g.priority === "HIGH").length ?? 0

  return (
    <div className="flex flex-row flex-1 overflow-hidden">
      {/* Left: criteria cards */}
      <div className="flex-1 overflow-y-auto min-w-0">
        <div className="sticky top-0 z-10 bg-background w-full flex items-center gap-2 px-4 py-2.5 border-b border-border">
          <div className="flex-1" />
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => togglePanel("evidence")}
              className={cn(
                "p-1.5 rounded transition-colors",
                sidePanel === "evidence"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
              title="Key evidence"
            >
              <Layers className="w-4 h-4" />
            </button>
            {gapAnalysis && (
              <button
                onClick={() => togglePanel("gaps")}
                className={cn(
                  "relative p-1.5 rounded transition-colors",
                  sidePanel === "gaps"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                title="Critical gaps"
              >
                <AlertTriangle className="w-4 h-4" />
                {highGapCount > 0 && sidePanel !== "gaps" && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center px-0.5">
                    {highGapCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
        <div className="p-2.5 pt-2 space-y-2">{criteriaContent}</div>
      </div>

      {/* Right: side panel */}
      {sidePanel && (
        <div className="w-80 border-l border-border overflow-hidden flex-shrink-0">
          {sidePanel === "evidence" ? (
            <KeyEvidencePanel
              extraction={extraction}
              strengthEval={strengthEval}
              criteriaNames={criteriaNames}
              onClose={() => setSidePanel(null)}
            />
          ) : gapAnalysis ? (
            <CriticalGapsPanel
              gapAnalysis={gapAnalysis}
              criteriaNames={criteriaNames}
              onClose={() => setSidePanel(null)}
            />
          ) : null}
        </div>
      )}
    </div>
  )
}
