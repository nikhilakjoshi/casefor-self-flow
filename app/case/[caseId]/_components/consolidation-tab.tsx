"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { CaseConsolidationPanel } from "./case-consolidation-panel"
import { CaseStrategyConsolidatedPanel } from "./case-strategy-consolidated-panel"
import type { CaseConsolidation } from "@/lib/case-consolidation-schema"

interface ConsolidationTabProps {
  caseId: string
  initialCaseConsolidation?: CaseConsolidation | null
  initialCaseStrategy?: boolean
}

export function ConsolidationTab({
  caseId,
  initialCaseConsolidation,
  initialCaseStrategy,
}: ConsolidationTabProps) {
  const [consolidationOpen, setConsolidationOpen] = useState(true)
  const [strategyOpen, setStrategyOpen] = useState(false)

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Consolidation section */}
      <div className="border-b border-border">
        <button
          onClick={() => setConsolidationOpen(!consolidationOpen)}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors"
        >
          <ChevronDown
            className={cn(
              "w-4 h-4 text-muted-foreground transition-transform",
              !consolidationOpen && "-rotate-90"
            )}
          />
          <span className="text-sm font-semibold">Consolidation</span>
        </button>
        {consolidationOpen && (
          <CaseConsolidationPanel
            caseId={caseId}
            initialData={initialCaseConsolidation}
            hasCaseStrategy={initialCaseStrategy}
          />
        )}
      </div>

      {/* Strategy section */}
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
          <span className="text-sm font-semibold">Strategy</span>
        </button>
        {strategyOpen && (
          <CaseStrategyConsolidatedPanel
            initialData={initialCaseConsolidation}
          />
        )}
      </div>
    </div>
  )
}
