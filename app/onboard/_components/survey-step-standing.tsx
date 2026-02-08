"use client"

import type { ChangeEvent } from "react"
import { Textarea } from "@/components/ui/textarea"
import type { SurveyStanding } from "../_lib/survey-schema"

interface SurveyStepStandingProps {
  data: SurveyStanding
  onChange: (data: Partial<SurveyStanding>) => void
}

export function SurveyStepStanding({ data, onChange }: SurveyStepStandingProps) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-base font-medium mb-1">Professional Standing</h3>
        <p className="text-sm text-muted-foreground">
          Tell us about your memberships, judging activities, and editorial roles.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">
            Selective Memberships
          </label>
          <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">
            Fellow status, elected memberships, or other selective professional organizations
          </p>
          <Textarea
            placeholder="e.g., IEEE Fellow, ACM Distinguished Member, National Academy member..."
            value={data.selectiveMemberships ?? ""}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange({ selectiveMemberships: e.target.value })}
            className="min-h-[100px]"
          />
        </div>

        <div>
          <label className="text-sm font-medium">
            Judging Activities
          </label>
          <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">
            Peer review, grant panels, award committees, conference program committees
          </p>
          <Textarea
            placeholder="e.g., Reviewer for Nature, NeurIPS; NSF panel member; Program committee for ICML..."
            value={data.judgingActivities ?? ""}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange({ judgingActivities: e.target.value })}
            className="min-h-[100px]"
          />
        </div>

        <div>
          <label className="text-sm font-medium">
            Editorial Boards
          </label>
          <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">
            Journal editorial boards, associate editor positions
          </p>
          <Textarea
            placeholder="e.g., Associate Editor for IEEE TPAMI, Editorial board of JMLR..."
            value={data.editorialBoards ?? ""}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange({ editorialBoards: e.target.value })}
            className="min-h-[100px]"
          />
        </div>
      </div>
    </div>
  )
}
