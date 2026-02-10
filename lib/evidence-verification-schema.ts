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

export type BaseVerification = z.infer<typeof BaseVerificationSchema>
export type C1Verification = z.infer<typeof C1VerificationSchema>
export type C2Verification = z.infer<typeof C2VerificationSchema>
export type C3Verification = z.infer<typeof C3VerificationSchema>
export type C4Verification = z.infer<typeof C4VerificationSchema>
export type C5Verification = z.infer<typeof C5VerificationSchema>

export type EvidenceVerificationResult =
  | C1Verification
  | C2Verification
  | C3Verification
  | C4Verification
  | C5Verification

export const CRITERIA_SCHEMAS: Record<string, z.ZodSchema> = {
  C1: C1VerificationSchema,
  C2: C2VerificationSchema,
  C3: C3VerificationSchema,
  C4: C4VerificationSchema,
  C5: C5VerificationSchema,
}

export const CRITERIA_LABELS: Record<string, string> = {
  C1: "Awards & Prizes",
  C2: "Membership in Associations",
  C3: "Published Material About Applicant",
  C4: "Judging the Work of Others",
  C5: "Original Contributions of Major Significance",
}
