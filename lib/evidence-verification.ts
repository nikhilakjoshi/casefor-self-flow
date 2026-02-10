import { generateObject } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { db } from "./db"
import { buildEvaluationContext } from "./strength-evaluation"
import {
  C1VerificationSchema,
  C2VerificationSchema,
  C3VerificationSchema,
  C4VerificationSchema,
  C5VerificationSchema,
} from "./evidence-verification-schema"

const MODEL = "claude-sonnet-4-20250514"

// ─── System Prompts ───

const C1_PROMPT = `You are an EB-1A Evidence Verification Agent for Criterion 1: Awards & Prizes (8 CFR 204.5(h)(3)(i)).

You evaluate a single document against criterion C1. Determine if the document provides evidence of nationally or internationally recognized prizes or awards for excellence in the field.

VERIFICATION CHECKLIST:
- Is this an award/prize (not a certificate of participation, degree, or employment recognition)?
- Is it for excellence in the field (not general academic or employment)?
- Is it nationally or internationally recognized (not internal/institutional only)?
- Is there documentation of selectivity (acceptance rate, number of applicants)?
- Is the awarding body reputable and recognized?

TIER SCORING:
- Tier 1 (9-10): Nobel, Pulitzer, Oscar, Fields Medal, Turing Award, MacArthur
- Tier 2 (7-8.9): Major professional society awards, government national awards, top international competition
- Tier 3 (5-6.9): Competitive fellowships (NSF GRFP, Rhodes, Fulbright), university awards with broader recognition
- Tier 4 (3-4.9): Single-university awards without external validation
- Tier 5 (0-2.9): Employee of Month, participation certificates, Dean's List, course completion

Be honest and precise. Score only what the document actually shows. Do not use emojis.`

const C2_PROMPT = `You are an EB-1A Evidence Verification Agent for Criterion 2: Membership in Associations (8 CFR 204.5(h)(3)(ii)).

You evaluate a single document against criterion C2. Determine if the document provides evidence of membership in associations that require outstanding achievements of their members, as judged by recognized national or international experts.

THREE-PART TEST (all must be satisfied):
1. Outstanding achievement required: The association must require outstanding achievements for admission
2. Expert judgment documented: Membership decisions must be judged by recognized experts
3. Distinct from employment: Membership cannot be automatic from employment/degree

VERIFICATION CHECKLIST:
- Does the document show actual membership (not just application or interest)?
- Does it identify the association and its membership criteria?
- Is there evidence of selective admission (<15% acceptance ideal)?
- Are the judges/selectors recognized experts?
- Is this membership distinct from employment or degree requirements?

TIER SCORING:
- Tier 1 (9-10): National Academy (NAS, NAE, NAM), Royal Society Fellow. <1% acceptance
- Tier 2 (7-8.9): Fellow-level in major society (IEEE Fellow, ACM Fellow). <5% acceptance
- Tier 3 (5-6.9): Senior member with documented selective process. 5-15% acceptance
- Tier 4 (3-4.9): Standard professional membership with some selection
- Tier 5 (0-2.9): Basic membership, dues-based, automatic

Be honest and precise. Score only what the document actually shows. Do not use emojis.`

const C3_PROMPT = `You are an EB-1A Evidence Verification Agent for Criterion 3: Published Material About the Applicant (8 CFR 204.5(h)(3)(iii)).

You evaluate a single document against criterion C3. Determine if the document is published material in professional or major trade publications or other major media ABOUT the applicant and their work.

ABOUT TEST (all should be satisfied for strong evidence):
1. Primarily about petitioner: The material must be primarily about the applicant, not just a passing mention
2. Major media or trade publication: Must be in a major media outlet or professional/trade publication
3. Title, date, author present: Must have identifiable publication metadata
4. Independent editorial: Must be independently produced (not press releases, not paid content)

VERIFICATION CHECKLIST:
- Is the article/material primarily ABOUT the applicant (not just mentioning them)?
- Is it in a major trade publication or major media outlet?
- Can you verify title, date, and author?
- Is it editorially independent (not a press release or paid placement)?
- What is the circulation/readership of the publication?

TIER SCORING:
- Tier 1 (9-10): Top-tier outlets (NYT, WSJ, BBC, Nature News) specifically about applicant. Circulation >1M
- Tier 2 (7-8.9): Major national media. 3+ independent outlets. Substantial discussion
- Tier 3 (5-6.9): Regional media or niche trade publications. 2-3 outlets
- Tier 4 (3-4.9): Local media, brief mentions
- Tier 5 (0-2.9): Press releases, marketing materials, self-published, social media

Be honest and precise. Score only what the document actually shows. Do not use emojis.`

