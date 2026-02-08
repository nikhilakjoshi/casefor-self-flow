"use client"

import type { ChangeEvent } from "react"
import { Textarea } from "@/components/ui/textarea"
import type { SurveyLeadership } from "../_lib/survey-schema"

interface SurveyStepLeadershipProps {
  data: SurveyLeadership
  onChange: (data: Partial<SurveyLeadership>) => void
}

export function SurveyStepLeadership({ data, onChange }: SurveyStepLeadershipProps) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-base font-medium mb-1">Leadership & Compensation</h3>
        <p className="text-sm text-muted-foreground">
          Tell us about your leadership roles and compensation.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">
            Leading or Critical Roles
          </label>
          <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">
            Director, principal investigator, founding team member, or other critical positions
          </p>
          <Textarea
            placeholder="Describe leadership or critical roles you have held...&#10;&#10;Example:&#10;- Principal Investigator, $2M NIH Grant (2020-2024)&#10;- Founding Engineer, Tech Startup (acquired for $50M)"
            value={data.leadingRoles ?? ""}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange({ leadingRoles: e.target.value })}
            className="min-h-[150px]"
          />
        </div>

        <div>
          <label className="text-sm font-medium">
            Salary & Compensation Details
          </label>
          <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">
            High salary relative to field, equity, bonuses, or other compensation
          </p>
          <Textarea
            placeholder="Describe compensation that demonstrates your value in the field..."
            value={data.compensationDetails ?? ""}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange({ compensationDetails: e.target.value })}
            className="min-h-[100px]"
          />
        </div>
      </div>
    </div>
  )
}
