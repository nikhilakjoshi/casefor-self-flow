import { z } from "zod"

// Source tracking for merged data
const SourceSchema = z.enum(["extracted", "survey"]).optional()

// EB-1A criterion IDs
export const CriterionIdSchema = z.enum([
  "C1", // Awards
  "C2", // Membership
  "C3", // Published material about the person
  "C4", // Judging
  "C5", // Original contributions
  "C6", // Scholarly articles
  "C7", // Artistic exhibitions
  "C8", // Leading/critical role
  "C9", // High salary
  "C10", // Commercial success
])

export type CriterionId = z.infer<typeof CriterionIdSchema>

// Publication schema
export const PublicationSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  venue: z.string().optional(),
  venue_tier: z.enum(["top_tier", "high", "standard", "unknown"]).optional(),
  year: z.number().optional(),
  citations: z.number().optional(),
  doi: z.string().optional(),
  authors: z.array(z.string()).optional(),
  mapped_criteria: z.array(CriterionIdSchema).default(["C6"]),
  source: SourceSchema,
})

// Award schema
export const AwardSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  issuer: z.string().optional(),
  year: z.number().optional(),
  scope: z.enum(["international", "national", "regional", "local", "unknown"]).optional(),
  description: z.string().optional(),
  mapped_criteria: z.array(CriterionIdSchema).default(["C1"]),
  source: SourceSchema,
})

// Patent schema
export const PatentSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  number: z.string().optional(),
  status: z.enum(["granted", "pending", "filed", "unknown"]).optional(),
  year: z.number().optional(),
  inventors: z.array(z.string()).optional(),
  mapped_criteria: z.array(CriterionIdSchema).default(["C5"]),
  source: SourceSchema,
})

// Membership schema
export const MembershipSchema = z.object({
  id: z.string().optional(),
  organization: z.string(),
  role: z.string().optional(),
  selectivity_evidence: z.string().optional(),
  year_joined: z.number().optional(),
  mapped_criteria: z.array(CriterionIdSchema).default(["C2"]),
  source: SourceSchema,
})

// Media coverage schema
export const MediaCoverageSchema = z.object({
  id: z.string().optional(),
  outlet: z.string(),
  title: z.string().optional(),
  date: z.string().optional(),
  about_the_person: z.boolean().default(false),
  url: z.string().optional(),
  mapped_criteria: z.array(CriterionIdSchema).default(["C3"]),
  source: SourceSchema,
})

// Judging activity schema
export const JudgingActivitySchema = z.object({
  id: z.string().optional(),
  type: z.enum(["peer_review", "grant_panel", "competition_judge", "thesis_committee", "editorial_board", "other"]),
  organization: z.string().optional(),
  venue: z.string().optional(),
  description: z.string().optional(),
  year: z.number().optional(),
  mapped_criteria: z.array(CriterionIdSchema).default(["C4"]),
  source: SourceSchema,
})

// Speaking engagement schema
export const SpeakingEngagementSchema = z.object({
  id: z.string().optional(),
  event: z.string(),
  type: z.enum(["keynote", "invited", "panel", "workshop", "contributed", "other"]).optional(),
  location: z.string().optional(),
  year: z.number().optional(),
  description: z.string().optional(),
  mapped_criteria: z.array(CriterionIdSchema).default(["C5"]),
  source: SourceSchema,
})

// Grant schema
export const GrantSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  funder: z.string().optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  role: z.enum(["PI", "Co-PI", "Co-I", "collaborator", "other"]).optional(),
  year: z.number().optional(),
  mapped_criteria: z.array(CriterionIdSchema).default(["C5"]),
  source: SourceSchema,
})

// Leadership role schema
export const LeadershipRoleSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  organization: z.string(),
  distinction: z.string().optional(),
  start_year: z.number().optional(),
  end_year: z.number().optional(),
  description: z.string().optional(),
  mapped_criteria: z.array(CriterionIdSchema).default(["C8"]),
  source: SourceSchema,
})

// Compensation schema
export const CompensationSchema = z.object({
  id: z.string().optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  period: z.enum(["annual", "monthly", "hourly", "total"]).optional(),
  context: z.string().optional(),
  comparison: z.string().optional(),
  mapped_criteria: z.array(CriterionIdSchema).default(["C9"]),
  source: SourceSchema,
})

// Exhibition schema
export const ExhibitionSchema = z.object({
  id: z.string().optional(),
  venue: z.string(),
  title: z.string().optional(),
  type: z.enum(["solo", "group", "permanent", "touring", "other"]).optional(),
  year: z.number().optional(),
  location: z.string().optional(),
  mapped_criteria: z.array(CriterionIdSchema).default(["C7"]),
  source: SourceSchema,
})

// Commercial success schema
export const CommercialSuccessSchema = z.object({
  id: z.string().optional(),
  description: z.string(),
  metrics: z.string().optional(),
  revenue: z.number().optional(),
  currency: z.string().optional(),
  mapped_criteria: z.array(CriterionIdSchema).default(["C10"]),
  source: SourceSchema,
})

