import { z } from "zod"

const CandidateProfile = z.object({
  name: z.string(),
  field_of_expertise: z.string(),
  current_position: z.string(),
  institution: z.string(),
  years_experience: z.number(),
  education_summary: z.string(),
  geographic_recognition_countries: z.array(z.string()),
  key_metrics: z.object({
    total_publications: z.number(),
    total_citations: z.number(),
    h_index: z.number(),
    patents: z.number(),
    awards_count: z.number(),
    media_mentions: z.number(),
    peer_reviews_conducted: z.number(),
    grant_funding_total: z.string(),
  }),
})

const CriterionRanking = z.object({
  criterion: z.string(),
  name: z.string(),
  rank: z.number(),
  tier: z.number(),
  verification_score: z.number(),
  eval_confidence: z.enum(["high", "medium", "low"]),
  classification: z.enum(["PRIMARY", "BACKUP", "DROP"]),
  rationale: z.string(),
  evidence_summary: z.string(),
  verified_claims_count: z.number(),
  unverified_claims_count: z.number(),
  red_flags_count: z.number(),
  red_flag_details: z.array(z.string()),
  missing_documents: z.array(z.string()),
  documents_on_file: z.array(z.string()),
  kazarian_step1_met: z.boolean(),
  rfe_risk: z.enum(["low", "medium", "high"]),
  rfe_likely_issue: z.string(),
})

const EvidenceDocument = z.object({
  name: z.string(),
  doc_type: z.string(),
  tier: z.number(),
  status: z.enum(["verified", "unverified", "flagged"]),
})

const CriterionEvidence = z.object({
  documents: z.array(EvidenceDocument),
  overall_strength: z.enum(["strong", "moderate", "weak", "no_evidence"]),
  gaps: z.array(z.string()),
})

const EvidenceToRemove = z.object({
  document: z.string(),
  criterion: z.string(),
  current_tier: z.number(),
  reason: z.string(),
  removal_priority: z.enum(["IMMEDIATE", "BEFORE_FILING"]),
})

const EvidenceToObtain = z.object({
  criterion: z.string(),
  document_type: z.string(),
  description: z.string(),
  priority: z.enum(["CRITICAL", "HIGH", "MEDIUM"]),
  estimated_effort: z.string(),
  impact_if_missing: z.string(),
})

const EvidenceInventory = z.object({
  total_documents_uploaded: z.number(),
  total_documents_verified: z.number(),
  by_criterion: z.record(z.string(), CriterionEvidence),
  tier_distribution: z.object({
    tier_1: z.number(),
    tier_2: z.number(),
    tier_3: z.number(),
    tier_4: z.number(),
    tier_5: z.number(),
    unclassified: z.number(),
  }),
  evidence_to_remove: z.array(EvidenceToRemove),
  evidence_to_obtain: z.array(EvidenceToObtain),
})

const LetterPlan = z.object({
  letter_number: z.number(),
  recommender_type: z.string(),
  suggested_profile: z.string(),
  criteria_to_cover: z.array(z.string()),
  key_points_to_address: z.array(z.string()),
  specific_claims_to_support: z.array(z.string()),
  geographic_preference: z.string(),
  independence_level: z.string(),
  priority: z.enum(["ESSENTIAL", "IMPORTANT", "SUPPLEMENTARY"]),
})

const RecommendationLetterStrategy = z.object({
  total_letters_recommended: z.number(),
  letters_planned: z.array(LetterPlan),
  independence_ratio: z.string(),
  geographic_distribution: z.string(),
  institutional_distribution: z.string(),
  criteria_coverage_matrix: z.record(z.string(), z.array(z.string())),
  red_flags_to_avoid: z.array(z.string()),
})

const PetitionStrategy = z.object({
  recommended_criteria_count: z.number(),
  primary_criteria: z.array(z.string()),
  backup_criteria: z.array(z.string()),
  criteria_to_drop: z.array(z.string()),
  drop_rationale: z.record(z.string(), z.string()),
  kazarian_step1_assessment: z.string(),
  kazarian_step2_assessment: z.string(),
  filing_readiness: z.enum(["READY", "READY_WITH_GAPS", "NOT_READY"]),
  filing_readiness_rationale: z.string(),
  approval_probability_range: z.string(),
  rfe_probability: z.string(),
  field_specific_context: z.object({
    field: z.string(),
    typical_approval_rate: z.string(),
    citation_benchmark: z.string(),
    publication_benchmark: z.string(),
    candidate_vs_benchmark: z.string(),
  }),
})

const SectionSubsection = z.object({
  criterion: z.string(),
  criterion_name: z.string(),
  recommended_pages: z.string(),
  lead_evidence: z.string(),
  supporting_evidence: z.array(z.string()),
  letter_references: z.array(z.string()),
  regulatory_citation: z.string(),
  key_argument: z.string(),
})

const PetitionSection = z.object({
  section_number: z.string(),
  section_title: z.string(),
  recommended_pages: z.string(),
  key_content: z.string().optional(),
  exhibits_referenced: z.array(z.string()).optional(),
  regulatory_citations: z.array(z.string()).optional(),
  subsections: z.array(SectionSubsection).optional(),
})

const ExhibitPlan = z.object({
  exhibit: z.string(),
  content: z.string(),
})

const PetitionStructure = z.object({
  recommended_total_pages: z.number(),
  section_outline: z.array(PetitionSection),
  exhibit_plan: z.array(ExhibitPlan),
})

const GapRemediationPriority = z.object({
  priority_rank: z.number(),
  type: z.enum(["EVIDENCE_GAP", "DOCUMENTATION_GAP", "LETTER_GAP", "NARRATIVE_GAP", "RED_FLAG"]),
  criterion: z.string(),
  description: z.string(),
  action_required: z.string(),
  responsible_party: z.string(),
  estimated_effort: z.string(),
  impact_if_unresolved: z.string(),
  impact_severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]),
})

const RfeLikelyTarget = z.object({
  criterion: z.string(),
  likely_challenge: z.string(),
  preemptive_strategy: z.string(),
})

const MitigationStrategy = z.object({
  strategy: z.string(),
  addresses_risk: z.string(),
  implementation: z.string(),
})

const RiskAssessment = z.object({
  overall_risk_level: z.enum(["LOW", "MODERATE", "HIGH", "VERY_HIGH"]),
  overall_risk_rationale: z.string(),
  rfe_probability: z.string(),
  likely_rfe_targets: z.array(RfeLikelyTarget),
  denial_risk_factors: z.array(z.string()),
  mitigation_strategies: z.array(MitigationStrategy),
  strengths_to_leverage: z.array(z.string()),
})

const NarrativeAnchors = z.object({
  one_line_summary: z.string(),
  three_sentence_narrative: z.string(),
  kazarian_step2_narrative: z.string(),
  key_differentiators: z.array(z.string()),
  proposed_field_definition: z.string(),
  field_definition_rationale: z.string(),
})

export const CaseConsolidationSchema = z.object({
  case_consolidation: z.object({
    generated_at: z.string(),
    pipeline_version: z.string(),
    candidate_profile: CandidateProfile,
    criteria_ranking: z.array(CriterionRanking),
    petition_strategy: PetitionStrategy,
    evidence_inventory: EvidenceInventory,
    recommendation_letter_strategy: RecommendationLetterStrategy,
    petition_structure: PetitionStructure,
    gap_remediation_priorities: z.array(GapRemediationPriority),
    risk_assessment: RiskAssessment,
    narrative_anchors: NarrativeAnchors,
  }),
})

export type CaseConsolidation = z.infer<typeof CaseConsolidationSchema>
