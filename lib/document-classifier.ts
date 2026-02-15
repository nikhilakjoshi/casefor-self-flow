import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { db } from "./db";
import { getPrompt, substituteVars, resolveModel } from "./agent-prompt";

const FALLBACK_MODEL = "claude-haiku-4-5-20251001";

const ClassificationSchema = z.object({
  category: z.enum([
    "RESUME_CV",
    "AWARD_CERTIFICATE",
    "PUBLICATION",
    "MEDIA_COVERAGE",
    "PATENT",
    "RECOMMENDATION_LETTER",
    "MEMBERSHIP_CERTIFICATE",
    "EMPLOYMENT_VERIFICATION",
    "SALARY_DOCUMENTATION",
    "CITATION_REPORT",
    "JUDGING_EVIDENCE",
    "PERSONAL_STATEMENT",
    "PETITION_LETTER",
    "PASSPORT_ID",
    "DEGREE_CERTIFICATE",
    "COVER_LETTER",
    "USCIS_ADVISORY_LETTER",
    "G1450PPU",
    "G1450300",
    "G1450I40",
    "G28",
    "I140",
    "I907",
    "OTHER",
  ]),
  confidence: z.number().describe("Confidence score between 0 and 1"),
});

export interface ClassificationResult {
  category: string
  confidence: number
}

export async function classifyDocument(
  documentId: string,
  fileName: string,
  content?: string | null
): Promise<ClassificationResult | null> {
  try {
    const FALLBACK_PROMPT = `Classify this immigration case document into one of the categories. Return the best-fit category and your confidence (0-1).

Categories:
- RESUME_CV: Resume or curriculum vitae
- AWARD_CERTIFICATE: Award, prize, or honor certificate
- PUBLICATION: Published article, paper, or book
- MEDIA_COVERAGE: News article, press coverage, or media mention
- PATENT: Patent filing or grant
- RECOMMENDATION_LETTER: Letter of recommendation or support
- MEMBERSHIP_CERTIFICATE: Professional membership or association certificate
- EMPLOYMENT_VERIFICATION: Employment letter, contract, or verification
- SALARY_DOCUMENTATION: Pay stubs, tax returns, or compensation evidence
- CITATION_REPORT: Citation metrics, Google Scholar report, or impact data
- JUDGING_EVIDENCE: Evidence of judging, reviewing, or evaluating others' work
- PERSONAL_STATEMENT: Personal statement or declaration
- PETITION_LETTER: Petition letter or legal brief
- PASSPORT_ID: Passport, ID, or identity document
- DEGREE_CERTIFICATE: Academic degree, diploma, or transcript
- COVER_LETTER: Cover letter for the petition package
- USCIS_ADVISORY_LETTER: USCIS advisory or expert opinion letter
- G1450PPU: USCIS Form G-1450 for Premium Processing Unit fee
- G1450300: USCIS Form G-1450 for $300 fee payment
- G1450I40: USCIS Form G-1450 for I-40 fee payment
- G28: USCIS Form G-28 Notice of Entry of Appearance as Attorney
- I140: USCIS Form I-140 Immigrant Petition for Alien Workers
- I907: USCIS Form I-907 Request for Premium Processing Service
- OTHER: Does not fit any above category

Filename pattern hints: files containing "g-28" or "g28" -> G28, "i-140" or "i140" -> I140, "i-907" or "i907" -> I907, "g-1450" or "g1450" -> one of the G1450 variants, "cover" -> COVER_LETTER, "advisory" or "expert opinion" -> USCIS_ADVISORY_LETTER.

{{fileName}}
{{content}}`;

    const p = await getPrompt("document-classifier");
    const promptTemplate = p?.content ?? FALLBACK_PROMPT;
    const prompt = substituteVars(promptTemplate, {
      fileName: `Filename: ${fileName}`,
      content: content ? `Content (first 1500 chars):\n${content.slice(0, 1500)}` : "",
    });

    const { object } = await generateObject({
      model: p ? resolveModel(p.provider, p.modelName) : anthropic(FALLBACK_MODEL),
      schema: ClassificationSchema,
      prompt,
    });

    await db.document.update({
      where: { id: documentId },
      data: {
        category: object.category,
        classificationConfidence: object.confidence,
      },
    });

    return { category: object.category, confidence: object.confidence }
  } catch (err) {
    console.error(`[DocumentClassifier] Failed for ${documentId}:`, err);
    return null
  }
}
