import { z } from "zod"

export { CRITERION_LABELS } from "./strength-evaluation-schema"

const PriorityLevel = z.enum(["HIGH", "MEDIUM", "LOW"])
const DamageLevel = z.enum(["CRITICAL", "MODERATE", "MINOR"])
const ResponsibleParty = z.enum(["CLIENT", "LAWYER", "BOTH"])

const ActionItem = z.object({
  action: z.string(),
  detail: z.string(),
  responsible_party: ResponsibleParty,
})

const CriticalGap = z.object({
  priority: PriorityLevel,
  criterion: z.string(),
  issue: z.string(),
  aao_basis: z.string(),
  current_state: z.string(),
  required_state: z.string(),
  actions: z.array(ActionItem),
  timeline: z.string(),
  estimated_cost: z.string(),
  impact: z.string(),
  rfe_risk_if_unfixed: PriorityLevel,
})

const EvidenceToRemove = z.object({
  item: z.string(),
  category: z.enum(["AWARD", "MEMBERSHIP", "PUBLICATION", "MEDIA", "JUDGING", "OTHER"]),
  criterion_affected: z.string(),
  reason_for_removal: z.string(),
  damage_level: DamageLevel,
})

const AlternativeVisa = z.object({
  visa_type: z.string(),
  fit_assessment: z.string(),
  estimated_probability: z.number(),
})

const LetterDetail = z.object({
  letter_number: z.number(),
  recommender_type: z.enum(["INNER_CIRCLE", "OUTER_CIRCLE"]),
  target_profile: z.string(),
  criteria_to_address: z.array(z.string()),
  key_topics: z.array(z.string()),
  must_include_language: z.array(z.string()),
  independence_requirement: z.string(),
})

const TimeframeActions = z.object({
  timeframe: z.string(),
  actions: z.array(z.string()),
  only_if: z.string().optional(),
})

export const GapAnalysisSchema = z.object({
  gap_analysis: z.object({
    analysis_timestamp: z.string(),
    applicant_name: z.string(),
    detected_field: z.string(),
    field_approval_benchmark: z.string(),

    executive_summary: z.object({
      overall_case_strength: z.enum(["STRONG", "MODERATE", "WEAK", "NOT_READY"]),
      current_approval_probability: z.number(),
      projected_approval_probability: z.number(),
      criteria_satisfied_count: z.number(),
      total_gaps_identified: z.number(),
      high_priority_gaps: z.number(),
      medium_priority_gaps: z.number(),
      low_priority_gaps: z.number(),
      estimated_total_investment: z.string(),
      estimated_timeline_to_ready: z.string(),
    }),

    critical_gaps: z.array(CriticalGap),

    evidence_to_remove: z.array(EvidenceToRemove),

    filing_decision: z.object({
      recommendation: z.enum(["FILE_NOW", "WAIT_3_MONTHS", "WAIT_6_MONTHS", "WAIT_12_MONTHS", "CONSIDER_ALTERNATIVE"]),
      current_probability: z.number(),
      post_action_probability: z.number(),
      probability_gain: z.number(),
      estimated_investment: z.string(),
      risk_adjusted_value: z.string(),
      rfe_probability_if_file_now: z.string(),
      rfe_probability_after_strengthening: z.string(),
      rationale: z.string(),
      alternative_visas: z.array(AlternativeVisa),
    }),

    expert_letter_strategy: z.object({
      total_letters_needed: z.number(),
      inner_circle_count: z.number(),
      outer_circle_count: z.number(),
      geographic_diversity: z.string(),
      letters: z.array(LetterDetail),
    }),

    evidence_building_roadmap: z.object({
      immediate_actions: TimeframeActions,
      short_term: TimeframeActions,
      medium_term: TimeframeActions,
      long_term: TimeframeActions,
    }),

    step2_strengthening: z.object({
      sustained_acclaim_assessment: z.enum(["STRONG", "MODERATE", "WEAK"]),
      geographic_scope: z.enum(["INTERNATIONAL", "NATIONAL", "INSTITUTIONAL"]),
      temporal_coverage: z.enum(["SUSTAINED", "GAPS_PRESENT", "RECENT_ONLY"]),
      field_comparison_available: z.boolean(),
      actions_to_strengthen_step2: z.array(z.string()),
    }),
  }),
})

export type GapAnalysis = z.infer<typeof GapAnalysisSchema>
