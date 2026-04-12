import { generateObject } from "ai"
import { getPromptForType } from "./agent-prompt"
import { CRITERION_SCHEMAS, buildCriterionSchema } from "./criterion-extraction-schemas"
import { ensureItemIds } from "./extraction-item-id"
import { db } from "./db"
import { getCriteriaForCase, getCriteriaMetadata } from "./criteria"
import {
  CRITERIA_METADATA,
  type DetailedExtraction,
  type CriteriaSummaryItem,
} from "./eb1a-extraction-schema"

// ─── EB-1A hardcoded fallbacks ───

const EB1A_ANALYSIS_SLUGS: Record<string, string> = {
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

const EB1A_CRITERION_ARRAY_KEYS: Record<string, string[]> = {
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

// ─── Dynamic config resolution ───

async function getAnalysisSlug(
  criterionKey: string,
  applicationTypeId: string | null,
): Promise<string | null> {
  if (applicationTypeId) {
    const link = await db.criterionPromptLink.findUnique({
      where: {
        applicationTypeId_criterionKey_purpose: {
          applicationTypeId,
          criterionKey,
          purpose: "extraction",
        },
      },
    })
    if (link) return link.promptSlug
  }
  // EB-1A fallback
  return EB1A_ANALYSIS_SLUGS[criterionKey] ?? null
}

async function getEvidenceKeysForCriterion(
  criterionKey: string,
  applicationTypeId: string | null,
): Promise<string[]> {
  if (applicationTypeId) {
    const defs = await db.evidenceTypeDefinition.findMany({
      where: { applicationTypeId, active: true },
    })
    // Find evidence types whose defaultCriteria includes this criterion
    // defaultCriteria is stored on CriteriaMapping, but the mapping is via EvidenceTypeDefinition
    // For now: check if EvidenceTypeDefinition exists; if so, use schemaKeys
    if (defs.length > 0) {
      // Simple: return all evidence types for this application type
      // The extraction schema determines which arrays get populated for this criterion
      return defs.map((d) => d.schemaKey)
    }
  }
  // EB-1A fallback
  return EB1A_CRITERION_ARRAY_KEYS[criterionKey] ?? []
}

// ─── Single criterion extraction ───

export async function extractCriterion(
  criterion: string,
  resumeText: string,
  surveyContext: string,
  applicationTypeId?: string | null,
): Promise<{ criterion: string; data: Record<string, unknown> }> {
  const slug = await getAnalysisSlug(criterion, applicationTypeId ?? null)
  if (!slug) throw new Error(`No analysis slug for criterion: ${criterion}`)

  // Try dynamic schema from EvidenceTypeDefinition
  const evidenceKeys = await getEvidenceKeysForCriterion(criterion, applicationTypeId ?? null)
  const schema = evidenceKeys.length > 0
    ? buildCriterionSchema(evidenceKeys)
    : CRITERION_SCHEMAS[criterion]
  if (!schema) throw new Error(`No schema for criterion: ${criterion}`)

  const row = await getPromptForType(slug, applicationTypeId ?? null)
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
  criteriaKeys?: string[],
  criteriaMetadata?: Record<string, { name: string }>,
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
  // Collect all evidence array keys from results
  const allEvidenceKeys = new Set<string>()

  for (const { criterion, data } of results) {
    // Merge all evidence arrays found in data (dynamic — not restricted to hardcoded keys)
    for (const [key, value] of Object.entries(data)) {
      if (key === "criteria_summary") continue
      if (!Array.isArray(value)) continue
      allEvidenceKeys.add(key)

      const target = assembled[key as keyof DetailedExtraction] as Record<string, unknown>[] | undefined
      if (!target) continue // skip keys not in DetailedExtraction shape

      for (const item of value as Record<string, unknown>[]) {
        const id = item.id as string | undefined
        if (id && seenIds.has(id)) {
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
  const allCriteria = criteriaKeys ?? Object.keys(CRITERIA_METADATA)
  const metaLookup = criteriaMetadata ?? CRITERIA_METADATA

  for (const cId of allCriteria) {
    if (!coveredCriteria.has(cId)) {
      const meta = metaLookup[cId]
      assembled.criteria_summary.push({
        criterion_id: cId,
        evidence_count: 0,
        strength: "None",
        summary: `No evidence found for ${meta?.name?.toLowerCase() ?? cId}`,
        key_evidence: [],
      })
    }
  }

  ensureItemIds(assembled)
  return assembled
}

// ─── Multipass extraction (N parallel calls) ───

export async function multipassExtract(
  resumeText: string,
  options?: {
    applicationTypeId?: string | null
    caseId?: string
    surveyData?: Record<string, unknown>
    onCriterionComplete?: (criterion: string, partialAssembly: DetailedExtraction) => void
  },
): Promise<DetailedExtraction> {
  const { applicationTypeId, caseId, surveyData, onCriterionComplete } = options ?? {}

  // Resolve criteria list dynamically
  let criteriaKeys: string[]
  let criteriaMeta: Record<string, { name: string }>

  if (caseId) {
    const criteria = await getCriteriaForCase(caseId)
    criteriaKeys = criteria.map((c) => c.key)
    criteriaMeta = Object.fromEntries(criteria.map((c) => [c.key, { name: c.name }]))
  } else if (applicationTypeId) {
    const meta = await getCriteriaMetadata(applicationTypeId)
    criteriaKeys = Object.keys(meta)
    criteriaMeta = meta
  } else {
    // EB-1A fallback
    criteriaKeys = Object.keys(CRITERIA_METADATA)
    criteriaMeta = CRITERIA_METADATA
  }

  const surveyContext = surveyData
    ? `\n\nADDITIONAL CONTEXT FROM USER SURVEY:\n${JSON.stringify(surveyData, null, 2)}`
    : ""

  const completedResults: Array<{ criterion: string; data: Record<string, unknown> }> = []

  const settled = await Promise.allSettled(
    criteriaKeys.map(async (criterion) => {
      const result = await extractCriterion(criterion, resumeText, surveyContext, applicationTypeId)
      completedResults.push(result)

      if (onCriterionComplete) {
        const partial = assembleExtraction([...completedResults], criteriaKeys, criteriaMeta)
        onCriterionComplete(criterion, partial)
      }

      return result
    }),
  )

  const successResults: Array<{ criterion: string; data: Record<string, unknown> }> = []
  for (const result of settled) {
    if (result.status === "fulfilled") {
      successResults.push(result.value)
    } else {
      console.error("Criterion extraction failed:", result.reason)
    }
  }

  return assembleExtraction(successResults, criteriaKeys, criteriaMeta)
}

// Re-export for callers that import resolveModel from here (legacy)
import { resolveModel } from "./agent-prompt"
export { resolveModel }
