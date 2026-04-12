import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getCriteriaForCase } from "@/lib/criteria"

/**
 * GET /api/case/[caseId]/tracker
 *
 * Returns a unified tracker view:
 * 1. Evidence coverage matrix — criteria x documents
 * 2. Document status table — all docs with classification + criteria mapping
 * 3. Gap cross-reference — criteria with weak/no evidence + what's missing
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { caseId } = await params
  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
    select: { userId: true, applicationTypeId: true },
  })
  if (!caseRecord || caseRecord.userId !== session.user.id) {
    return new Response("Not found", { status: 404 })
  }

  const [criteria, documents, routings, latestAnalysis, gapAnalysis] =
    await Promise.all([
      getCriteriaForCase(caseId),
      db.document.findMany({
        where: { caseId },
        select: {
          id: true,
          name: true,
          type: true,
          category: true,
          status: true,
          source: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      db.documentCriterionRouting.findMany({
        where: { document: { caseId } },
        select: {
          documentId: true,
          criterion: true,
          score: true,
          recommendation: true,
          autoRouted: true,
        },
      }),
      db.caseAnalysis.findFirst({
        where: { caseId },
        orderBy: { createdAt: "desc" },
        select: { criteria: true },
      }),
      db.gapAnalysis.findFirst({
        where: { caseId },
        orderBy: { createdAt: "desc" },
        select: { data: true },
      }),
    ])

  // ---- 1. Evidence coverage matrix ----
  // For each criterion, which documents support it and with what score
  const coverageMatrix: Array<{
    criterionKey: string
    criterionName: string
    strength: string
    docs: Array<{
      documentId: string
      documentName: string
      score: number
      recommendation: string
    }>
    docCount: number
  }> = []

  // Build analysis criteria lookup for strength
  const analysisCriteria = (latestAnalysis?.criteria ?? []) as Array<{
    criterionId: string
    strength: string
  }>
  const strengthMap: Record<string, string> = {}
  for (const c of analysisCriteria) {
    strengthMap[c.criterionId] = c.strength
  }

  // Build routing lookup: criterion → docs
  const routingByCriterion: Record<
    string,
    Array<{ documentId: string; score: number; recommendation: string }>
  > = {}
  for (const r of routings) {
    if (!routingByCriterion[r.criterion])
      routingByCriterion[r.criterion] = []
    routingByCriterion[r.criterion].push({
      documentId: r.documentId,
      score: r.score,
      recommendation: r.recommendation,
    })
  }

  const docMap = new Map(documents.map((d) => [d.id, d]))

  for (const c of criteria) {
    const routedDocs = routingByCriterion[c.key] ?? []
    coverageMatrix.push({
      criterionKey: c.key,
      criterionName: c.name,
      strength: strengthMap[c.key] ?? "None",
      docs: routedDocs.map((r) => ({
        documentId: r.documentId,
        documentName: docMap.get(r.documentId)?.name ?? "Unknown",
        score: r.score,
        recommendation: r.recommendation,
      })),
      docCount: routedDocs.length,
    })
  }

  // ---- 2. Document status table ----
  const routingByDoc: Record<string, string[]> = {}
  for (const r of routings) {
    if (!routingByDoc[r.documentId]) routingByDoc[r.documentId] = []
    routingByDoc[r.documentId].push(r.criterion)
  }

  const documentTable = documents.map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    category: d.category,
    status: d.status,
    source: d.source,
    criteriaSupported: routingByDoc[d.id] ?? [],
    criteriaCount: (routingByDoc[d.id] ?? []).length,
    createdAt: d.createdAt.toISOString(),
  }))

  // ---- 3. Gap cross-reference ----
  const gapData = gapAnalysis?.data as {
    gap_analysis?: {
      critical_gaps?: Array<{
        priority?: string
        criterion?: string
        issue?: string
        current_state?: string
        required_state?: string
        timeline?: string
        actions?: Array<{ action?: string }>
      }>
    }
  } | null

  const gaps = (gapData?.gap_analysis?.critical_gaps ?? []).map((g) => {
    const criterionKey = g.criterion ?? ""
    const matchingCriterion = criteria.find((c) => c.key === criterionKey || c.name.toLowerCase().includes((criterionKey ?? "").toLowerCase()))
    const docsForCriterion = routingByCriterion[matchingCriterion?.key ?? criterionKey] ?? []

    return {
      priority: g.priority ?? "MEDIUM",
      criterion: criterionKey,
      criterionName: matchingCriterion?.name ?? criterionKey,
      issue: g.issue ?? "",
      currentState: g.current_state ?? "",
      requiredState: g.required_state ?? "",
      timeline: g.timeline ?? "",
      existingDocs: docsForCriterion.length,
      actions: (g.actions ?? []).map((a) => a.action ?? "").filter(Boolean),
    }
  })

  // ---- Summary stats ----
  const totalCriteria = criteria.length
  const coveredCriteria = coverageMatrix.filter((c) => c.docCount > 0).length
  const strongCriteria = coverageMatrix.filter(
    (c) => c.strength === "Strong",
  ).length
  const totalDocs = documents.length
  const routedDocs = new Set(routings.map((r) => r.documentId)).size
  const highPriorityGaps = gaps.filter((g) => g.priority === "HIGH").length

  return NextResponse.json({
    summary: {
      totalCriteria,
      coveredCriteria,
      strongCriteria,
      totalDocs,
      routedDocs,
      unroutedDocs: totalDocs - routedDocs,
      totalGaps: gaps.length,
      highPriorityGaps,
    },
    coverageMatrix,
    documentTable,
    gaps,
  })
}
