import { z } from "zod"

const RfeRisk = z.enum(["LOW", "MODERATE", "HIGH", "VERY_HIGH", "N_A"])
const ComparisonLevel = z.enum(["ABOVE", "AT", "BELOW"])

const BaseCriterionSchema = z.object({
  tier: z.number(),
  score: z.number(),
  satisfied: z.boolean(),
  evidence_count: z.number(),
  rfe_risk: RfeRisk,
  key_evidence: z.array(z.string()),
  tier_5_flags: z.array(z.string()),
  scoring_rationale: z.string(),
  improvement_notes: z.string(),
})

const C5Schema = BaseCriterionSchema.extend({
  major_significance_indicators: z.object({
    widespread_adoption: z.boolean(),
    commercial_validation: z.boolean(),
    research_impact: z.boolean(),
    independent_adoption: z.boolean(),
    expert_validation: z.boolean(),
    field_transformation: z.boolean(),
    indicators_met: z.number(),
  }),
})

const C6Schema = BaseCriterionSchema.extend({
  metrics: z.object({
    total_publications: z.number(),
    total_citations: z.number(),
    h_index: z.number(),
    top_venue_count: z.number(),
    vs_median: ComparisonLevel,
  }),
})

const C7Schema = BaseCriterionSchema.extend({
  applicable: z.boolean(),
})

const C8Schema = BaseCriterionSchema.extend({
  organization_tier: z.enum(["TIER_1", "TIER_2", "TIER_3", "TIER_4"]),
  role_type: z.enum(["LEADING", "CRITICAL", "BOTH", "NEITHER"]),
})

const C9Schema = BaseCriterionSchema.extend({
  estimated_percentile: z.number(),
})

const C10Schema = BaseCriterionSchema.extend({
  applicable: z.boolean(),
})

export const StrengthEvaluationSchema = z.object({
  applicant_name: z.string(),
  detected_field: z.enum(["STEM", "HEALTHCARE", "BUSINESS", "ARTS", "ATHLETICS", "ACADEMIA"]),
  field_confidence: z.number(),
  field_approval_rate_range: z.string(),
  evaluation_date: z.string(),

  criteria_evaluations: z.object({
    C1_awards: BaseCriterionSchema,
    C2_membership: BaseCriterionSchema,
    C3_press: BaseCriterionSchema,
    C4_judging: BaseCriterionSchema,
    C5_contributions: C5Schema,
    C6_publications: C6Schema,
    C7_exhibitions: C7Schema,
    C8_leading_role: C8Schema,
    C9_salary: C9Schema,
    C10_commercial: C10Schema,
  }),

  step1_assessment: z.object({
    criteria_satisfied_count: z.number(),
    criteria_satisfied_list: z.array(z.string()),
    criteria_borderline_count: z.number(),
    criteria_borderline_list: z.array(z.string()),
    criteria_not_satisfied_count: z.number(),
    step1_result: z.enum(["SATISFIED", "BORDERLINE", "NOT_SATISFIED"]),
    step1_confidence: z.number(),
  }),

  step2_assessment: z.object({
    sustained_acclaim_years: z.number(),
    geographic_reach: z.enum(["INTERNATIONAL", "NATIONAL", "REGIONAL", "INSTITUTIONAL"]),
    independence_level: z.enum(["STRONG", "MODERATE", "WEAK"]),
    recent_achievements: z.boolean(),
    field_wide_impact: z.boolean(),
    progression_evident: z.boolean(),
    step2_score: z.number(),
    step2_result: z.enum(["STRONG", "MODERATE", "WEAK"]),
    step2_rationale: z.string(),
  }),

  overall_assessment: z.object({
    petition_strength: z.enum(["EXCELLENT", "STRONG", "MODERATE", "WEAK", "VERY_WEAK"]),
    overall_score: z.number(),
    approval_probability: z.string(),
    recommendation: z.enum(["FILE_NOW", "STRENGTHEN_FIRST", "BUILD_EVIDENCE", "CONSIDER_ALTERNATIVE"]),
    recommended_criteria_to_claim: z.array(z.string()),
    criteria_to_avoid: z.array(z.string()),
    top_3_strengths: z.array(z.string()),
    top_3_weaknesses: z.array(z.string()),
    overall_rfe_probability: z.enum(["LOW", "MODERATE", "HIGH"]),
    rfe_likely_criteria: z.array(z.string()),
  }),

  red_flags: z.object({
    tier_5_evidence_found: z.array(z.string()),
    documentation_risks: z.array(z.string()),
    independence_concerns: z.array(z.string()),
    temporal_gaps: z.array(z.string()),
    total_red_flags: z.number(),
  }),

  field_comparison: z.object({
    vs_median_successful: z.object({
      publications: ComparisonLevel,
      citations: ComparisonLevel,
      h_index: ComparisonLevel,
      experience_years: ComparisonLevel,
    }),
    percentile_estimate: z.string(),
  }),

  evaluation_metadata: z.object({
    criteria_evaluated: z.number(),
    data_completeness: z.enum(["HIGH", "MODERATE", "LOW"]),
    confidence_level: z.number(),
    notes: z.string(),
  }),
})

export type StrengthEvaluation = z.infer<typeof StrengthEvaluationSchema>

export const CRITERION_LABELS: Record<string, string> = {
  C1_awards: "C1: Awards & Prizes",
  C2_membership: "C2: Membership in Associations",
  C3_press: "C3: Published Material About Applicant",
  C4_judging: "C4: Judging the Work of Others",
  C5_contributions: "C5: Original Contributions",
  C6_publications: "C6: Scholarly Articles",
  C7_exhibitions: "C7: Exhibitions",
  C8_leading_role: "C8: Leading/Critical Role",
  C9_salary: "C9: High Salary",
  C10_commercial: "C10: Commercial Success",
}
