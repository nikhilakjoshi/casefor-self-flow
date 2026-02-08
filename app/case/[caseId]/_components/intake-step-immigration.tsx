"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { IntakeImmigration } from "../_lib/intake-schema"

interface IntakeStepImmigrationProps {
  data: IntakeImmigration
  onChange: (data: Partial<IntakeImmigration>) => void
}

export function IntakeStepImmigration({ data, onChange }: IntakeStepImmigrationProps) {
  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h3 className="text-base font-medium mb-1">Immigration Details</h3>
        <p className="text-sm text-muted-foreground">
          Help us understand your current immigration situation.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">Current Visa Status</label>
          <Input
            placeholder="e.g., H-1B, F-1 OPT, L-1, None"
            value={data.currentVisaStatus ?? ""}
            onChange={(e) => onChange({ currentVisaStatus: e.target.value })}
            className="mt-1.5"
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Do you intend to live in the US?</label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(data.hasUsIntent === true && "border-primary bg-primary/5")}
              onClick={() => onChange({ hasUsIntent: true })}
            >
              Yes
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(data.hasUsIntent === false && "border-primary bg-primary/5")}
              onClick={() => onChange({ hasUsIntent: false })}
            >
              No / Unsure
            </Button>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Target Timeline</label>
          <Input
            placeholder="e.g., Within 6 months, flexible"
            value={data.targetTimeline ?? ""}
            onChange={(e) => onChange({ targetTimeline: e.target.value })}
            className="mt-1.5"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Prior Immigration Petitions</label>
          <Input
            placeholder="e.g., PERM filed in 2022, none"
            value={data.priorPetitions ?? ""}
            onChange={(e) => onChange({ priorPetitions: e.target.value })}
            className="mt-1.5"
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Do you have an immigration attorney?</label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(data.hasAttorney === true && "border-primary bg-primary/5")}
              onClick={() => onChange({ hasAttorney: true })}
            >
              Yes
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(data.hasAttorney === false && "border-primary bg-primary/5")}
              onClick={() => onChange({ hasAttorney: false })}
            >
              No
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
