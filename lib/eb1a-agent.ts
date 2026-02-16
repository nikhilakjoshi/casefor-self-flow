import { generateText, streamText, Output } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { google } from "@ai-sdk/google"
import { z } from "zod"
import { getCriteriaForType, type Criterion } from "./criteria"
import {
  DetailedExtractionSchema,
  PersonalInfoSchema,
  EducationSchema,
  WorkExperienceSchema,
  type DetailedExtraction,
  type CriteriaSummaryItem,
  CRITERIA_METADATA,
} from "./eb1a-extraction-schema"
import { multipassExtract } from "./multipass-extraction"

// Legacy schema for backward compatibility
export const CriterionResultSchema = z.object({
  criterionId: z.string().describe("ID of the criterion being evaluated"),
  strength: z
    .enum(["Strong", "Weak", "None"])
    .describe(
      "Strength of evidence: Strong (clear evidence), Weak (some evidence), None (no evidence)"
    ),
  reason: z.string().describe("Brief explanation of the evaluation"),
  evidence: z
    .array(z.string())
    .describe("Direct quotes from resume supporting this evaluation"),
})

export const EB1AEvaluationSchema = z.object({
  criteria: z
    .array(CriterionResultSchema)
    .describe("Evaluation for each of the 10 EB-1A criteria"),
})

export type CriterionResult = z.infer<typeof CriterionResultSchema>
export type EB1AEvaluation = z.infer<typeof EB1AEvaluationSchema>

const MODEL = "claude-sonnet-4-20250514"
const QUICK_PROFILE_MODEL = "gemini-2.5-flash"

// Small schema for fast profile extraction
const QuickProfileSchema = z.object({
  personal_info: PersonalInfoSchema.optional(),
  education: z.array(EducationSchema).default([]),
  work_experience: z.array(WorkExperienceSchema).default([]),
})

export async function streamQuickProfile(
  resumeText: string,
  surveyData?: Record<string, unknown>
) {
  const surveyContext = surveyData
    ? `\n\nADDITIONAL CONTEXT FROM USER SURVEY:\n${JSON.stringify(surveyData, null, 2)}`
    : ""

  return streamText({
    model: google(QUICK_PROFILE_MODEL),
    output: Output.object({ schema: QuickProfileSchema }),
    prompt: `Extract the person's profile, education, and work experience from this resume.\n\n${resumeText}${surveyContext}`,
  })
}

