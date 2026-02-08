import {
  type DetailedExtraction,
  type Award,
  type CriteriaSummaryItem,
  type CriterionId,
  CRITERIA_METADATA,
} from "./eb1a-extraction-schema"
import type { SurveyData } from "@/app/onboard/_lib/survey-schema"

// Similarity threshold for fuzzy matching (0-1)
const SIMILARITY_THRESHOLD = 0.7

// Simple Levenshtein-based similarity
function similarity(a: string, b: string): number {
  const aLower = a.toLowerCase().trim()
  const bLower = b.toLowerCase().trim()
  if (aLower === bLower) return 1

  const len = Math.max(aLower.length, bLower.length)
  if (len === 0) return 1

  const distance = levenshtein(aLower, bLower)
  return 1 - distance / len
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + 1)
      }
    }
  }

  return dp[m][n]
}

// Check if two awards are similar (fuzzy match by name)
function awardsSimilar(a: Award, b: Award): boolean {
  return similarity(a.name, b.name) >= SIMILARITY_THRESHOLD
}

// Map survey scope string to extraction scope enum
function mapScope(scope?: string): "international" | "national" | "regional" | "local" | "unknown" {
  if (!scope) return "unknown"
  const lower = scope.toLowerCase()
  if (lower.includes("international") || lower.includes("global")) return "international"
  if (lower.includes("national") || lower.includes("country")) return "national"
  if (lower.includes("regional") || lower.includes("state")) return "regional"
  if (lower.includes("local") || lower.includes("city")) return "local"
  return "unknown"
}

// Convert survey awards to extraction format
function surveyAwardsToExtraction(
  surveyAwards: SurveyData["awards"]
): Award[] {
  if (!surveyAwards?.awards) return []

  return surveyAwards.awards.map((a) => ({
    name: a.name,
    issuer: a.issuer,
    year: a.year ?? undefined,
    scope: mapScope(a.scope),
    description: a.criteria,
    mapped_criteria: ["C1"] as CriterionId[],
    source: "survey" as const,
  }))
}

// Merge arrays with deduplication
function mergeAwards(extracted: Award[], survey: Award[]): Award[] {
  const result: Award[] = []

  // Add all extracted awards, mark source
  for (const item of extracted) {
    result.push({ ...item, source: item.source ?? "extracted" })
  }

  // Add survey awards, checking for duplicates
  for (const surveyItem of survey) {
    const match = result.find((r) => awardsSimilar(r, surveyItem))
    if (match) {
      // Merge - prefer survey data (user-verified), keep extracted data for unfilled fields
      Object.assign(match, {
        ...match,
        ...surveyItem,
        source: "survey" as const,
        // Prefer survey scope if provided
        scope: surveyItem.scope !== "unknown" ? surveyItem.scope : match.scope,
      })
    } else {
      result.push(surveyItem)
    }
  }

  return result
}

