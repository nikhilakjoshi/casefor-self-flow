"use client"

import type { ChangeEvent } from "react"
import { Textarea } from "@/components/ui/textarea"
import type { SurveyAwards } from "../_lib/survey-schema"

interface SurveyStepAwardsProps {
  data: SurveyAwards
  onChange: (data: Partial<SurveyAwards>) => void
}

export function SurveyStepAwards({ data, onChange }: SurveyStepAwardsProps) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-base font-medium mb-1">Awards & Recognition</h3>
        <p className="text-sm text-muted-foreground">
          Tell us about awards, honors, and media coverage you have received.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">
            Major One-Time Achievements
          </label>
          <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">
            Nobel, Pulitzer, Oscar, Olympic medal, or similar major recognitions
          </p>
          <Textarea
            placeholder="List any major one-time achievements..."
            value={data.majorAchievements ?? ""}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange({ majorAchievements: e.target.value })}
            className="min-h-[80px]"
          />
        </div>

        <div>
          <label className="text-sm font-medium">
            Awards List
          </label>
          <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">
            Include issuer, criteria, and scope (national/international) for each
          </p>
          <Textarea
            placeholder="List your awards with details about each...&#10;&#10;Example:&#10;- Best Paper Award, NeurIPS 2023 (international, competitive selection)&#10;- NSF CAREER Award, 2022 (national, highly selective)"
            value={data.awards?.map(a => `${a.name}${a.issuer ? `, ${a.issuer}` : ''}${a.year ? ` (${a.year})` : ''}`).join('\n') ?? ""}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
              const lines = e.target.value.split('\n').filter((l: string) => l.trim())
              const awards = lines.map((line: string) => {
                const match = line.match(/^-?\s*(.+?)(?:,\s*(.+?))?(?:\s*\((\d{4})\))?$/)
                return {
                  name: match?.[1]?.trim() || line.trim(),
                  issuer: match?.[2]?.trim(),
                  year: match?.[3] ? parseInt(match[3]) : null,
                }
              })
              onChange({ awards })
            }}
            className="min-h-[120px]"
          />
        </div>

        <div>
          <label className="text-sm font-medium">
            Media Coverage About You
          </label>
          <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">
            Articles, interviews, or features about you and your work
          </p>
          <Textarea
            placeholder="List media coverage with publication names and topics..."
            value={data.mediaCoverage ?? ""}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange({ mediaCoverage: e.target.value })}
            className="min-h-[80px]"
          />
        </div>
      </div>
    </div>
  )
}
