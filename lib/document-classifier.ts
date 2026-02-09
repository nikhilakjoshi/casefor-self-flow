import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { db } from "./db";

const MODEL = "claude-haiku-3-5-20241022";

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
    "PASSPORT_ID",
    "DEGREE_CERTIFICATE",
    "OTHER",
  ]),
  confidence: z.number().min(0).max(1),
});

export async function classifyDocument(
  documentId: string,
  fileName: string,
  content?: string | null
): Promise<void> {
  try {
    const input = content
      ? `Filename: ${fileName}\n\nContent (first 1500 chars):\n${content.slice(0, 1500)}`
      : `Filename: ${fileName}`;

    const { object } = await generateObject({
      model: anthropic(MODEL),
      schema: ClassificationSchema,
      prompt: `Classify this immigration case document into one of the categories. Return the best-fit category and your confidence (0-1).

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
- PASSPORT_ID: Passport, ID, or identity document
- DEGREE_CERTIFICATE: Academic degree, diploma, or transcript
- OTHER: Does not fit any above category

${input}`,
    });

    await db.document.update({
      where: { id: documentId },
      data: {
        category: object.category,
        classificationConfidence: object.confidence,
      },
    });
  } catch (err) {
    console.error(`[DocumentClassifier] Failed for ${documentId}:`, err);
  }
}
