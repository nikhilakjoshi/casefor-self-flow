import { z } from "zod"

const Recommendation = z.enum([
  "STRONG",
  "INCLUDE_WITH_SUPPORT",
  "NEEDS_MORE_DOCS",
  "EXCLUDE",
])

export const BaseVerificationSchema = z.object({
  criterion: z.string(),
  document_type: z.string(),
  evidence_tier: z.number().min(1).max(5),
  score: z.number().min(0).max(10),
  verified_claims: z.array(z.string()),
  unverified_claims: z.array(z.string()),
  missing_documentation: z.array(z.string()),
  red_flags: z.array(z.string()),
  recommendation: Recommendation,
  reasoning: z.string(),
  matched_item_ids: z.array(z.string()).default([]),
})

// C1: Awards -- base schema only
export const C1VerificationSchema = BaseVerificationSchema

// C2: Membership -- three-part test
export const C2VerificationSchema = BaseVerificationSchema.extend({
  three_part_test: z.object({
    outstanding_achievement_required: z.boolean(),
    expert_judgment_documented: z.boolean(),
    distinct_from_employment: z.boolean(),
  }),
})

// C3: Published material about applicant
export const C3VerificationSchema = BaseVerificationSchema.extend({
  about_test: z.object({
    primarily_about_petitioner: z.boolean(),
    major_media_or_trade_pub: z.boolean(),
    title_date_author_present: z.boolean(),
    independent_editorial: z.boolean(),
  }),
})

// C4: Judging
export const C4VerificationSchema = BaseVerificationSchema.extend({
  judging_test: z.object({
    actual_participation_proven: z.boolean(),
    peers_not_students: z.boolean(),
    venue_prestige_documented: z.boolean(),
    sustained_pattern: z.boolean(),
  }),
})

// C5: Original contributions of major significance
export const C5VerificationSchema = BaseVerificationSchema.extend({
  significance_indicators: z.object({
    widespread_adoption: z.boolean(),
    commercial_validation: z.boolean(),
    research_impact: z.boolean(),
    independent_adoption: z.boolean(),
    expert_validation: z.boolean(),
    field_transformation: z.boolean(),
    indicators_met: z.number(),
  }),
})

// C6: Scholarly Articles
export const C6VerificationSchema = BaseVerificationSchema.extend({
  publication_metrics: z.object({
    h_index: z.number().optional(),
    total_citations: z.number().optional(),
    first_author_count: z.number().optional(),
    top_venue_count: z.number().optional(),
  }),
})

// C7: Artistic Exhibitions
export const C7VerificationSchema = BaseVerificationSchema.extend({
  exhibition_test: z.object({
    artistic_nature: z.boolean(),
    venue_prestige_documented: z.boolean(),
    merit_based_selection: z.boolean(),
    critical_reception: z.boolean(),
  }),
})

// C8: Leading or Critical Role
export const C8VerificationSchema = BaseVerificationSchema.extend({
  two_part_test: z.object({
    role_type: z.enum(["leading", "critical", "unclear"]),
    role_documented: z.boolean(),
    org_reputation_proven: z.boolean(),
    impact_beyond_department: z.boolean(),
    field_wide_recognition: z.boolean(),
  }),
})

// C9: High Salary
export const C9VerificationSchema = BaseVerificationSchema.extend({
  salary_analysis: z.object({
    compensation_documented: z.boolean(),
    comparative_data_present: z.boolean(),
    percentile_estimate: z.string(),
    geographic_match: z.boolean(),
    multi_year_pattern: z.boolean(),
  }),
})

// C10: Commercial Success
export const C10VerificationSchema = BaseVerificationSchema.extend({
  commercial_test: z.object({
    financial_metrics_documented: z.boolean(),
    individual_attribution_proven: z.boolean(),
    comparative_data_present: z.boolean(),
    performing_arts_scope: z.boolean(),
    sustained_pattern: z.boolean(),
  }),
})

export type BaseVerification = z.infer<typeof BaseVerificationSchema>
export type C1Verification = z.infer<typeof C1VerificationSchema>
export type C2Verification = z.infer<typeof C2VerificationSchema>
export type C3Verification = z.infer<typeof C3VerificationSchema>
export type C4Verification = z.infer<typeof C4VerificationSchema>
export type C5Verification = z.infer<typeof C5VerificationSchema>
export type C6Verification = z.infer<typeof C6VerificationSchema>
export type C7Verification = z.infer<typeof C7VerificationSchema>
export type C8Verification = z.infer<typeof C8VerificationSchema>
export type C9Verification = z.infer<typeof C9VerificationSchema>
export type C10Verification = z.infer<typeof C10VerificationSchema>

export type EvidenceVerificationResult =
  | C1Verification
  | C2Verification
  | C3Verification
  | C4Verification
  | C5Verification
  | C6Verification
  | C7Verification
  | C8Verification
  | C9Verification
  | C10Verification

export const CRITERIA_SCHEMAS: Record<string, z.ZodSchema> = {
  C1: C1VerificationSchema,
  C2: C2VerificationSchema,
  C3: C3VerificationSchema,
  C4: C4VerificationSchema,
  C5: C5VerificationSchema,
  C6: C6VerificationSchema,
  C7: C7VerificationSchema,
  C8: C8VerificationSchema,
  C9: C9VerificationSchema,
  C10: C10VerificationSchema,
}

export const CRITERIA_LABELS: Record<string, string> = {
  C1: "Awards & Prizes",
  C2: "Membership in Associations",
  C3: "Published Material About Applicant",
  C4: "Judging the Work of Others",
  C5: "Original Contributions of Major Significance",
  C6: "Scholarly Articles",
  C7: "Artistic Exhibitions",
  C8: "Leading or Critical Role",
  C9: "High Salary",
  C10: "Commercial Success",
}
