import { generateObject } from "ai"
import { getPrompt, resolveModel } from "./agent-prompt"
import { CRITERION_SCHEMAS } from "./criterion-extraction-schemas"
import { ensureItemIds } from "./extraction-item-id"
import {
  CRITERIA_METADATA,
  type DetailedExtraction,
  type CriteriaSummaryItem,
  type CriterionId,
} from "./eb1a-extraction-schema"

// ─── Slug map ───

const ANALYSIS_SLUGS: Record<string, string> = {
  C1: "ax-c1-awards",
  C2: "ax-c2-memberships",
  C3: "ax-c3-published-material",
  C4: "ax-c4-judging",
  C5: "ax-c5-contributions",
  C6: "ax-c6-scholarly-articles",
  C7: "ax-c7-exhibitions",
  C8: "ax-c8-leading-role",
  C9: "ax-c9-high-salary",
  C10: "ax-c10-commercial-success",
}

const ALL_CRITERIA = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10"] as const

// ─── Evidence array keys per criterion ───

const CRITERION_ARRAY_KEYS: Record<string, string[]> = {
  C1: ["awards"],
  C2: ["memberships"],
  C3: ["media_coverage"],
  C4: ["judging_activities"],
  C5: ["original_contributions", "patents", "grants"],
  C6: ["publications"],
  C7: ["exhibitions"],
  C8: ["leadership_roles"],
  C9: ["compensation"],
  C10: ["commercial_success"],
}

// ─── Single criterion extraction ───

export async function extractCriterion(
  criterion: string,
  resumeText: string,
  surveyContext: string,
): Promise<{ criterion: string; data: Record<string, unknown> }> {
  const slug = ANALYSIS_SLUGS[criterion]
  const schema = CRITERION_SCHEMAS[criterion]
  if (!slug || !schema) throw new Error(`Unknown criterion: ${criterion}`)

  const row = await getPrompt(slug)
  if (!row) throw new Error(`DB prompt not found or deactivated: ${slug}`)

  const { object } = await generateObject({
    model: resolveModel(row.provider, row.modelName),
    schema,
    system: row.content,
    prompt: `Extract and evaluate this resume for criterion ${criterion}:\n\n${resumeText}${surveyContext}`,
    ...(row.temperature != null && { temperature: row.temperature }),
    ...(row.maxTokens != null && { maxTokens: row.maxTokens }),
  })

  return { criterion, data: object as Record<string, unknown> }
}

// ─── Assemble results into DetailedExtraction ───

export function assembleExtraction(
  results: Array<{ criterion: string; data: Record<string, unknown> }>,
): DetailedExtraction {
  const assembled: DetailedExtraction = {
    publications: [],
    awards: [],
    patents: [],
    memberships: [],
    media_coverage: [],
    judging_activities: [],
    speaking_engagements: [],
    grants: [],
    leadership_roles: [],
    compensation: [],
    exhibitions: [],
    commercial_success: [],
    original_contributions: [],
    criteria_summary: [],
    education: [],
    work_experience: [],
  }

  const seenIds = new Set<string>()

  for (const { criterion, data } of results) {
    // Merge evidence arrays
    const keys = CRITERION_ARRAY_KEYS[criterion] ?? []
    for (const key of keys) {
      const items = data[key] as Record<string, unknown>[] | undefined
      if (!items?.length) continue

      const target = assembled[key as keyof DetailedExtraction] as Record<string, unknown>[]
      for (const item of items) {
        // Dedup by ID if present
        const id = item.id as string | undefined
        if (id && seenIds.has(id)) {
          // Union mapped_criteria
          const existing = target.find((t) => t.id === id)
          if (existing) {
            const existingCriteria = (existing.mapped_criteria ?? []) as string[]
            const newCriteria = (item.mapped_criteria ?? []) as string[]
            existing.mapped_criteria = [...new Set([...existingCriteria, ...newCriteria])]
          }
          continue
        }
        if (id) seenIds.add(id)
        target.push(item)
      }
    }

    // Collect criteria_summary
    const summary = data.criteria_summary as CriteriaSummaryItem | undefined
    if (summary) {
      assembled.criteria_summary.push(summary)
    }
  }

  // Fill missing criteria summaries with None
  const coveredCriteria = new Set(assembled.criteria_summary.map((s) => s.criterion_id))
  for (const cId of ALL_CRITERIA) {
    if (!coveredCriteria.has(cId)) {
      const meta = CRITERIA_METADATA[cId as CriterionId]
      assembled.criteria_summary.push({
        criterion_id: cId,
        evidence_count: 0,
        strength: "None",
        summary: `No evidence found for ${meta.name.toLowerCase()}`,
        key_evidence: [],
      })
    }
  }

  // Assign IDs to items missing them
  ensureItemIds(assembled)

  return assembled
}

// ─── Multipass extraction (10 parallel calls) ───

export async function multipassExtract(
  resumeText: string,
  surveyData?: Record<string, unknown>,
  onCriterionComplete?: (criterion: string, partialAssembly: DetailedExtraction) => void,
): Promise<DetailedExtraction> {
  const surveyContext = surveyData
    ? `\n\nADDITIONAL CONTEXT FROM USER SURVEY:\n${JSON.stringify(surveyData, null, 2)}`
    : ""

  const completedResults: Array<{ criterion: string; data: Record<string, unknown> }> = []

  const settled = await Promise.allSettled(
    ALL_CRITERIA.map(async (criterion) => {
      const result = await extractCriterion(criterion, resumeText, surveyContext)
      completedResults.push(result)

      if (onCriterionComplete) {
        const partial = assembleExtraction([...completedResults])
        onCriterionComplete(criterion, partial)
      }

      return result
    }),
  )

  // Collect successful results
  const successResults: Array<{ criterion: string; data: Record<string, unknown> }> = []
  for (const result of settled) {
    if (result.status === "fulfilled") {
      successResults.push(result.value)
    } else {
      console.error("Criterion extraction failed:", result.reason)
    }
  }

  return assembleExtraction(successResults)
}
