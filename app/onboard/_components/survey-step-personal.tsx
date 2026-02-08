"use client"

import type { ChangeEvent } from "react"
import { Textarea } from "@/components/ui/textarea"
import type { SurveyPersonal } from "../_lib/survey-schema"

interface SurveyStepPersonalProps {
  data: SurveyPersonal
  onChange: (data: Partial<SurveyPersonal>) => void
}

export function SurveyStepPersonal({ data, onChange }: SurveyStepPersonalProps) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-base font-medium mb-1">Personal Statement</h3>
        <p className="text-sm text-muted-foreground">
          Help us understand your passion and plans for the U.S.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">
            What drives your passion for your field today?
          </label>
          <Textarea
            placeholder="Describe what motivates you in your work..."
            value={data.passion ?? ""}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange({ passion: e.target.value })}
            className="mt-1.5 min-h-[80px]"
          />
        </div>

        <div>
          <label className="text-sm font-medium">
            Do you have a U.S. job offer, employment, or business plans?
          </label>
          <Textarea
            placeholder="Describe any existing or potential U.S. employment..."
            value={data.usPlans ?? ""}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange({ usPlans: e.target.value })}
            className="mt-1.5 min-h-[80px]"
          />
        </div>

        <div>
          <label className="text-sm font-medium">
            Are there U.S. resources, institutions, or collaborators essential for your work?
          </label>
          <Textarea
            placeholder="List any U.S.-based resources or collaborators..."
            value={data.usResources ?? ""}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange({ usResources: e.target.value })}
            className="mt-1.5 min-h-[80px]"
          />
        </div>

        <div>
          <label className="text-sm font-medium">
            What are your specific plans for the next 1-5 years in the U.S.?
          </label>
          <Textarea
            placeholder="Describe your short and medium-term goals..."
            value={data.fiveYearPlan ?? ""}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange({ fiveYearPlan: e.target.value })}
            className="mt-1.5 min-h-[80px]"
          />
        </div>

        <div>
          <label className="text-sm font-medium">
            Why do you need permanent residency vs a temporary visa?
          </label>
          <Textarea
            placeholder="Explain why permanent residency is important for your goals..."
            value={data.whyPermanent ?? ""}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange({ whyPermanent: e.target.value })}
            className="mt-1.5 min-h-[80px]"
          />
        </div>
      </div>
    </div>
  )
}
