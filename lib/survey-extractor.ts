import { generateText, Output } from "ai"
import { google } from "@ai-sdk/google"
import { z } from "zod"
import { getPrompt, resolveModel } from "./agent-prompt"

const FALLBACK_MODEL = "gemini-2.5-flash"

// Schema that matches the survey structure exactly
export const SurveyExtractionSchema = z.object({
  personal: z.object({
    passion: z.string().nullable().describe("What drives their passion for their field"),
    usPlans: z.string().nullable().describe("Any U.S. job offers, employment, or business plans mentioned"),
    usResources: z.string().nullable().describe("U.S. resources, institutions, or collaborators mentioned"),
    fiveYearPlan: z.string().nullable().describe("Any career goals or plans mentioned"),
    whyPermanent: z.string().nullable().describe("Any reasons for wanting permanent residency"),
  }).optional(),
  background: z.object({
    fullName: z.string().nullable().describe("Full legal name"),
    dateOfBirth: z.string().nullable().describe("Date of birth if mentioned"),
    countryOfBirth: z.string().nullable().describe("Country of birth"),
    citizenship: z.string().nullable().describe("Current citizenship"),
    areaOfExpertise: z.string().nullable().describe("Primary area of expertise (e.g., Machine Learning, Medicine)"),
    specificField: z.string().nullable().describe("Specific subfield (e.g., Computer Vision, Oncology)"),
    currentTitle: z.string().nullable().describe("Current job title"),
    currentEmployer: z.string().nullable().describe("Current employer/organization"),
    yearsExperience: z.number().nullable().describe("Total years of professional experience"),
    education: z.array(z.object({
      degree: z.string(),
      institution: z.string(),
      year: z.number().nullable(),
      field: z.string().nullable(),
    })).nullable().describe("Educational background"),
  }).optional(),
  intent: z.object({
    continueInField: z.boolean().nullable().describe("Whether they plan to continue in their field"),
    hasJobOffer: z.boolean().nullable().describe("Whether they have a U.S. job offer"),
    jobOfferDetails: z.string().nullable().describe("Details about job offer if any"),
    hasBusinessPlan: z.boolean().nullable().describe("Whether they have a business plan"),
    businessPlanDetails: z.string().nullable().describe("Business plan details if any"),
    usBenefit: z.string().nullable().describe("How their work benefits the U.S."),
    moveTimeline: z.string().nullable().describe("Timeline for moving to U.S."),
  }).optional(),
  awards: z.object({
    majorAchievements: z.string().nullable().describe("Major one-time achievements like Nobel, Pulitzer, etc."),
    awards: z.array(z.object({
      name: z.string(),
      issuer: z.string().nullable(),
      year: z.number().nullable(),
      criteria: z.string().nullable().describe("Selection criteria if known"),
      scope: z.string().nullable().describe("national, international, regional"),
    })).nullable().describe("List of awards and honors"),
    mediaCoverage: z.string().nullable().describe("Media coverage about the person"),
  }).optional(),
  standing: z.object({
    selectiveMemberships: z.string().nullable().describe("Fellow status, elected memberships in selective organizations"),
    judgingActivities: z.string().nullable().describe("Peer review, grant panels, award committees"),
    editorialBoards: z.string().nullable().describe("Journal editorial boards, associate editor positions"),
  }).optional(),
  contributions: z.object({
    originalContributions: z.string().nullable().describe("Patents, frameworks, algorithms, techniques developed"),
    publicationCount: z.number().nullable().describe("Number of publications"),
    citationCount: z.number().nullable().describe("Total citations"),
    hIndex: z.number().nullable().describe("h-index if mentioned"),
    artisticExhibitions: z.string().nullable().describe("Galleries, museums, performances if applicable"),
  }).optional(),
  leadership: z.object({
    leadingRoles: z.string().nullable().describe("Director, PI, founding team, critical positions held"),
    compensationDetails: z.string().nullable().describe("High salary, equity, bonuses mentioned"),
  }).optional(),
  evidence: z.object({
    selfAssessment: z.string().nullable().describe("Any self-assessment of standing in field"),
    documentationAvailability: z.string().nullable().describe("Evidence they mention having"),
    timeline: z.string().nullable().describe("Urgency or timeline mentioned"),
    priorAttorneyConsultations: z.string().nullable().describe("Prior immigration attorney consultations"),
  }).optional(),
})

