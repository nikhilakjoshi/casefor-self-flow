import { streamObject } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { db } from "./db"
import { buildCaseStrategyContext } from "./case-strategy"
import { CaseConsolidationSchema } from "./case-consolidation-schema"
import { getPrompt, resolveModel } from "./agent-prompt"

const FALLBACK_MODEL = "claude-sonnet-4-5-20250929"

const FALLBACK_PROMPT = `You are the EB-1A Case Consolidation & Prioritization Agent. Consolidate all upstream pipeline outputs into a master case profile JSON. Do not use emojis in any output.

You receive 5 input sections: candidate profile, criteria evaluation, gap analysis, case strategy, and evidence verification results.

Your job is to CONSOLIDATE, RANK, PRIORITIZE, and STRUCTURE the complete case into a petition-ready format. Return ONLY a valid JSON object matching the schema provided.`

export async function buildCaseConsolidationContext(caseId: string) {
  const baseContext = await buildCaseStrategyContext(caseId)

  const caseStrategy = await db.caseStrategy.findFirst({
    where: { caseId },
    orderBy: { createdAt: "desc" },
  })

  if (!caseStrategy) {
    throw new Error("Case strategy required before running consolidation")
  }

  // Fetch all evidence verifications grouped by criterion, with document names
  const verifications = await db.evidenceVerification.findMany({
    where: { caseId },
    include: { document: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  })

  const verificationsByCriterion: Record<string, Array<{ documentName: string; data: unknown; score: number; recommendation: string }>> = {}
  for (const v of verifications) {
    if (!verificationsByCriterion[v.criterion]) {
      verificationsByCriterion[v.criterion] = []
    }
    verificationsByCriterion[v.criterion].push({
      documentName: v.document.name,
      data: v.data,
      score: v.score,
      recommendation: v.recommendation,
    })
  }

  return `${baseContext}

=== CASE STRATEGY ===
${JSON.stringify(caseStrategy.data, null, 2)}

=== EVIDENCE VERIFICATION RESULTS ===
${JSON.stringify(verificationsByCriterion, null, 2)}`
}

export async function streamCaseConsolidation(caseId: string) {
  const context = await buildCaseConsolidationContext(caseId)
  const p = await getPrompt("case-consolidation")

  return streamObject({
    model: p ? resolveModel(p.provider, p.modelName) : anthropic(FALLBACK_MODEL),
    schema: CaseConsolidationSchema,
    system: p?.content ?? FALLBACK_PROMPT,
    prompt: `Consolidate all upstream pipeline outputs into a master case profile based on the following data:\n\n${context}`,
    providerOptions: {
      anthropic: { structuredOutputMode: 'jsonTool' },
    },
  })
}
