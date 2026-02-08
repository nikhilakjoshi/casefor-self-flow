"use client"

import type { ChangeEvent } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import type { SurveyEvidence } from "../_lib/survey-schema"

interface SurveyStepEvidenceProps {
  data: SurveyEvidence
  onChange: (data: Partial<SurveyEvidence>) => void
}

export function SurveyStepEvidence({ data, onChange }: SurveyStepEvidenceProps) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-base font-medium mb-1">Evidence & Timeline</h3>
        <p className="text-sm text-muted-foreground">
          Help us understand your readiness and timeline.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">
            Self-Assessment of Standing
          </label>
          <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">
            How would you describe your standing in your field?
          </p>
          <Textarea
            placeholder="Describe how you see your position relative to peers in your field..."
            value={data.selfAssessment ?? ""}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange({ selfAssessment: e.target.value })}
            className="min-h-[100px]"
          />
        </div>

        <div>
          <label className="text-sm font-medium">
            Documentation Availability
          </label>
          <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">
            What evidence can you readily provide?
          </p>
          <Textarea
            placeholder="List documents you have access to: award letters, citation reports, contracts, recommendation letters, etc."
            value={data.documentationAvailability ?? ""}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange({ documentationAvailability: e.target.value })}
            className="min-h-[100px]"
          />
        </div>

        <div>
          <label className="text-sm font-medium">
            Timeline / Urgency
          </label>
          <Input
            placeholder="e.g., Need to file within 3 months, No rush"
            value={data.timeline ?? ""}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onChange({ timeline: e.target.value })}
            className="mt-1.5"
          />
        </div>

        <div>
          <label className="text-sm font-medium">
            Prior Attorney Consultations
          </label>
          <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">
            Have you consulted with an immigration attorney before?
          </p>
          <Textarea
            placeholder="Describe any previous consultations and their outcomes..."
            value={data.priorAttorneyConsultations ?? ""}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange({ priorAttorneyConsultations: e.target.value })}
            className="min-h-[80px]"
          />
        </div>
      </div>
    </div>
  )
}
