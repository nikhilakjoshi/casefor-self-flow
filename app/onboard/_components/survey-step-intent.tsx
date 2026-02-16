"use client"

import type { ChangeEvent } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import type { SurveyIntent } from "../_lib/survey-schema"

interface SurveyStepIntentProps {
  data: SurveyIntent
  onChange: (data: Partial<SurveyIntent>) => void
}

export function SurveyStepIntent({ data, onChange }: SurveyStepIntentProps) {
  // Always true -- EB-1A requires intent to continue in field
  if (!data.continueInField) onChange({ continueInField: true })

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h3 className="text-base font-medium mb-1">U.S. Intent</h3>
        <p className="text-sm text-muted-foreground">
          Tell us about your plans to work in the United States.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <Checkbox
            id="hasJobOffer"
            checked={data.hasJobOffer ?? false}
            onCheckedChange={(checked) => onChange({ hasJobOffer: checked === true })}
            className="mt-0.5"
          />
          <label htmlFor="hasJobOffer" className="text-sm">
            I have a job offer or contract in the U.S.
          </label>
        </div>

        {data.hasJobOffer && (
          <div className="ml-6">
            <label className="text-sm font-medium">Job Offer Details</label>
            <Textarea
              placeholder="Describe your job offer or contract..."
              value={data.jobOfferDetails ?? ""}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange({ jobOfferDetails: e.target.value })}
              className="mt-1.5 min-h-[60px]"
            />
          </div>
        )}

        <div className="flex items-start gap-3">
          <Checkbox
            id="hasBusinessPlan"
            checked={data.hasBusinessPlan ?? false}
            onCheckedChange={(checked) => onChange({ hasBusinessPlan: checked === true })}
            className="mt-0.5"
          />
          <label htmlFor="hasBusinessPlan" className="text-sm">
            I have a business plan (if entrepreneur)
          </label>
        </div>

        {data.hasBusinessPlan && (
          <div className="ml-6">
            <label className="text-sm font-medium">Business Plan Details</label>
            <Textarea
              placeholder="Describe your business plan..."
              value={data.businessPlanDetails ?? ""}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange({ businessPlanDetails: e.target.value })}
              className="mt-1.5 min-h-[60px]"
            />
          </div>
        )}

        <div>
          <label className="text-sm font-medium">
            How will your work benefit the U.S.?
          </label>
          <Textarea
            placeholder="Describe the national benefit of your work..."
            value={data.usBenefit ?? ""}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange({ usBenefit: e.target.value })}
            className="mt-1.5 min-h-[80px]"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Timeline for Move</label>
          <Input
            placeholder="e.g., Within 6 months, Next year"
            value={data.moveTimeline ?? ""}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onChange({ moveTimeline: e.target.value })}
            className="mt-1.5"
          />
        </div>
      </div>
    </div>
  )
}