// Original contribution (not covered by other schemas)
export const OriginalContributionSchema = z.object({
  id: z.string().optional(),
  description: z.string(),
  impact: z.string().optional(),
  evidence: z.string().optional(),
  mapped_criteria: z.array(CriterionIdSchema).default(["C5"]),
  source: SourceSchema,
})

// Criteria summary item
export const CriteriaSummaryItemSchema = z.object({
  criterion_id: CriterionIdSchema,
  evidence_count: z.number(),
  strength: z.enum(["Strong", "Weak", "None"]),
  summary: z.string(),
  key_evidence: z.array(z.string()),
})

// Personal info
export const PersonalInfoSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  linkedin: z.string().optional(),
  current_title: z.string().optional(),
  current_organization: z.string().optional(),
  field: z.string().optional(),
  years_experience: z.number().optional(),
  source: SourceSchema,
})

// Education
export const EducationSchema = z.object({
  degree: z.string(),
  field: z.string().optional(),
  institution: z.string(),
  year: z.number().optional(),
  source: SourceSchema,
})

// Work experience
export const WorkExperienceSchema = z.object({
  title: z.string(),
  organization: z.string(),
  start_year: z.number().optional(),
  end_year: z.number().optional(),
  description: z.string().optional(),
  source: SourceSchema,
})

// Full detailed extraction schema
export const DetailedExtractionSchema = z.object({
  // Personal info
  personal_info: PersonalInfoSchema.optional(),

  // Education and work
  education: z.array(EducationSchema).default([]),
  work_experience: z.array(WorkExperienceSchema).default([]),

  // EB-1A evidence categories
  publications: z.array(PublicationSchema).default([]),
  awards: z.array(AwardSchema).default([]),
  patents: z.array(PatentSchema).default([]),
  memberships: z.array(MembershipSchema).default([]),
  media_coverage: z.array(MediaCoverageSchema).default([]),
  judging_activities: z.array(JudgingActivitySchema).default([]),
  speaking_engagements: z.array(SpeakingEngagementSchema).default([]),
  grants: z.array(GrantSchema).default([]),
  leadership_roles: z.array(LeadershipRoleSchema).default([]),
  compensation: z.array(CompensationSchema).default([]),
  exhibitions: z.array(ExhibitionSchema).default([]),
  commercial_success: z.array(CommercialSuccessSchema).default([]),
  original_contributions: z.array(OriginalContributionSchema).default([]),

  // Aggregated summary
  criteria_summary: z.array(CriteriaSummaryItemSchema).default([]),

  // Extracted text (for PDF)
  extracted_text: z.string().optional(),
})

export type DetailedExtraction = z.infer<typeof DetailedExtractionSchema>
export type Publication = z.infer<typeof PublicationSchema>
export type Award = z.infer<typeof AwardSchema>
export type Patent = z.infer<typeof PatentSchema>
export type Membership = z.infer<typeof MembershipSchema>
export type MediaCoverage = z.infer<typeof MediaCoverageSchema>
export type JudgingActivity = z.infer<typeof JudgingActivitySchema>
export type SpeakingEngagement = z.infer<typeof SpeakingEngagementSchema>
export type Grant = z.infer<typeof GrantSchema>
export type LeadershipRole = z.infer<typeof LeadershipRoleSchema>
export type Compensation = z.infer<typeof CompensationSchema>
export type Exhibition = z.infer<typeof ExhibitionSchema>
export type CommercialSuccess = z.infer<typeof CommercialSuccessSchema>
export type OriginalContribution = z.infer<typeof OriginalContributionSchema>
export type CriteriaSummaryItem = z.infer<typeof CriteriaSummaryItemSchema>
export type PersonalInfo = z.infer<typeof PersonalInfoSchema>
export type Education = z.infer<typeof EducationSchema>
export type WorkExperience = z.infer<typeof WorkExperienceSchema>

// Helper: criterion metadata
export const CRITERIA_METADATA: Record<CriterionId, { name: string; description: string }> = {
  C1: { name: "Awards", description: "Nationally/internationally recognized prizes" },
  C2: { name: "Membership", description: "Selective associations requiring outstanding achievement" },
  C3: { name: "Published Material", description: "About the person in professional/major media" },
  C4: { name: "Judging", description: "Participation as judge of others' work" },
  C5: { name: "Original Contributions", description: "Of major significance to the field" },
  C6: { name: "Scholarly Articles", description: "In professional journals" },
  C7: { name: "Artistic Exhibitions", description: "Display of work at artistic exhibitions" },
  C8: { name: "Leading Role", description: "Leading/critical role for distinguished organizations" },
  C9: { name: "High Salary", description: "Significantly above field average" },
  C10: { name: "Commercial Success", description: "In performing arts" },
}
