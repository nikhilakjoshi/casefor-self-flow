import { z } from "zod"

export const IntakeBackgroundSchema = z.object({
  citizenship: z.string().optional(),
  currentCountry: z.string().optional(),
  field: z.string().optional(),
  currentEmployer: z.string().optional(),
  yearsExperience: z.number().optional(),
  highestDegree: z.string().optional(),
  degreeInstitution: z.string().optional(),
  degreeYear: z.number().optional(),
})

export const IntakeAchievementsSchema = z.object({
  majorAchievement: z.string().optional(),
  socialFollowing: z.string().optional(),
  keynoteSpeaker: z.boolean().optional(),
  mediaFeatures: z.string().optional(),
  patentCount: z.number().optional(),
  citationCount: z.number().optional(),
})

export const IntakeImmigrationSchema = z.object({
  currentVisaStatus: z.string().optional(),
  hasUsIntent: z.boolean().optional(),
  targetTimeline: z.string().optional(),
  priorPetitions: z.string().optional(),
  hasAttorney: z.boolean().optional(),
})

export const IntakePreferencesSchema = z.object({
  urgencyLevel: z.enum(["low", "medium", "high"]).optional(),
  communicationPreference: z.enum(["email", "chat", "both"]).optional(),
  primaryGoal: z.string().optional(),
  additionalNotes: z.string().optional(),
})

export const IntakeDataSchema = z.object({
  background: IntakeBackgroundSchema.optional(),
  achievements: IntakeAchievementsSchema.optional(),
  immigration: IntakeImmigrationSchema.optional(),
  preferences: IntakePreferencesSchema.optional(),
})

export type IntakeBackground = z.infer<typeof IntakeBackgroundSchema>
export type IntakeAchievements = z.infer<typeof IntakeAchievementsSchema>
export type IntakeImmigration = z.infer<typeof IntakeImmigrationSchema>
export type IntakePreferences = z.infer<typeof IntakePreferencesSchema>
export type IntakeData = z.infer<typeof IntakeDataSchema>

export const INTAKE_SECTIONS = ["background", "achievements", "immigration", "preferences"] as const
export type IntakeSection = (typeof INTAKE_SECTIONS)[number]

export const SECTION_LABELS: Record<IntakeSection, string> = {
  background: "Background",
  achievements: "Achievements",
  immigration: "Immigration",
  preferences: "Preferences",
}
