import { z } from "zod"

// Step 1: Personal Statement
export const SurveyPersonalSchema = z.object({
  passion: z.string().optional(),
  usPlans: z.string().optional(),
  usResources: z.string().optional(),
  fiveYearPlan: z.string().optional(),
  whyPermanent: z.string().optional(),
})

// Step 2: Background & Field
export const SurveyBackgroundSchema = z.object({
  fullName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  countryOfBirth: z.string().optional(),
  citizenship: z.string().optional(),
  areaOfExpertise: z.string().optional(),
  specificField: z.string().optional(),
  currentTitle: z.string().optional(),
  currentEmployer: z.string().optional(),
  yearsExperience: z.number().optional(),
  education: z.array(z.object({
    degree: z.string(),
    institution: z.string(),
    year: z.number().nullable().optional(),
    field: z.string().nullable().optional(),
  })).optional(),
})

// Step 3: U.S. Intent
export const SurveyIntentSchema = z.object({
  continueInField: z.boolean().optional(),
  hasJobOffer: z.boolean().optional(),
  jobOfferDetails: z.string().optional(),
  hasBusinessPlan: z.boolean().optional(),
  businessPlanDetails: z.string().optional(),
  usBenefit: z.string().optional(),
  moveTimeline: z.string().optional(),
})

// Step 4: Awards & Recognition
export const SurveyAwardsSchema = z.object({
  majorAchievements: z.string().optional(),
  awards: z.array(z.object({
    name: z.string(),
    issuer: z.string().optional(),
    year: z.number().nullable().optional(),
    criteria: z.string().optional(),
    scope: z.string().optional(),
  })).optional(),
  mediaCoverage: z.string().optional(),
})

// Step 5: Professional Standing
export const SurveyStandingSchema = z.object({
  selectiveMemberships: z.string().optional(),
  judgingActivities: z.string().optional(),
  editorialBoards: z.string().optional(),
})

// Step 6: Contributions & Publications
export const SurveyContributionsSchema = z.object({
  originalContributions: z.string().optional(),
  publicationCount: z.number().optional(),
  citationCount: z.number().optional(),
  hIndex: z.number().optional(),
  artisticExhibitions: z.string().optional(),
})

// Step 7: Leadership & Compensation
export const SurveyLeadershipSchema = z.object({
  leadingRoles: z.string().optional(),
  compensationDetails: z.string().optional(),
})

// Step 8: Evidence & Timeline
export const SurveyEvidenceSchema = z.object({
  selfAssessment: z.string().optional(),
  documentationAvailability: z.string().optional(),
  timeline: z.string().optional(),
  priorAttorneyConsultations: z.string().optional(),
})

export const SurveyDataSchema = z.object({
  personal: SurveyPersonalSchema.optional(),
  background: SurveyBackgroundSchema.optional(),
  intent: SurveyIntentSchema.optional(),
  awards: SurveyAwardsSchema.optional(),
  standing: SurveyStandingSchema.optional(),
  contributions: SurveyContributionsSchema.optional(),
  leadership: SurveyLeadershipSchema.optional(),
  evidence: SurveyEvidenceSchema.optional(),
})

export type SurveyPersonal = z.infer<typeof SurveyPersonalSchema>
export type SurveyBackground = z.infer<typeof SurveyBackgroundSchema>
export type SurveyIntent = z.infer<typeof SurveyIntentSchema>
export type SurveyAwards = z.infer<typeof SurveyAwardsSchema>
export type SurveyStanding = z.infer<typeof SurveyStandingSchema>
export type SurveyContributions = z.infer<typeof SurveyContributionsSchema>
export type SurveyLeadership = z.infer<typeof SurveyLeadershipSchema>
export type SurveyEvidence = z.infer<typeof SurveyEvidenceSchema>
export type SurveyData = z.infer<typeof SurveyDataSchema>

export const SURVEY_SECTIONS = [
  "background",
  "awards",
  "standing",
  "contributions",
  "leadership",
  "evidence",
] as const
export type SurveySection = (typeof SURVEY_SECTIONS)[number]

export const SECTION_LABELS: Record<SurveySection, string> = {
  background: "Background",
  awards: "Awards",
  standing: "Standing",
  contributions: "Contributions",
  leadership: "Leadership",
  evidence: "Evidence",
}
