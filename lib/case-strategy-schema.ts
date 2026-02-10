import { z } from "zod"

const RecommendedCriterion = z.object({
  criterion: z.string(),
  strength_assessment: z.string(),
  effort_level: z.enum(["LOW", "MEDIUM", "HIGH"]),
  key_actions: z.array(z.string()),
})

const CriterionToAvoid = z.object({
  criterion: z.string(),
  reason: z.string(),
  risk_if_included: z.string(),
})

const EvidenceAction = z.object({
  action: z.string(),
  responsible_party: z.enum(["CLIENT", "LAWYER", "BOTH"]),
  deadline: z.string(),
  expected_outcome: z.string(),
})

const EvidenceCollectionPlan = z.object({
  immediate_actions: z.array(EvidenceAction),
  short_term_actions: z.array(EvidenceAction),
  long_term_actions: z.array(EvidenceAction),
})

const LetterAssignment = z.object({
  letter_number: z.number(),
  recommender_type: z.enum(["INDEPENDENT", "COLLABORATIVE"]),
  target_profile: z.string(),
  criteria_addressed: z.array(z.string()),
  key_points: z.array(z.string()),
})

const RecommendationLetterStrategy = z.object({
  total_letters: z.number(),
  independent_count: z.number(),
  collaborative_count: z.number(),
  letter_assignments: z.array(LetterAssignment),
})

const FilingPhase = z.object({
  phase: z.string(),
  timeframe: z.string(),
  tasks: z.array(z.string()),
})

const FilingTimeline = z.object({
  phases: z.array(FilingPhase),
  critical_path_items: z.array(z.string()),
})

const BudgetLineItem = z.object({
  category: z.string(),
  estimated_range: z.string(),
})

const BudgetEstimate = z.object({
  line_items: z.array(BudgetLineItem),
  total_estimated_range: z.string(),
})

const RiskItem = z.object({
  risk: z.string(),
  likelihood: z.enum(["LOW", "MEDIUM", "HIGH"]),
  mitigation: z.string(),
})

const RiskMitigation = z.object({
  primary_risks: z.array(RiskItem),
  rfe_preparedness: z.string(),
  fallback_plan: z.string(),
})

const FinalMeritsNarrative = z.object({
  positioning: z.string(),
  sustained_acclaim: z.string(),
  differentiators: z.array(z.string()),
})

export const CaseStrategySchema = z.object({
  case_strategy: z.object({
    strategy_summary: z.string(),
    recommended_criteria: z.array(RecommendedCriterion),
    criteria_to_avoid: z.array(CriterionToAvoid),
    evidence_collection_plan: EvidenceCollectionPlan,
    recommendation_letter_strategy: RecommendationLetterStrategy,
    filing_timeline: FilingTimeline,
    budget_estimate: BudgetEstimate,
    risk_mitigation: RiskMitigation,
    final_merits_narrative: FinalMeritsNarrative,
  }),
})

export type CaseStrategy = z.infer<typeof CaseStrategySchema>