export type SurveyExtraction = z.infer<typeof SurveyExtractionSchema>

const FALLBACK_PROMPT = `You are an expert at extracting information from resumes and CVs for EB-1A (Extraordinary Ability) visa applications. Do not use emojis in any output.

Your task is to extract information that maps to an EB-1A intake survey. The EB-1A visa requires demonstrating extraordinary ability through:
1. Awards/recognition for excellence
2. Membership in selective associations
3. Published material about the person
4. Judging the work of others
5. Original contributions of major significance
6. Scholarly articles
7. Artistic exhibitions
8. Leading/critical roles
9. High salary/compensation
10. Commercial success in performing arts

Extract as much relevant information as possible from the document. For each field:
- Extract what is explicitly stated or can be reasonably inferred
- Return null if the information is not present
- Be comprehensive - look for evidence that supports any of the 10 EB-1A criteria
- For text fields, provide detailed summaries when relevant information exists
- For leadership roles, include the scope and impact
- For awards, note any selectivity criteria mentioned
- For publications, count them if listed
- Calculate years of experience from work history dates

Focus on extracting information that demonstrates extraordinary ability and national/international recognition.`

export async function extractSurveyData(resumeText: string): Promise<SurveyExtraction> {
  const p = await getPrompt("survey-extractor")
  const { output } = await generateText({
    model: p ? resolveModel(p.provider, p.modelName) : google(FALLBACK_MODEL),
    output: Output.object({ schema: SurveyExtractionSchema }),
    system: p?.content ?? FALLBACK_PROMPT,
    prompt: `Extract EB-1A survey information from this resume/CV:\n\n${resumeText}`,
  })

  return cleanExtraction(output!)
}

export async function extractSurveyDataFromPdf(pdfBuffer: ArrayBuffer): Promise<SurveyExtraction> {
  const p = await getPrompt("survey-extractor")
  const { output } = await generateText({
    model: p ? resolveModel(p.provider, p.modelName) : google(FALLBACK_MODEL),
    output: Output.object({ schema: SurveyExtractionSchema }),
    system: p?.content ?? FALLBACK_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract EB-1A survey information from this PDF resume/CV.",
          },
          {
            type: "file",
            data: Buffer.from(pdfBuffer),
            mediaType: "application/pdf",
          },
        ],
      },
    ],
  })

  return cleanExtraction(output!)
}

// --- ID Document extraction ---

export const IdDocExtractionSchema = z.object({
  fullName: z.string().nullable(),
  dateOfBirth: z.string().nullable().describe("ISO date or readable date string"),
  countryOfBirth: z.string().nullable(),
  citizenship: z.string().nullable(),
})

export type IdDocExtraction = z.infer<typeof IdDocExtractionSchema>

const ID_DOC_FALLBACK_PROMPT = `Extract identity information from this document (passport, driver's license, or visa page). Do not use emojis.
Return the person's full name, date of birth, country of birth, and citizenship/nationality.
If a field is not visible or not applicable for this document type, return null.`

export async function extractFromIdDocument(
  buffer: Buffer,
  mediaType: "application/pdf" | "image/jpeg" | "image/png"
): Promise<IdDocExtraction> {
  const p = await getPrompt("id-doc-extractor")
  const { output } = await generateText({
    model: p ? resolveModel(p.provider, p.modelName) : google(FALLBACK_MODEL),
    output: Output.object({ schema: IdDocExtractionSchema }),
    system: p?.content ?? ID_DOC_FALLBACK_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract identity information from this document.",
          },
          {
            type: "file",
            data: buffer,
            mediaType,
          },
        ],
      },
    ],
  })

  return output ?? { fullName: null, dateOfBirth: null, countryOfBirth: null, citizenship: null }
}

// Clean nulls from extraction to match survey schema expectations
function cleanExtraction(data: SurveyExtraction): SurveyExtraction {
  const clean = (obj: Record<string, unknown>): Record<string, unknown> => {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) continue
      if (Array.isArray(value)) {
        if (value.length > 0) result[key] = value
      } else if (typeof value === "object") {
        const cleaned = clean(value as Record<string, unknown>)
        if (Object.keys(cleaned).length > 0) result[key] = cleaned
      } else {
        result[key] = value
      }
    }
    return result
  }
  return clean(data as unknown as Record<string, unknown>) as SurveyExtraction
}
