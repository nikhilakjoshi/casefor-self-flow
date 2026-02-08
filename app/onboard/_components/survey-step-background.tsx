"use client"

import { Input } from "@/components/ui/input"
import type { SurveyBackground } from "../_lib/survey-schema"

interface SurveyStepBackgroundProps {
  data: SurveyBackground
  onChange: (data: Partial<SurveyBackground>) => void
}

export function SurveyStepBackground({ data, onChange }: SurveyStepBackgroundProps) {
  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h3 className="text-base font-medium mb-1">Background & Field</h3>
        <p className="text-sm text-muted-foreground">
          Tell us about yourself and your professional background.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">Full Name</label>
          <Input
            placeholder="Your full legal name"
            value={data.fullName ?? ""}
            onChange={(e) => onChange({ fullName: e.target.value })}
            className="mt-1.5"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Date of Birth</label>
            <Input
              type="date"
              value={data.dateOfBirth ?? ""}
              onChange={(e) => onChange({ dateOfBirth: e.target.value })}
              className="mt-1.5"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Country of Birth</label>
            <Input
              placeholder="e.g., India"
              value={data.countryOfBirth ?? ""}
              onChange={(e) => onChange({ countryOfBirth: e.target.value })}
              className="mt-1.5"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Citizenship</label>
          <Input
            placeholder="e.g., India, Canada"
            value={data.citizenship ?? ""}
            onChange={(e) => onChange({ citizenship: e.target.value })}
            className="mt-1.5"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Area of Expertise</label>
            <Input
              placeholder="e.g., Machine Learning"
              value={data.areaOfExpertise ?? ""}
              onChange={(e) => onChange({ areaOfExpertise: e.target.value })}
              className="mt-1.5"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Specific Field/Subfield</label>
            <Input
              placeholder="e.g., Computer Vision"
              value={data.specificField ?? ""}
              onChange={(e) => onChange({ specificField: e.target.value })}
              className="mt-1.5"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Current Job Title</label>
            <Input
              placeholder="e.g., Senior Research Scientist"
              value={data.currentTitle ?? ""}
              onChange={(e) => onChange({ currentTitle: e.target.value })}
              className="mt-1.5"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Current Employer</label>
            <Input
              placeholder="e.g., Google Research"
              value={data.currentEmployer ?? ""}
              onChange={(e) => onChange({ currentEmployer: e.target.value })}
              className="mt-1.5"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Years of Experience</label>
          <Input
            type="number"
            placeholder="e.g., 8"
            value={data.yearsExperience ?? ""}
            onChange={(e) => onChange({ yearsExperience: e.target.value ? Number(e.target.value) : undefined })}
            className="mt-1.5"
          />
        </div>
      </div>
    </div>
  )
}
