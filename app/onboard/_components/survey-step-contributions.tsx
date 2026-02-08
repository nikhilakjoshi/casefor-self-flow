"use client"

import type { ChangeEvent } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { SurveyContributions } from "../_lib/survey-schema"

interface SurveyStepContributionsProps {
  data: SurveyContributions
  onChange: (data: Partial<SurveyContributions>) => void
}

export function SurveyStepContributions({ data, onChange }: SurveyStepContributionsProps) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-base font-medium mb-1">Contributions & Publications</h3>
        <p className="text-sm text-muted-foreground">
          Tell us about your original contributions and scholarly output.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">
            Original Contributions
          </label>
          <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">
            Patents, frameworks, algorithms, techniques, or innovations you developed
          </p>
          <Textarea
            placeholder="Describe your original contributions to the field..."
            value={data.originalContributions ?? ""}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange({ originalContributions: e.target.value })}
            className="min-h-[120px]"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium">Publication Count</label>
            <Input
              type="number"
              placeholder="e.g., 45"
              value={data.publicationCount ?? ""}
              onChange={(e: ChangeEvent<HTMLInputElement>) => onChange({ publicationCount: e.target.value ? Number(e.target.value) : undefined })}
              className="mt-1.5"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Total Citations</label>
            <Input
              type="number"
              placeholder="e.g., 5000"
              value={data.citationCount ?? ""}
              onChange={(e: ChangeEvent<HTMLInputElement>) => onChange({ citationCount: e.target.value ? Number(e.target.value) : undefined })}
              className="mt-1.5"
            />
          </div>

          <div>
            <label className="text-sm font-medium">h-index</label>
            <Input
              type="number"
              placeholder="e.g., 25"
              value={data.hIndex ?? ""}
              onChange={(e: ChangeEvent<HTMLInputElement>) => onChange({ hIndex: e.target.value ? Number(e.target.value) : undefined })}
              className="mt-1.5"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">
            Artistic Exhibitions
          </label>
          <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">
            If applicable: galleries, museums, performances
          </p>
          <Textarea
            placeholder="List any artistic exhibitions or performances..."
            value={data.artisticExhibitions ?? ""}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange({ artisticExhibitions: e.target.value })}
            className="min-h-[80px]"
          />
        </div>
      </div>
    </div>
  )
}
