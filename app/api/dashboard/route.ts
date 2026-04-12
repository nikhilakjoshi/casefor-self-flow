import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

/**
 * Aggregates every piece of data the dashboard renders in one round-trip.
 * Deliberately fetches everything server-side so the client just renders.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }
  const userId = session.user.id

  const cases = await db.case.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      caseAnalyses: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      denialProbabilities: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      gapAnalyses: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      documents: {
        select: { id: true, name: true, status: true, category: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      },
      recommenders: { select: { id: true } },
    },
  })

  // ---- stats ----
  let strongCriteriaTotal = 0
  let draftDocCount = 0
  let attentionCount = 0
  let packageReadyCount = 0

  for (const c of cases) {
    const latestAnalysis = c.caseAnalyses[0]
    if (latestAnalysis) strongCriteriaTotal += latestAnalysis.strongCount
    draftDocCount += c.documents.filter((d) => d.status === "DRAFT").length

    const needsIntake = c.intakeStatus === "PENDING"
    const denialPct = extractDenialPct(c.denialProbabilities[0]?.data)
    if (needsIntake || (denialPct !== null && denialPct > 50)) attentionCount++

    if (
      latestAnalysis &&
      latestAnalysis.strongCount >= (c.criteriaThreshold ?? 3) &&
      c.recommenders.length >= 3
    ) {
      packageReadyCount++
    }
  }

  const activeCases = cases.filter(
    (c) => c.status !== "CLOSED" && c.intakeStatus !== "SKIPPED",
  )

  const stats = {
    activeCases: activeCases.length,
    totalCases: cases.length,
    strongCriteria: strongCriteriaTotal,
    draftDocs: draftDocCount,
    needsAttention: attentionCount,
    packageReady: packageReadyCount,
  }

  // ---- cases table (5 most recently updated) ----
  const casesTable = activeCases.slice(0, 5).map((c) => {
    const latest = c.caseAnalyses[0]
    const denialPct = extractDenialPct(c.denialProbabilities[0]?.data)
    return {
      id: c.id,
      name: c.name ?? `Case ${c.id.slice(-6)}`,
      shortId: c.id.slice(-6).toUpperCase(),
      status: c.status,
      intakeStatus: c.intakeStatus,
      strongCount: latest?.strongCount ?? 0,
      weakCount: latest?.weakCount ?? 0,
      threshold: c.criteriaThreshold ?? 3,
      denialPct,
      updatedAt: c.updatedAt.toISOString(),
      createdAt: c.createdAt.toISOString(),
    }
  })

  // ---- upcoming milestones (from gap-analysis critical_gaps, top priority first) ----
  const milestones: Array<{
    caseId: string
    caseName: string
    priority: string
    issue: string
    criterion: string
    timeline: string
  }> = []
  for (const c of cases) {
    const gapData = c.gapAnalyses[0]?.data as
      | { gap_analysis?: { critical_gaps?: Array<Record<string, unknown>> } }
      | null
    const gaps = gapData?.gap_analysis?.critical_gaps ?? []
    for (const g of gaps.slice(0, 2)) {
      milestones.push({
        caseId: c.id,
        caseName: c.name ?? `Case ${c.id.slice(-6)}`,
        priority: String(g.priority ?? "MEDIUM"),
        issue: String(g.issue ?? ""),
        criterion: String(g.criterion ?? ""),
        timeline: String(g.timeline ?? "TBD"),
      })
    }
  }
  milestones.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority))
  const topMilestones = milestones.slice(0, 5)

  // ---- criteria coverage — aggregate strong/weak/none across all case analyses ----
  const criteriaCoverage: Record<string, { strong: number; weak: number; none: number }> = {}
  for (const c of cases) {
    const latest = c.caseAnalyses[0]
    if (!latest) continue
    const criteria = latest.criteria as Array<{ criterionId: string; strength: string }>
    for (const crit of criteria) {
      const key = crit.criterionId
      if (!criteriaCoverage[key]) criteriaCoverage[key] = { strong: 0, weak: 0, none: 0 }
      if (crit.strength === "Strong") criteriaCoverage[key].strong++
      else if (crit.strength === "Weak") criteriaCoverage[key].weak++
      else criteriaCoverage[key].none++
    }
  }

  // ---- action items — from gap-analysis immediate_actions + critical_gaps actions ----
  const actionItems: Array<{
    caseId: string
    caseName: string
    action: string
    detail: string
    priority: "HIGH" | "MEDIUM" | "LOW"
  }> = []
  for (const c of cases) {
    const gapData = c.gapAnalyses[0]?.data as
      | {
          gap_analysis?: {
            evidence_building_roadmap?: { immediate_actions?: { actions?: string[] } }
            critical_gaps?: Array<Record<string, unknown>>
          }
        }
      | null
    const immediate = gapData?.gap_analysis?.evidence_building_roadmap?.immediate_actions?.actions ?? []
    for (const a of immediate.slice(0, 2)) {
      actionItems.push({
        caseId: c.id,
        caseName: c.name ?? `Case ${c.id.slice(-6)}`,
        action: a,
        detail: "Immediate — evidence building",
        priority: "HIGH",
      })
    }
    const gaps = gapData?.gap_analysis?.critical_gaps ?? []
    for (const g of gaps.slice(0, 1)) {
      const actions = (g.actions as Array<{ action?: string }>) ?? []
      for (const a of actions.slice(0, 1)) {
        if (!a.action) continue
        actionItems.push({
          caseId: c.id,
          caseName: c.name ?? `Case ${c.id.slice(-6)}`,
          action: a.action,
          detail: `${String(g.criterion ?? "")} · ${String(g.priority ?? "")}`,
          priority: priorityToBucket(String(g.priority ?? "MEDIUM")),
        })
      }
    }
  }

  // ---- recent activity — use case updatedAt and document updatedAt as proxies ----
  type ActivityItem = {
    kind: "case" | "document"
    caseId: string
    caseName: string
    text: string
    timestamp: string
  }
  const activity: ActivityItem[] = []
  for (const c of cases) {
    activity.push({
      kind: "case",
      caseId: c.id,
      caseName: c.name ?? `Case ${c.id.slice(-6)}`,
      text: `Updated case`,
      timestamp: c.updatedAt.toISOString(),
    })
    for (const d of c.documents.slice(0, 2)) {
      activity.push({
        kind: "document",
        caseId: c.id,
        caseName: c.name ?? `Case ${c.id.slice(-6)}`,
        text: `${d.status === "DRAFT" ? "Drafted" : "Finalized"} ${d.name}`,
        timestamp: d.updatedAt.toISOString(),
      })
    }
  }
  activity.sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1))
  const recentActivity = activity.slice(0, 6)

  // ---- package readiness across the portfolio ----
  const totalCases = cases.length || 1
  let intakeCompleteCount = 0
  let analysisRunCount = 0
  let threeRecommenderCount = 0
  let packageAssembledCount = 0

  for (const c of cases) {
    if (c.intakeStatus === "COMPLETED") intakeCompleteCount++
    if (c.caseAnalyses.length > 0) analysisRunCount++
    if (c.recommenders.length >= 3) threeRecommenderCount++
    if (c.documents.some((d) => d.category && d.category.toString().startsWith("PETITION"))) {
      packageAssembledCount++
    }
  }

  const readiness = [
    { label: "Intake complete", value: intakeCompleteCount, total: cases.length, pct: pct(intakeCompleteCount, totalCases) },
    { label: "Analysis run", value: analysisRunCount, total: cases.length, pct: pct(analysisRunCount, totalCases) },
    { label: "≥3 recommenders", value: threeRecommenderCount, total: cases.length, pct: pct(threeRecommenderCount, totalCases) },
    { label: "Draft documents", value: draftDocCount, total: null, pct: null },
    { label: "Package-ready cases", value: packageReadyCount, total: cases.length, pct: pct(packageReadyCount, totalCases) },
  ]

  return NextResponse.json({
    stats,
    casesTable,
    topMilestones,
    criteriaCoverage,
    actionItems: actionItems.slice(0, 5),
    recentActivity,
    readiness,
  })
}

function pct(n: number, d: number): number {
  if (d === 0) return 0
  return Math.round((n / d) * 100)
}

function priorityRank(p: string): number {
  if (p === "HIGH") return 0
  if (p === "MEDIUM") return 1
  return 2
}

function priorityToBucket(p: string): "HIGH" | "MEDIUM" | "LOW" {
  if (p === "HIGH") return "HIGH"
  if (p === "LOW") return "LOW"
  return "MEDIUM"
}

function extractDenialPct(data: unknown): number | null {
  if (!data || typeof data !== "object") return null
  const d = data as { overall_assessment?: { denial_probability_pct?: number } }
  return d.overall_assessment?.denial_probability_pct ?? null
}
