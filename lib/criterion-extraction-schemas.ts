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

// ─── Evidence type schema registry ───
// Hybrid approach (Option C): ~15 common schemas shipped as code.
// Admin picks which ones a matter type uses via EvidenceTypeDefinition.
// Adding a novel evidence type = adding one schema here (5 min, one file).

export const EVIDENCE_TYPE_SCHEMAS: Record<string, z.ZodType> = {
  awards: z.array(AwardSchema).default([]),
  memberships: z.array(MembershipSchema).default([]),
  media_coverage: z.array(MediaCoverageSchema).default([]),
  judging_activities: z.array(JudgingActivitySchema).default([]),
  original_contributions: z.array(OriginalContributionSchema).default([]),
  patents: z.array(PatentSchema).default([]),
  grants: z.array(GrantSchema).default([]),
  publications: z.array(PublicationSchema).default([]),
  exhibitions: z.array(ExhibitionSchema).default([]),
  leadership_roles: z.array(LeadershipRoleSchema).default([]),
  compensation: z.array(CompensationSchema).default([]),
  commercial_success: z.array(CommercialSuccessSchema).default([]),
  speaking_engagements: z.array(z.object({
    id: z.string().optional(),
    title: z.string(),
    event: z.string().optional(),
    year: z.number().optional(),
    mapped_criteria: z.array(z.string()).default([]),
  })).default([]),
}

/**
 * Build a Zod extraction schema for a criterion from its evidence type keys.
 * Always includes `criteria_summary`.
 */
export function buildCriterionSchema(evidenceTypeKeys: string[]): z.ZodType {
  const shape: Record<string, z.ZodType> = {}
  for (const key of evidenceTypeKeys) {
    const schema = EVIDENCE_TYPE_SCHEMAS[key]
    if (schema) shape[key] = schema
  }
  shape.criteria_summary = CriteriaSummaryItemSchema
  return z.object(shape)
}

// ─── EB-1A hardcoded schemas (kept for backward compat / fallback) ───

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

/** @deprecated Use buildCriterionSchema() with EvidenceTypeDefinition keys */
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
