"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { IntakeAchievements } from "../_lib/intake-schema"

interface IntakeStepAchievementsProps {
  data: IntakeAchievements
  onChange: (data: Partial<IntakeAchievements>) => void
}

export function IntakeStepAchievements({ data, onChange }: IntakeStepAchievementsProps) {
  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h3 className="text-base font-medium mb-1">Notable Achievements</h3>
        <p className="text-sm text-muted-foreground">
          Highlight your most significant professional accomplishments.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">Most Significant Achievement</label>
          <textarea
            placeholder="Briefly describe your most notable accomplishment..."
            value={data.majorAchievement ?? ""}
            onChange={(e) => onChange({ majorAchievement: e.target.value })}
            className="mt-1.5 w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Social/Professional Following</label>
          <Input
            placeholder="e.g., 50k Twitter followers, 10k GitHub stars"
            value={data.socialFollowing ?? ""}
            onChange={(e) => onChange({ socialFollowing: e.target.value })}
            className="mt-1.5"
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Have you been a keynote speaker?</label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(data.keynoteSpeaker === true && "border-primary bg-primary/5")}
              onClick={() => onChange({ keynoteSpeaker: true })}
            >
              Yes
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(data.keynoteSpeaker === false && "border-primary bg-primary/5")}
              onClick={() => onChange({ keynoteSpeaker: false })}
            >
              No
            </Button>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Media Features</label>
          <Input
            placeholder="e.g., Featured in NYT, interviewed on CNN"
            value={data.mediaFeatures ?? ""}
            onChange={(e) => onChange({ mediaFeatures: e.target.value })}
            className="mt-1.5"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Patent Count</label>
          <Input
            type="number"
            placeholder="e.g., 5"
            value={data.patentCount ?? ""}
            onChange={(e) => onChange({ patentCount: e.target.value ? Number(e.target.value) : undefined })}
            className="mt-1.5"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Total Citation Count</label>
          <Input
            type="number"
            placeholder="e.g., 500"
            value={data.citationCount ?? ""}
            onChange={(e) => onChange({ citationCount: e.target.value ? Number(e.target.value) : undefined })}
            className="mt-1.5"
          />
        </div>
      </div>
    </div>
  )
}
