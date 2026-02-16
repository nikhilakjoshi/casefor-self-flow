import { z } from "zod"
import {
  AwardSchema,
  MembershipSchema,
  MediaCoverageSchema,
  JudgingActivitySchema,
  OriginalContributionSchema,
  PatentSchema,
  GrantSchema,
  PublicationSchema,
  ExhibitionSchema,
  LeadershipRoleSchema,
  CompensationSchema,
  CommercialSuccessSchema,
  CriteriaSummaryItemSchema,
} from "./eb1a-extraction-schema"

// Each per-criterion schema extracts relevant arrays + one criteria_summary entry

export const C1ExtractionSchema = z.object({
  awards: z.array(AwardSchema).default([]),
  criteria_summary: CriteriaSummaryItemSchema,
})

export const C2ExtractionSchema = z.object({
  memberships: z.array(MembershipSchema).default([]),
  criteria_summary: CriteriaSummaryItemSchema,
})

export const C3ExtractionSchema = z.object({
  media_coverage: z.array(MediaCoverageSchema).default([]),
  criteria_summary: CriteriaSummaryItemSchema,
})

export const C4ExtractionSchema = z.object({
  judging_activities: z.array(JudgingActivitySchema).default([]),
  criteria_summary: CriteriaSummaryItemSchema,
})

export const C5ExtractionSchema = z.object({
  original_contributions: z.array(OriginalContributionSchema).default([]),
  patents: z.array(PatentSchema).default([]),
  grants: z.array(GrantSchema).default([]),
  criteria_summary: CriteriaSummaryItemSchema,
})

export const C6ExtractionSchema = z.object({
  publications: z.array(PublicationSchema).default([]),
  criteria_summary: CriteriaSummaryItemSchema,
})

export const C7ExtractionSchema = z.object({
  exhibitions: z.array(ExhibitionSchema).default([]),
  criteria_summary: CriteriaSummaryItemSchema,
})

export const C8ExtractionSchema = z.object({
  leadership_roles: z.array(LeadershipRoleSchema).default([]),
  criteria_summary: CriteriaSummaryItemSchema,
})

export const C9ExtractionSchema = z.object({
  compensation: z.array(CompensationSchema).default([]),
  criteria_summary: CriteriaSummaryItemSchema,
})

export const C10ExtractionSchema = z.object({
  commercial_success: z.array(CommercialSuccessSchema).default([]),
  criteria_summary: CriteriaSummaryItemSchema,
})

export const CRITERION_SCHEMAS: Record<string, z.ZodType> = {
  C1: C1ExtractionSchema,
  C2: C2ExtractionSchema,
  C3: C3ExtractionSchema,
  C4: C4ExtractionSchema,
  C5: C5ExtractionSchema,
  C6: C6ExtractionSchema,
  C7: C7ExtractionSchema,
  C8: C8ExtractionSchema,
  C9: C9ExtractionSchema,
  C10: C10ExtractionSchema,
}