const C4_PROMPT = `You are an EB-1A Evidence Verification Agent for Criterion 4: Judging the Work of Others (8 CFR 204.5(h)(3)(iv)).

You evaluate a single document against criterion C4. Determine if the document provides evidence of participation as a judge of the work of others in the same or an allied field.

JUDGING TEST:
1. Actual participation proven: Must show actual judging activity (not just invitation)
2. Peers not students: Must be judging peers' work (not grading students)
3. Venue prestige documented: The venue/journal/conference should be reputable
4. Sustained pattern: Ideally shows ongoing judging, not one-off

VERIFICATION CHECKLIST:
- Does the document prove actual judging/reviewing activity?
- Is this peer review (not student grading or internal code review)?
- What is the prestige of the journal/conference/competition?
- Is there evidence of multiple reviews or sustained involvement?
- Are there specific review counts, editorial board membership, or program committee roles?

TIER SCORING:
- Tier 1 (9-10): Editor for major journal AND 200+ reviews. OR Senior conference role at top venue
- Tier 2 (7-8.9): Editorial board OR 100+ reviews. OR Conference senior PC
- Tier 3 (5-6.9): PC member AND 50+ reviews
- Tier 4 (3-4.9): <50 reviews. Low-impact journals only
- Tier 5 (0-2.9): Grading students, internal code reviews, predatory journals

Be honest and precise. Score only what the document actually shows. Do not use emojis.`

const C5_PROMPT = `You are an EB-1A Evidence Verification Agent for Criterion 5: Original Contributions of Major Significance (8 CFR 204.5(h)(3)(v)).

You evaluate a single document against criterion C5. This is the HARDEST criterion (62% failure rate at AAO). Determine if the document provides evidence of original scientific, scholarly, artistic, athletic, or business-related contributions of major significance.

SIGNIFICANCE INDICATORS (count how many are evidenced):
1. Widespread adoption: 3+ independent orgs OR 100M+ end users
2. Commercial validation: $1M+ licensing revenue OR production deployment at scale
3. Research impact: 100+ citations AND growing >=20% YoY
4. Independent adoption: 2+ companies applicant NEVER worked for using the work
5. Expert validation: 3+ recommendation letters with specific "transformative" language + metrics
6. Field transformation: Changed standard practice field-wide

SCORING: >=4 indicators: Tier 1, 3: Tier 2, 2: Tier 3, 1: Tier 4, 0: Tier 5
indicators_met must equal count of true indicator booleans.

VERIFICATION CHECKLIST:
- Does the document show an ORIGINAL contribution (not routine work)?
- Is there evidence of MAJOR SIGNIFICANCE (not just incremental improvement)?
- Are there concrete metrics (adoption numbers, citations, revenue)?
- Is there independent validation of the contribution's impact?
- Does it show field-wide or industry-wide influence?

Be honest and precise. Score only what the document actually shows. Do not use emojis.`

const SYSTEM_PROMPTS: Record<string, string> = {
  C1: C1_PROMPT,
  C2: C2_PROMPT,
  C3: C3_PROMPT,
  C4: C4_PROMPT,
  C5: C5_PROMPT,
}

const SCHEMAS: Record<string, typeof C1VerificationSchema> = {
  C1: C1VerificationSchema,
  C2: C2VerificationSchema,
  C3: C3VerificationSchema,
  C4: C4VerificationSchema,
  C5: C5VerificationSchema,
}

// ─── Context Builder ───

export async function buildVerificationContext(caseId: string) {
  return buildEvaluationContext(caseId)
}

// ─── Individual Criterion Verification ───

async function verifyCriterion(
  criterion: string,
  documentText: string,
  context: string,
) {
  const schema = SCHEMAS[criterion]
  const systemPrompt = SYSTEM_PROMPTS[criterion]
  if (!schema || !systemPrompt) throw new Error(`Unknown criterion: ${criterion}`)

  const { object } = await generateObject({
    model: anthropic(MODEL),
    schema,
    system: systemPrompt,
    prompt: `=== CASE CONTEXT ===\n${context}\n\n=== DOCUMENT TO VERIFY ===\n${documentText}`,
  })

  return object
}

// ─── Run All 5 Criteria for a Document ───

export interface DocumentVerificationResults {
  documentId: string
  results: Record<string, { success: boolean; data?: unknown; error?: string }>
}

export async function runDocumentVerification(
  caseId: string,
  documentId: string,
  documentText: string,
  onCriterionComplete?: (criterion: string, result: unknown) => void,
): Promise<DocumentVerificationResults> {
  const context = await buildVerificationContext(caseId)
  const criteria = ["C1", "C2", "C3", "C4", "C5"]

  // Get next version
  const latest = await db.evidenceVerification.findFirst({
    where: { documentId },
    orderBy: { version: "desc" },
    select: { version: true },
  })
  const version = (latest?.version ?? 0) + 1

  const results: Record<string, { success: boolean; data?: unknown; error?: string }> = {}

  const settled = await Promise.allSettled(
    criteria.map(async (criterion) => {
      const data = await verifyCriterion(criterion, documentText, context)

      // Save to DB
      await db.evidenceVerification.create({
        data: {
          caseId,
          documentId,
          criterion,
          version,
          data: JSON.parse(JSON.stringify(data)),
          score: (data as { score: number }).score,
          recommendation: (data as { recommendation: string }).recommendation,
        },
      })

      results[criterion] = { success: true, data }
      onCriterionComplete?.(criterion, data)
      return { criterion, data }
    }),
  )

  for (const result of settled) {
    if (result.status === "rejected") {
      // Find which criterion failed
      const idx = settled.indexOf(result)
      const criterion = criteria[idx]
      results[criterion] = {
        success: false,
        error: result.reason instanceof Error ? result.reason.message : "Verification failed",
      }
    }
  }

  return { documentId, results }
}
