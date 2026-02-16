"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface CriteriaTabProps {
  caseId: string
  criteriaContent: React.ReactNode
}

export function CriteriaTab({
  caseId,
  criteriaContent,
}: CriteriaTabProps) {
  const [criteriaOpen, setCriteriaOpen] = useState(true)

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Criteria section */}
      <div className="border-b border-border">
        <button
          onClick={() => setCriteriaOpen(!criteriaOpen)}
          className="sticky top-0 z-10 bg-background w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors border-b border-border"
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
    </div>
  )
}
