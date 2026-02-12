import { streamText, Output } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { db } from "./db"
import { buildEvaluationContext } from "./strength-evaluation"
import {
  DenialProbabilityPass1Schema,
  DenialProbabilityPass2Schema,
} from "./denial-probability-schema"
import { getPrompt, resolveModel } from "./agent-prompt"
import { z } from "zod"

const FALLBACK_MODEL = "claude-sonnet-4-20250514"

// Pass 1 prompt: qualitative analysis only. Probability calculations happen in a separate pass.
const FALLBACK_PROMPT = `You are a Denial Probability Engine for an EB-1A (Extraordinary Ability) immigration visa platform. Do not use emojis in any output.

You receive THREE inputs concatenated together:
1. The parsed resume and case data (profile, documents, recommenders)
2. The Strength Evaluation JSON (tier scores, Kazarian analysis, criteria evaluations)
3. The Gap Analysis JSON (gaps, filing decision, evidence roadmap)

This pass produces QUALITATIVE ANALYSIS ONLY. Probability calculations happen in a separate pass.

Your job is to synthesize ALL available data into a detailed qualitative assessment: Kazarian analysis, field context, criterion risks, letter analysis, red flags, and strengths.

CRITICAL RULE -- EMPTY OR MINIMAL EVIDENCE:
- If 0 documents uploaded: note as critical red flag
- If 0 recommenders: note as critical red flag
- If no EB-1A analysis/extraction exists: note as critical red flag
- If <3 criteria have ANY supporting evidence: note as critical red flag
- NEVER list strengths that don't exist in the data. An empty case has no strengths.

SECTION 1: KAZARIAN ANALYSIS

Analyze both steps:
Step 1: How many criteria truly meet the evidentiary standard? Is the 3-criterion threshold met with high confidence?
Step 2: Does the totality of evidence demonstrate sustained national/international acclaim? Assess sustained acclaim strength, top-of-field positioning, geographic scope, and timeline coverage.

Risk score (0-100): 0 = no risk, 100 = certain denial at this step.

SECTION 2: FIELD CONTEXT

Compare this applicant to typical successful applicants in their field:
- Use field-specific benchmarks (publications, citations, h-index, experience)
- Rate as ABOVE/AT/BELOW typical successful applicant
- Provide specific benchmark comparisons

SECTION 3: CRITERION RISK ASSESSMENTS

For each claimed criterion:
- Classify as PRIMARY (strong, relied upon), SECONDARY (supportive), or WEAK (risky to claim)
- Rate evidence_strength (0-100)
- Assess documentation_status: COMPLETE, PARTIAL, INSUFFICIENT
- Calculate rfe_risk (0-100) and denial_risk (0-100)
- List specific issues

SECTION 4: LETTER ANALYSIS

Analyze recommendation letter portfolio:
- Count total, independent, collaborative
- Calculate independent percentage (need >50% for strong case)
- Assess geographic diversity
- Rate portfolio_risk: LOW (strong diverse portfolio), MEDIUM (adequate), HIGH (weak/homogeneous)
- List specific issues

SECTION 5: RED FLAGS

Identify ALL red flags from the data. Categorize by severity:
- HIGH: Issues that significantly increase denial probability (Tier 5 evidence, <3 criteria, no C5 evidence)
- MEDIUM: Issues that may trigger RFE (documentation gaps, weak Step 2, limited geographic scope)
- LOW: Minor concerns (optimization opportunities, nice-to-have improvements)

SECTION 6: STRENGTHS

List genuine strengths supported by evidence in the data. Do not hallucinate strengths.

PRE-OUTPUT VALIDATION:
- All criterion_risk_assessments have valid 0-100 scores
- red_flags are ordered by severity (HIGH first)
- strengths are backed by actual evidence in the data`

