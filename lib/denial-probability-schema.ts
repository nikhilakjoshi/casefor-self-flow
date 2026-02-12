import { z } from "zod"

const RiskLevel = z.enum(["LOW", "MEDIUM", "HIGH", "VERY_HIGH"])
const Confidence = z.enum(["HIGH", "MEDIUM", "LOW"])
const MeritsStrength = z.enum(["STRONG", "MODERATE", "WEAK"])
const ComparisonLevel = z.enum(["ABOVE", "AT", "BELOW"])
const Classification = z.enum(["PRIMARY", "SECONDARY", "WEAK"])
const DocStatus = z.enum(["COMPLETE", "PARTIAL", "INSUFFICIENT"])
const FlagLevel = z.enum(["HIGH", "MEDIUM", "LOW"])
const PortfolioRisk = z.enum(["LOW", "MEDIUM", "HIGH"])

const FilingRecommendation = z.enum([
  "FILE_NOW",
  "FILE_WITH_CAUTION",
  "STRENGTHEN_FIRST",
  "MAJOR_GAPS",
  "CONSIDER_ALTERNATIVE",
])

// Pass 1: qualitative analysis (generated first)
export const DenialProbabilityPass1Schema = z.object({
  kazarian_analysis: z.object({
    step1: z.object({
      status: z.string(),
      criteria_claimed: z.number(),
      criteria_likely_satisfied: z.number(),
      critical_threshold_met: z.boolean(),
    }),
    step2: z.object({
      status: z.string(),
      sustained_acclaim: MeritsStrength,
      top_of_field: MeritsStrength,
      geographic_scope: z.string(),
      timeline_coverage: z.string(),
      risk_score: z.number(),
    }),
  }),

  field_context: z.object({
    field: z.string(),
    baseline_approval_rate: z.number(),
    case_vs_typical: ComparisonLevel,
    benchmarks: z.object({}).catchall(z.unknown()),
    profile_comparison: z.object({}).catchall(z.unknown()),
  }),

  criterion_risk_assessments: z.array(
    z.object({
      criterion_key: z.string(),
      criterion_name: z.string(),
      classification: Classification,
      evidence_strength: z.number(),
      documentation_status: DocStatus,
      rfe_risk: z.number(),
      denial_risk: z.number(),
      issues: z.array(z.string()),
    })
  ),

  letter_analysis: z.object({
    total_letters: z.number(),
    independent_count: z.number(),
    independent_pct: z.number(),
    collaborative_count: z.number(),
    geographic_diversity: z.string(),
    portfolio_risk: PortfolioRisk,
    issues: z.array(z.string()),
  }),

  red_flags: z.array(
    z.object({
      level: FlagLevel,
      description: z.string(),
    })
  ),

  strengths: z.array(z.string()),
})

// Pass 2: quantitative probability + final decisions (generated second, with pass 1 as input)
export const DenialProbabilityPass2Schema = z.object({
  probability_breakdown: z.object({
    base_denial_rate: z.number().int().min(0).max(100).describe("Whole integer percentage 0-100, e.g. 30 means 30%"),
    adjustments: z.array(
      z.object({
        factor: z.string(),
        delta_pct: z.number().int().min(-100).max(100).describe("Whole integer percentage points, e.g. -8 means minus 8 percentage points"),
      })
    ),
    final_denial_probability: z.number().int().min(5).max(95).describe("Whole integer percentage 5-95, e.g. 22 means 22%"),
  }),

  overall_assessment: z.object({
    risk_level: RiskLevel,
    denial_probability_pct: z.number().int().min(5).max(95).describe("Whole integer percentage, MUST EQUAL final_denial_probability"),
    rfe_probability_pct: z.number().int().min(5).max(90).describe("Whole integer percentage, 1.5-2x denial, capped at 90"),
    confidence: Confidence,
    summary: z.string(),
  }),

  recommendations: z.object({
    critical: z.array(
      z.object({
        action: z.string(),
        guidance: z.string(),
      })
    ),
    high_priority: z.array(
      z.object({
        action: z.string(),
        guidance: z.string(),
      })
    ),
    moderate_priority: z.array(
      z.object({
        action: z.string(),
        guidance: z.string(),
      })
    ),
  }),

  filing_recommendation: z.object({
    recommendation: FilingRecommendation,
    rationale: z.string(),
  }),
})

// Combined type -- same shape as before, panel/client imports unchanged
export const DenialProbabilitySchema = DenialProbabilityPass1Schema.merge(DenialProbabilityPass2Schema)
export type DenialProbability = z.infer<typeof DenialProbabilitySchema>