// Recalculate criteria summary based on merged data
function recalculateCriteriaSummary(extraction: DetailedExtraction): CriteriaSummaryItem[] {
  const criteriaMap: Record<CriterionId, { items: string[]; strength: "Strong" | "Weak" | "None" }> = {
    C1: { items: [], strength: "None" },
    C2: { items: [], strength: "None" },
    C3: { items: [], strength: "None" },
    C4: { items: [], strength: "None" },
    C5: { items: [], strength: "None" },
    C6: { items: [], strength: "None" },
    C7: { items: [], strength: "None" },
    C8: { items: [], strength: "None" },
    C9: { items: [], strength: "None" },
    C10: { items: [], strength: "None" },
  }

  // Aggregate evidence from all categories
  const addEvidence = (items: Array<{ mapped_criteria: CriterionId[] }>, descFn: (item: unknown) => string) => {
    for (const item of items) {
      for (const crit of item.mapped_criteria) {
        criteriaMap[crit].items.push(descFn(item))
      }
    }
  }

  addEvidence(extraction.awards, (a) => (a as Award).name)
  addEvidence(extraction.publications, (p) => (p as { title: string }).title)
  addEvidence(extraction.patents, (p) => (p as { title: string }).title)
  addEvidence(extraction.memberships, (m) => (m as { organization: string }).organization)
  addEvidence(extraction.media_coverage, (m) => (m as { outlet: string }).outlet)
  addEvidence(extraction.judging_activities, (j) => (j as { type: string }).type)
  addEvidence(extraction.speaking_engagements, (s) => (s as { event: string }).event)
  addEvidence(extraction.grants, (g) => (g as { title: string }).title)
  addEvidence(extraction.leadership_roles, (l) => `${(l as { title: string }).title} at ${(l as { organization: string }).organization}`)
  addEvidence(extraction.compensation, (c) => (c as { context?: string }).context ?? "Compensation data")
  addEvidence(extraction.exhibitions, (e) => (e as { venue: string }).venue)
  addEvidence(extraction.commercial_success, (c) => (c as { description: string }).description)
  addEvidence(extraction.original_contributions, (o) => (o as { description: string }).description)

  // Determine strength based on evidence count
  for (const [crit, data] of Object.entries(criteriaMap) as [CriterionId, typeof criteriaMap.C1][]) {
    const count = data.items.length
    if (count >= 3) {
      data.strength = "Strong"
    } else if (count >= 1) {
      data.strength = "Weak"
    }
  }

  // Build summary
  return (Object.entries(criteriaMap) as [CriterionId, typeof criteriaMap.C1][]).map(([crit, data]) => {
    const meta = CRITERIA_METADATA[crit]
    return {
      criterion_id: crit,
      evidence_count: data.items.length,
      strength: data.strength,
      summary:
        data.strength === "None"
          ? `No evidence found for ${meta.name.toLowerCase()}`
          : `${data.items.length} piece(s) of evidence for ${meta.name.toLowerCase()}`,
      key_evidence: data.items.slice(0, 5), // Top 5
    }
  })
}

export function mergeExtractionWithSurvey(
  extraction: DetailedExtraction,
  surveyData: SurveyData
): DetailedExtraction {
  const merged: DetailedExtraction = { ...extraction }

  // Merge personal info - survey overrides
  if (surveyData.background) {
    merged.personal_info = {
      ...extraction.personal_info,
      name: surveyData.background.fullName || extraction.personal_info?.name,
      current_title: surveyData.background.currentTitle || extraction.personal_info?.current_title,
      current_organization: surveyData.background.currentEmployer || extraction.personal_info?.current_organization,
      field: surveyData.background.areaOfExpertise || extraction.personal_info?.field,
      years_experience: surveyData.background.yearsExperience ?? extraction.personal_info?.years_experience,
      source: "survey",
    }

    // Merge education
    if (surveyData.background.education && surveyData.background.education.length > 0) {
      merged.education = surveyData.background.education.map((e) => ({
        degree: e.degree,
        field: e.field ?? undefined,
        institution: e.institution,
        year: e.year ?? undefined,
        source: "survey" as const,
      }))
    }
  }

  // Merge awards
  if (surveyData.awards) {
    const surveyAwards = surveyAwardsToExtraction(surveyData.awards)
    merged.awards = mergeAwards(extraction.awards, surveyAwards)
  }

  // Note: For other categories, survey provides text descriptions rather than structured data
  // These can be used to enhance AI analysis but don't directly merge into structured fields
  // The survey data is already passed to the AI during initial extraction

  // Recalculate criteria summary
  merged.criteria_summary = recalculateCriteriaSummary(merged)

  return merged
}

// Convenience: check if extraction needs survey merge
export function needsSurveyMerge(surveyData: SurveyData | null | undefined): boolean {
  if (!surveyData) return false
  return Object.keys(surveyData).length > 0
}