// Pass 2 prompt: focused probability calculation from pass 1 output
const PASS2_SYSTEM_PROMPT = `You are a probability calculator for EB-1A denial risk. Do not use emojis in any output.

You receive a completed qualitative analysis plus evidence inventory.
Compute the probability breakdown, overall assessment, recommendations, and filing recommendation.

ALL PERCENTAGES ARE WHOLE INTEGERS:
  base_denial_rate: 30 (means 30%), NOT 0.30
  delta_pct: -8 (means minus 8 percentage points), NOT -0.08
  final_denial_probability: 22 (means 22%), NOT 0.22

CALCULATION:
- Start with field base denial rate (100 - approval rate from field_context.baseline_approval_rate)
- Apply adjustments: criteria satisfied, step 2 merits, C5 tier, red flags, letters, documentation gaps
- Clamp to 5-95
- denial_probability_pct MUST EQUAL final_denial_probability
- rfe_probability_pct: 1.5-2x denial, capped at 90
- risk_level: LOW <20, MEDIUM 20-40, HIGH 40-60, VERY_HIGH >60

EMPTY EVIDENCE RULES:
- 0 documents: denial >= 85
- 0 recommenders: +15
- No EB-1A analysis: denial >= 90
- <3 criteria with evidence: denial >= 70

FILING RECOMMENDATION:
- FILE_NOW: denial < 15%, strong across all dimensions
- FILE_WITH_CAUTION: denial 15-30%, some risks but manageable
- STRENGTHEN_FIRST: denial 30-50%, addressable gaps
- MAJOR_GAPS: denial 50-70%, significant work needed
- CONSIDER_ALTERNATIVE: denial > 70%, fundamental issues

RECOMMENDATIONS:
- Critical: must-do before filing
- High priority: should do before filing
- Moderate priority: would strengthen case

Show your math in probability_breakdown. Each adjustment has a factor name and delta_pct (positive = increases denial, negative = decreases).`

export async function buildDenialProbabilityContext(caseId: string) {
  const baseContext = await buildEvaluationContext(caseId)

  const [strengthEval, gapAnalysis, docCount, recCount, profile, eb1aAnalysis] = await Promise.all([
    db.strengthEvaluation.findFirst({
      where: { caseId },
      orderBy: { createdAt: "desc" },
    }),
    db.gapAnalysis.findFirst({
      where: { caseId },
      orderBy: { createdAt: "desc" },
    }),
    db.document.count({ where: { caseId } }),
    db.recommender.count({ where: { caseId } }),
    db.caseProfile.findUnique({ where: { caseId }, select: { data: true } }),
    db.eB1AAnalysis.findFirst({ where: { caseId }, select: { id: true } }),
  ])

  if (!strengthEval) {
    throw new Error("Strength evaluation required before running denial probability assessment")
  }
  if (!gapAnalysis) {
    throw new Error("Gap analysis required before running denial probability assessment")
  }

  const profileData = profile?.data as Record<string, unknown> | null
  const profileEmpty = !profileData || Object.keys(profileData).length === 0

  const inventory = `=== EVIDENCE INVENTORY ===
Documents: ${docCount}
Recommenders: ${recCount}
Profile: ${profileEmpty ? "empty" : "present"}
EB-1A Analysis: ${eb1aAnalysis ? "present" : "none"}`

  const context = `${inventory}\n\n${baseContext}\n\n=== STRENGTH EVALUATION ===\n${JSON.stringify(strengthEval.data, null, 2)}\n\n=== GAP ANALYSIS ===\n${JSON.stringify(gapAnalysis.data, null, 2)}`

  return { context, inventory }
}

export async function streamDenialProbabilityPass1(caseId: string) {
  const { context, inventory } = await buildDenialProbabilityContext(caseId)
  const p = await getPrompt("denial-probability")

  const stream = streamText({
    model: p ? resolveModel(p.provider, p.modelName) : anthropic(FALLBACK_MODEL),
    output: Output.object({ schema: DenialProbabilityPass1Schema }),
    system: p?.content ?? FALLBACK_PROMPT,
    prompt: `Perform a qualitative denial probability assessment on the following case data, strength evaluation, and gap analysis:\n\n${context}`,
  })

  return { stream, inventory }
}

export function streamDenialProbabilityPass2(
  pass1Output: z.infer<typeof DenialProbabilityPass1Schema>,
  evidenceInventory: string,
) {
  return streamText({
    model: anthropic(FALLBACK_MODEL),
    output: Output.object({ schema: DenialProbabilityPass2Schema }),
    system: PASS2_SYSTEM_PROMPT,
    prompt: `Compute probability breakdown, overall assessment, recommendations, and filing recommendation based on this completed qualitative analysis and evidence inventory.

${evidenceInventory}

=== QUALITATIVE ANALYSIS ===
${JSON.stringify(pass1Output, null, 2)}`,
  })
}
