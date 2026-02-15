"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { StrengthEvaluationPanel } from "./strength-evaluation-panel"
import type { StrengthEvaluation } from "@/lib/strength-evaluation-schema"

interface CriteriaTabProps {
  caseId: string
  criteriaContent: React.ReactNode
  initialStrengthEvaluation?: StrengthEvaluation | null
}

export function CriteriaTab({
  caseId,
  criteriaContent,
  initialStrengthEvaluation,
}: CriteriaTabProps) {
  const [criteriaOpen, setCriteriaOpen] = useState(true)
  const [strengthOpen, setStrengthOpen] = useState(false)

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Criteria section */}
      <div className="border-b border-border">
        <button
          onClick={() => setCriteriaOpen(!criteriaOpen)}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors"
        >
          <ChevronDown
            className={cn(
              "w-4 h-4 text-muted-foreground transition-transform",
              !criteriaOpen && "-rotate-90"
            )}
          />
          <span className="text-sm font-semibold">Criteria</span>
        </button>
        {criteriaOpen && (
          <div className="p-4 pt-0 space-y-3">
            {criteriaContent}
          </div>
        )}
      </div>

      {/* Strength Evaluation section */}
      <div className="border-b border-border">
        <button
          onClick={() => setStrengthOpen(!strengthOpen)}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors"
        >
          <ChevronDown
            className={cn(
              "w-4 h-4 text-muted-foreground transition-transform",
              !strengthOpen && "-rotate-90"
            )}
          />
          <span className="text-sm font-semibold">Strength Evaluation</span>
        </button>
        {strengthOpen && (
          <StrengthEvaluationPanel
            caseId={caseId}
            initialData={initialStrengthEvaluation}
          />
        )}
      </div>
    </div>
  )
}
