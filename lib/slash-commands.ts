/**
 * Shared types and category mapping for editor slash commands.
 * Server builds the per-case command list; client renders it in the menu.
 * This file must stay client-safe (no Prisma, no Node-only imports).
 */

export type SlashCommandId =
  | "outline"
  | "profile"
  | "recommender"
  | "exhibit"
  | "evidence"
  | "argue"
  | "address-weakness"

export type SlashArgKind =
  | "none"
  | "criterion"
  | "recommender"
  | "profile-field"
  | "weakness"
  | "free-text"

export interface SlashArg {
  value: string
  label: string
  description?: string
}

export interface SlashCommand {
  id: SlashCommandId
  label: string
  description: string
  icon: string // lucide icon name
  needsLLM: boolean
  argKind: SlashArgKind
  args: SlashArg[]
  placeholder?: string // for free-text
}

/** Ordered command ids per document category. Earlier = more prominent. */
export const COMMANDS_BY_CATEGORY: Record<string, SlashCommandId[]> = {
  PETITION_LETTER: [
    "outline",
    "argue",
    "evidence",
    "address-weakness",
    "recommender",
    "profile",
    "exhibit",
  ],
  COVER_LETTER: [
    "outline",
    "argue",
    "address-weakness",
    "profile",
    "exhibit",
  ],
  PERSONAL_STATEMENT: [
    "outline",
    "profile",
    "evidence",
    "argue",
    "address-weakness",
  ],
  RECOMMENDATION_LETTER: [
    "outline",
    "recommender",
    "profile",
    "evidence",
  ],
  USCIS_ADVISORY_LETTER: [
    "outline",
    "argue",
    "address-weakness",
  ],
}

export const DEFAULT_COMMAND_IDS: SlashCommandId[] = ["outline", "profile"]

export function commandIdsForCategory(category?: string | null): SlashCommandId[] {
  if (!category) return DEFAULT_COMMAND_IDS
  return COMMANDS_BY_CATEGORY[category] ?? DEFAULT_COMMAND_IDS
}

/** Profile fields exposed via `/profile`. Paths are lookups into CaseProfile.data JSON. */
export const PROFILE_FIELDS: Array<{
  value: string
  label: string
  description: string
  jsonPath: string
}> = [
  { value: "name", label: "Full name", description: "Applicant's full name", jsonPath: "name" },
  { value: "field", label: "Field of expertise", description: "Area of extraordinary ability", jsonPath: "field" },
  { value: "title", label: "Current title", description: "Current professional title", jsonPath: "current_title" },
  { value: "organization", label: "Current organization", description: "Current employer or institution", jsonPath: "current_organization" },
  { value: "country", label: "Country of origin", description: "Applicant's country of origin", jsonPath: "country_of_origin" },
  { value: "years_in_field", label: "Years in field", description: "Total years of experience", jsonPath: "years_in_field" },
]

/** Static skeletons for `/outline`, keyed by document category. */
export const OUTLINE_TEMPLATES: Record<string, string> = {
  PERSONAL_STATEMENT: `## Background and Early Career

[Describe your education and early career.]

## Key Contributions to the Field

[Summarize your two or three most significant contributions.]

## Recognition and Impact

[Awards, citations, media coverage, and peer recognition.]

## Future Plans in the United States

[Describe your planned work in the US and its national importance.]
`,
  COVER_LETTER: `## Introduction

[Brief overview of the applicant and the petition type.]

## Summary of Qualifying Criteria

[List the regulatory criteria claimed with one-sentence summaries.]

## Package Contents

[Enumerate the major exhibits and recommendation letters enclosed.]

## Conclusion

[Respectful request for approval.]
`,
  PETITION_LETTER: `## I. Introduction

[State the classification sought and summarize the applicant's extraordinary ability.]

## II. Legal Standard

[Describe the two-step Kazarian analysis and the regulatory criteria.]

## III. Satisfaction of Regulatory Criteria

### A. [First criterion]

[Evidence and argument.]

### B. [Second criterion]

[Evidence and argument.]

### C. [Third criterion]

[Evidence and argument.]

## IV. Final Merits Determination

[Sustained acclaim, top-of-field analysis.]

## V. Conclusion

[Respectful request for approval.]
`,
  RECOMMENDATION_LETTER: `## Introduction

[Recommender's name, title, organization, and credentials.]

## Relationship with the Applicant

[How and for how long the recommender has known the applicant.]

## The Applicant's Extraordinary Contributions

[Specific achievements the recommender can attest to.]

## Broader Impact on the Field

[How the applicant's work has influenced the field at large.]

## Endorsement

[Strong closing endorsement for the petition.]
`,
  USCIS_ADVISORY_LETTER: `## Introduction

[Identify the attorney and the legal context.]

## Legal Framework

[Describe the applicable regulations and precedent.]

## Analysis

[Apply the law to the applicant's specific facts.]

## Conclusion

[State the legal opinion clearly.]
`,
}

export const DEFAULT_OUTLINE = `## Section 1

[Content.]

## Section 2

[Content.]

## Section 3

[Content.]
`
