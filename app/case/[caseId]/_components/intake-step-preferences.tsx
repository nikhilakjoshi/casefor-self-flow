"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { IntakePreferences } from "../_lib/intake-schema"

interface IntakeStepPreferencesProps {
  data: IntakePreferences
  onChange: (data: Partial<IntakePreferences>) => void
}

export function IntakeStepPreferences({ data, onChange }: IntakeStepPreferencesProps) {
  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h3 className="text-base font-medium mb-1">Preferences</h3>
        <p className="text-sm text-muted-foreground">
          Help us personalize your experience.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="text-sm font-medium mb-2 block">How urgent is your case?</label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(data.urgencyLevel === "low" && "border-primary bg-primary/5")}
              onClick={() => onChange({ urgencyLevel: "low" })}
            >
              Low
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(data.urgencyLevel === "medium" && "border-primary bg-primary/5")}
              onClick={() => onChange({ urgencyLevel: "medium" })}
            >
              Medium
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(data.urgencyLevel === "high" && "border-primary bg-primary/5")}
              onClick={() => onChange({ urgencyLevel: "high" })}
            >
              High
            </Button>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Preferred Communication</label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(data.communicationPreference === "email" && "border-primary bg-primary/5")}
              onClick={() => onChange({ communicationPreference: "email" })}
            >
              Email
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(data.communicationPreference === "chat" && "border-primary bg-primary/5")}
              onClick={() => onChange({ communicationPreference: "chat" })}
            >
              In-app Chat
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(data.communicationPreference === "both" && "border-primary bg-primary/5")}
              onClick={() => onChange({ communicationPreference: "both" })}
            >
              Both
            </Button>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Primary Goal</label>
          <textarea
            placeholder="What's most important to you in this process?"
            value={data.primaryGoal ?? ""}
            onChange={(e) => onChange({ primaryGoal: e.target.value })}
            className="mt-1.5 w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Additional Notes</label>
          <textarea
            placeholder="Anything else you'd like us to know?"
            value={data.additionalNotes ?? ""}
            onChange={(e) => onChange({ additionalNotes: e.target.value })}
            className="mt-1.5 w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
      </div>
    </div>
  )
}