export async function streamQuickProfileFromPdf(
  pdfBuffer: ArrayBuffer,
  surveyData?: Record<string, unknown>
) {
  const surveyContext = surveyData
    ? `\n\nADDITIONAL CONTEXT FROM USER SURVEY:\n${JSON.stringify(surveyData, null, 2)}`
    : ""

  return streamText({
    model: google(QUICK_PROFILE_MODEL),
    output: Output.object({ schema: QuickProfileSchema }),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Extract the person's profile, education, and work experience from this resume.${surveyContext}`,
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
}

// Extract text from PDF using gemini-flash (cheap, fast — avoids sending PDF 10x to Claude)
export async function extractTextFromPdf(
  pdfBuffer: ArrayBuffer,
): Promise<string> {
  const { text } = await generateText({
    model: google(QUICK_PROFILE_MODEL),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract ALL text from this PDF document. Return the complete text content, preserving structure (headings, lists, tables). Do not summarize or omit anything.",
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
  return text
}

const EXTRACTION_SYSTEM_PROMPT = `You are an EB-1A immigration expert. Extract ALL structured information from this resume/CV and map each item to the relevant EB-1A criteria. Do not use emojis in any output.

THE 10 EB-1A CRITERIA:
C1: Awards - nationally/internationally recognized prizes for excellence
C2: Membership - selective associations requiring outstanding achievement as judged by recognized experts
C3: Published material - about the person in professional/major trade publications or media
C4: Judging - participation as judge of others' work in the same or allied field
C5: Original contributions - of major significance to the field
C6: Scholarly articles - authorship of scholarly articles in professional journals or other major media
C7: Artistic exhibitions - display of work at artistic exhibitions or showcases
C8: Leading/critical role - for organizations/establishments with distinguished reputation
C9: High salary - commanding a high salary or significantly high remuneration relative to others in the field
C10: Commercial success - in performing arts, commercial success

EXTRACTION GUIDELINES:
- Extract EVERYTHING you can find - be thorough
- For publications: identify venue_tier as "top_tier" for Nature/Science/Cell/CVPR/NeurIPS/ICML/ICLR/ACL/EMNLP/SIGGRAPH/CHI/OSDI/SOSP and similar top venues
- For awards: classify scope as international/national/regional/local based on the awarding body
- For judging: include peer review, editorial boards, grant panels, thesis committees, competition judging
- For memberships: note any selectivity criteria or requirements mentioned
- Map each item to ALL applicable criteria (some items may map to multiple)
- Include original_contributions for significant work not captured elsewhere
- Generate a criteria_summary aggregating all evidence per criterion with strength assessment

STRENGTH ASSESSMENT GUIDELINES:
- Strong: Clear, compelling evidence that meets USCIS standards (3+ strong items for that criterion)
- Weak: Some evidence but needs strengthening or documentation (1-2 items or unclear significance)
- None: No evidence found for this criterion

Be thorough and extract everything. Missing evidence is worse than over-extraction.`

// Schema for PDF extraction that includes extracted text
const PdfExtractionSchema = z.object({
  extracted_text: z.string().describe("The full text content extracted from the PDF"),
  ...DetailedExtractionSchema.omit({ extracted_text: true }).shape,
})

// Multipass extraction — 10 parallel per-criterion calls
export async function extractAndEvaluate(
  resumeText: string,
  surveyData?: Record<string, unknown>,
  onCriterionComplete?: (criterion: string, partialAssembly: DetailedExtraction) => void,
): Promise<DetailedExtraction> {
  return multipassExtract(resumeText, surveyData, onCriterionComplete)
}

export async function extractAndEvaluateFromPdf(
  pdfBuffer: ArrayBuffer,
  surveyData?: Record<string, unknown>
): Promise<{ extraction: DetailedExtraction; extractedText: string }> {
  const surveyContext = surveyData
    ? `\n\nADDITIONAL CONTEXT FROM USER SURVEY:\n${JSON.stringify(surveyData, null, 2)}`
    : ""

  const { output } = await generateText({
    model: anthropic(MODEL),
    output: Output.object({ schema: PdfExtractionSchema }),
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `First extract all text from this PDF resume, then extract structured information and evaluate against EB-1A criteria.${surveyContext}`,
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

  const extractedText = output!.extracted_text
  return {
    extraction: { ...output!, extracted_text: extractedText },
    extractedText,
  }
}

export async function streamExtractAndEvaluate(
  resumeText: string,
  surveyData?: Record<string, unknown>
) {
  const surveyContext = surveyData
    ? `\n\nADDITIONAL CONTEXT FROM USER SURVEY:\n${JSON.stringify(surveyData, null, 2)}`
    : ""

  return streamText({
    model: anthropic(MODEL),
    output: Output.object({ schema: DetailedExtractionSchema }),
    system: EXTRACTION_SYSTEM_PROMPT,
    prompt: `Extract all structured information from this resume and evaluate against EB-1A criteria:\n\n${resumeText}${surveyContext}`,
  })
}

export async function streamExtractAndEvaluateFromPdf(
  pdfBuffer: ArrayBuffer,
  surveyData?: Record<string, unknown>
) {
  const surveyContext = surveyData
    ? `\n\nADDITIONAL CONTEXT FROM USER SURVEY:\n${JSON.stringify(surveyData, null, 2)}`
    : ""

  return streamText({
    model: anthropic(MODEL),
    output: Output.object({ schema: PdfExtractionSchema }),
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `First extract all text from this PDF resume, then extract structured information and evaluate against EB-1A criteria.${surveyContext}`,
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
}

// Convert detailed extraction to legacy format
export function extractionToLegacyFormat(extraction: DetailedExtraction): EB1AEvaluation {
  const criteriaMap: Record<string, CriterionResult> = {}

  // Initialize all criteria
  const allCriteria = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10"]
  for (const id of allCriteria) {
    const meta = CRITERIA_METADATA[id as keyof typeof CRITERIA_METADATA]
    criteriaMap[id] = {
      criterionId: id,
      strength: "None",
      reason: `No evidence found for ${meta.name.toLowerCase()}`,
      evidence: [],
    }
  }

  // Use criteria_summary if available
  if (extraction.criteria_summary && extraction.criteria_summary.length > 0) {
    for (const summary of extraction.criteria_summary) {
      criteriaMap[summary.criterion_id] = {
        criterionId: summary.criterion_id,
        strength: summary.strength,
        reason: summary.summary,
        evidence: summary.key_evidence,
      }
    }
  }

  return {
    criteria: allCriteria.map((id) => criteriaMap[id]),
  }
}

// Legacy wrapper functions for backward compatibility
async function loadCriteria(criteria?: Criterion[]): Promise<Criterion[]> {
  if (criteria && criteria.length > 0) return criteria
  return getCriteriaForType("EB1A")
}

export async function evaluateResume(
  resumeText: string,
  criteria?: Criterion[]
): Promise<EB1AEvaluation> {
  const extraction = await extractAndEvaluate(resumeText)
  return extractionToLegacyFormat(extraction)
}

export async function evaluateResumePdf(
  pdfBuffer: ArrayBuffer,
  criteria?: Criterion[]
): Promise<{ evaluation: EB1AEvaluation; extractedText: string }> {
  const { extraction, extractedText } = await extractAndEvaluateFromPdf(pdfBuffer)
  return {
    evaluation: extractionToLegacyFormat(extraction),
    extractedText,
  }
}

// Legacy streaming - now returns detailed extraction stream
export async function streamEvaluateResumePdf(
  pdfBuffer: ArrayBuffer,
  criteria?: Criterion[]
) {
  return streamExtractAndEvaluateFromPdf(pdfBuffer)
}

export async function streamEvaluateResume(
  resumeText: string,
  criteria?: Criterion[]
) {
  return streamExtractAndEvaluate(resumeText)
}

// Helper to count strong/weak criteria
export function countCriteriaStrengths(evaluation: EB1AEvaluation): {
  strong: number
  weak: number
  none: number
} {
  return evaluation.criteria.reduce(
    (acc, c) => {
      if (c.strength === "Strong") acc.strong++
      else if (c.strength === "Weak") acc.weak++
      else acc.none++
      return acc
    },
    { strong: 0, weak: 0, none: 0 }
  )
}

// Count from detailed extraction
export function countExtractionStrengths(extraction: DetailedExtraction): {
  strong: number
  weak: number
  none: number
} {
  if (!extraction.criteria_summary || extraction.criteria_summary.length === 0) {
    return { strong: 0, weak: 0, none: 10 }
  }

  const counts = { strong: 0, weak: 0, none: 0 }
  const foundCriteria = new Set<string>()

  for (const summary of extraction.criteria_summary) {
    foundCriteria.add(summary.criterion_id)
    if (summary.strength === "Strong") counts.strong++
    else if (summary.strength === "Weak") counts.weak++
    else counts.none++
  }

  // Count criteria not in summary as None
  const allCriteria = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10"]
  counts.none += allCriteria.filter((c) => !foundCriteria.has(c)).length

  return counts
}

// Re-export types and schemas from extraction schema
export { DetailedExtractionSchema, type DetailedExtraction, type CriteriaSummaryItem }
export { multipassExtract } from "./multipass-extraction"
