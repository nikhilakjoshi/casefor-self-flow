"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { GapAnalysisPanel } from "./gap-analysis-panel"
import { CaseStrategyPanel } from "./case-strategy-panel"
import type { GapAnalysis } from "@/lib/gap-analysis-schema"
import type { CaseStrategy } from "@/lib/case-strategy-schema"

interface PlanningTabProps {
  caseId: string
  initialGapAnalysis?: GapAnalysis | null
  initialCaseStrategy?: CaseStrategy | null
  hasStrengthEval?: boolean
}

export function PlanningTab({
  caseId,
  initialGapAnalysis,
  initialCaseStrategy,
  hasStrengthEval,
}: PlanningTabProps) {
  const [gapOpen, setGapOpen] = useState(true)
  const [strategyOpen, setStrategyOpen] = useState(false)

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Gap Analysis section */}
      <div className="border-b border-border">
        <button
          onClick={() => setGapOpen(!gapOpen)}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors"
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
            hasStrengthEval={hasStrengthEval}
          />
        )}
      </div>

      {/* Case Strategy section */}
      <div className="border-b border-border">
        <button
          onClick={() => setStrategyOpen(!strategyOpen)}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors"
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
