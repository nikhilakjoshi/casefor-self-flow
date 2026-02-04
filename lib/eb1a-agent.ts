import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'
import { EB1A_CRITERIA, type EB1ACriterion } from './eb1a-criteria'

// Zod schema for individual criterion evaluation
export const CriterionResultSchema = z.object({
  criterionId: z.string().describe('ID of the criterion being evaluated'),
  strength: z
    .enum(['Strong', 'Weak', 'None'])
    .describe('Strength of evidence: Strong (clear evidence), Weak (some evidence), None (no evidence)'),
  reason: z.string().describe('Brief explanation of the evaluation'),
  evidence: z.array(z.string()).describe('Direct quotes from resume supporting this evaluation'),
})

// Zod schema for full EB-1A evaluation
export const EB1AEvaluationSchema = z.object({
  criteria: z.array(CriterionResultSchema).describe('Evaluation for each of the 10 EB-1A criteria'),
})

// Inferred types from schemas
export type CriterionResult = z.infer<typeof CriterionResultSchema>
export type EB1AEvaluation = z.infer<typeof EB1AEvaluationSchema>

const MODEL = 'gemini-2.0-flash'

function buildSystemPrompt(criteria: EB1ACriterion[]): string {
  const criteriaList = criteria
    .map((c) => `- ${c.id}: ${c.name} - ${c.description}`)
    .join('\n')

  return `You are an experienced immigration attorney specializing in EB-1A Extraordinary Ability visas.

Your task is to evaluate a resume/CV against the 10 EB-1A criteria. For each criterion, determine:
1. Strength: "Strong" (clear, compelling evidence), "Weak" (some evidence but needs strengthening), or "None" (no evidence found)
2. Reason: A brief explanation of your assessment
3. Evidence: Direct quotes from the resume that support your evaluation (empty array if None)

Be thorough but realistic. USCIS requires meeting at least 3 criteria with strong evidence.

THE 10 EB-1A CRITERIA:
${criteriaList}

IMPORTANT GUIDELINES:
- Only cite evidence that actually appears in the resume
- Be conservative - "Weak" if evidence is tangential or needs more documentation
- "None" is appropriate when a criterion simply doesn't apply to the candidate's background
- Provide specific quotes, not paraphrases`
}

export async function evaluateResume(resumeText: string): Promise<EB1AEvaluation> {
  const systemPrompt = buildSystemPrompt(EB1A_CRITERIA)

  const { object } = await generateObject({
    model: google(MODEL),
    schema: EB1AEvaluationSchema,
    system: systemPrompt,
    prompt: `Evaluate the following resume against all 10 EB-1A criteria:\n\n${resumeText}`,
  })

  return object
}

// Helper to count strong/weak criteria
export function countCriteriaStrengths(evaluation: EB1AEvaluation): {
  strong: number
  weak: number
  none: number
} {
  return evaluation.criteria.reduce(
    (acc, c) => {
      if (c.strength === 'Strong') acc.strong++
      else if (c.strength === 'Weak') acc.weak++
      else acc.none++
      return acc
    },
    { strong: 0, weak: 0, none: 0 }
  )
}
