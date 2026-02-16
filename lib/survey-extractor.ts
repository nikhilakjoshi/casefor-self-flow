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

Your task is to extract information that maps to an EB-1A intake survey. The EB-1A visa requires demonstrating extraordinary ability in one of these 10 criteria:

  C1  Awards / recognition for excellence
  C2  Membership in selective associations
  C3  Published material about the person
  C4  Judging the work of others
  C5  Original contributions of major significance
  C6  Scholarly articles
  C7  Artistic exhibitions or showcases
  C8  Leading or critical roles in distinguished organizations
  C9  High salary or compensation relative to field
  C10 Commercial success in performing arts

---

EXTRACTION RULES

- Extract what is explicitly stated or can be reasonably inferred.
- Return null when information is not present. Never fabricate.
- Be comprehensive -- look for evidence supporting any of the 10 criteria.
- Calculate years of experience from work-history dates when possible.
- For publications, count them if listed and extract citation/h-index data.

---

OUTPUT FORMATTING

The output schema has two kinds of fields: structured arrays and free-text strings.

### Structured array fields
For \`awards[]\` and \`education[]\`, populate every sub-field you can find. For \`awards[].criteria\`, describe selectivity concisely: include acceptance rate, applicant pool size, or nomination process when available. Example:

  criteria: "Fewer than 5% of nominees selected from a pool of 2,000+ international applicants"

### Free-text string fields
Many fields are strings that hold multi-item evidence. Format these as:
- A one-sentence summary line (the "what and why it matters")
- Followed by a bulleted list of individual items
- Each bullet should be one concrete item, not a mini-paragraph
- Tag each bullet with the most relevant EB-1A criterion in brackets: [C1]-[C10]
- If a bullet is relevant to multiple criteria, include multiple tags: [C4][C8]
- Order bullets by strength of evidence (strongest first)

**Apply this format to these fields:**

\`awards.majorAchievements\`
\`\`\`
Recognized with multiple internationally competitive honors in computational biology.
- [C1] Gordon Bell Prize, ACM, 2022 -- awarded to top HPC research team worldwide
- [C1] Best Paper Award, NeurIPS 2021 -- selected from 9,122 submissions (acceptance rate 1.2%)
\`\`\`

\`awards.mediaCoverage\`
\`\`\`
Featured in major international outlets for pioneering work in gene therapy.
- [C3] "The Scientist Rewriting DNA" -- Nature, cover feature, March 2023
- [C3] Interview on gene-editing breakthroughs -- BBC World Service, Nov 2022
- [C3] Profile in MIT Technology Review's "35 Under 35" list, 2021
\`\`\`

\`standing.selectiveMemberships\`
\`\`\`
Elected fellow/member of highly selective national and international bodies.
- [C2] Fellow, IEEE -- elected 2023; requires nomination by existing fellows, <0.1% of membership
- [C2] Member, National Academy of Inventors -- invitation-only, ~3,000 members worldwide
\`\`\`

\`standing.judgingActivities\`
\`\`\`
Regularly invited to judge and review work of peers at top venues.
- [C4] Program Committee, NeurIPS 2022-2024 -- reviewed 15+ papers per cycle
- [C4] NIH Study Section reviewer, 2023 -- evaluated R01 grant proposals ($2M+ each)
- [C4] Judge, International Science Olympiad, 2021
\`\`\`

\`standing.editorialBoards\`
\`\`\`
Serves on editorial boards of high-impact journals.
- [C4] Associate Editor, IEEE Transactions on Pattern Analysis (IF 24.3), 2022-present
- [C4] Editorial Board, Nature Machine Intelligence, 2023-present
\`\`\`

\`contributions.originalContributions\`
\`\`\`
Developed multiple algorithms and frameworks adopted by industry and cited extensively.
- [C5] Invented the XYZ architecture (2021), now used in production at Google and Meta; 1,200+ citations
- [C5] Developed open-source framework "FastTrain" with 8k GitHub stars; adopted by 50+ research labs
- [C5] Co-invented a patented drug-delivery mechanism (US Patent #12,345,678) licensed to Pfizer
\`\`\`

\`contributions.artisticExhibitions\`
\`\`\`
Exhibited work at major international galleries and biennials.
- [C7] Solo exhibition, MoMA PS1, New York, 2023
- [C7] Venice Biennale, group show, Italian Pavilion, 2022
\`\`\`

\`leadership.leadingRoles\`
\`\`\`
Held critical leadership positions at distinguished organizations.
- [C8] Founding CTO, Acme AI (Series B, $40M raised) -- built team of 30 engineers, 2020-2023
- [C8] Principal Investigator, NIH-funded lab ($2.5M grant), Stanford, 2018-2022
- [C8] Director of Machine Learning, Google DeepMind, 2023-present -- leads 15-person research team
\`\`\`

\`leadership.compensationDetails\`
\`\`\`
Compensation significantly above field norms.
- [C9] Total comp $450K/yr at Google (base + RSU + bonus); 95th percentile for ML researchers per Levels.fyi
- [C9] Received $200K signing bonus, reflecting market premium for expertise
\`\`\`

### Narrative fields (keep as short paragraphs, no bullets)
These fields are inherently narrative. Write 2-4 concise sentences:
- \`personal.passion\`
- \`personal.usPlans\`
- \`personal.usResources\`
- \`personal.fiveYearPlan\`
- \`personal.whyPermanent\`
- \`intent.usBenefit\`
- \`evidence.selfAssessment\`
- \`evidence.documentationAvailability\`

### Numeric fields
Return raw numbers, not formatted strings:
- \`contributions.publicationCount\` -- integer count
- \`contributions.citationCount\` -- integer count
- \`contributions.hIndex\` -- integer
- \`background.yearsExperience\` -- integer

### Boolean fields
Return true/false:
- \`intent.continueInField\` -- true if they work in same field
- \`intent.hasJobOffer\` -- true only if explicitly stated
- \`intent.hasBusinessPlan\` -- true only if explicitly stated

---

Focus on extracting information that demonstrates extraordinary ability and national/international recognition. When in doubt about criterion mapping, pick the single best-fit criterion.`

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
