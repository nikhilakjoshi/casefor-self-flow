"use client"

import { Input } from "@/components/ui/input"
import type { IntakeBackground } from "../_lib/intake-schema"

interface IntakeStepBackgroundProps {
  data: IntakeBackground
  onChange: (data: Partial<IntakeBackground>) => void
}

export function IntakeStepBackground({ data, onChange }: IntakeStepBackgroundProps) {
  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h3 className="text-base font-medium mb-1">Background Information</h3>
        <p className="text-sm text-muted-foreground">
          Tell us about your professional background and education.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">Citizenship</label>
          <Input
            placeholder="e.g., India, China, Canada"
            value={data.citizenship ?? ""}
            onChange={(e) => onChange({ citizenship: e.target.value })}
            className="mt-1.5"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Current Country of Residence</label>
          <Input
            placeholder="e.g., United States"
            value={data.currentCountry ?? ""}
            onChange={(e) => onChange({ currentCountry: e.target.value })}
            className="mt-1.5"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Professional Field</label>
          <Input
            placeholder="e.g., Machine Learning, Biomedical Research"
            value={data.field ?? ""}
            onChange={(e) => onChange({ field: e.target.value })}
            className="mt-1.5"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Current Employer</label>
          <Input
            placeholder="e.g., Google, Stanford University"
            value={data.currentEmployer ?? ""}
            onChange={(e) => onChange({ currentEmployer: e.target.value })}
            className="mt-1.5"
          />
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

        <div>
          <label className="text-sm font-medium">Highest Degree</label>
          <Input
            placeholder="e.g., Ph.D., M.S., M.D."
            value={data.highestDegree ?? ""}
            onChange={(e) => onChange({ highestDegree: e.target.value })}
            className="mt-1.5"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Degree Institution</label>
          <Input
            placeholder="e.g., MIT, Stanford"
            value={data.degreeInstitution ?? ""}
            onChange={(e) => onChange({ degreeInstitution: e.target.value })}
            className="mt-1.5"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Graduation Year</label>
          <Input
            type="number"
            placeholder="e.g., 2020"
            value={data.degreeYear ?? ""}
            onChange={(e) => onChange({ degreeYear: e.target.value ? Number(e.target.value) : undefined })}
            className="mt-1.5"
          />
        </div>
      </div>
    </div>
  )
}
