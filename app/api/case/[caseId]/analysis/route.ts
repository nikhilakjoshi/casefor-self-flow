import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import type { DetailedExtraction } from "@/lib/eb1a-extraction-schema"
import { ensureItemIds } from "@/lib/extraction-item-id"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { caseId } = await params

  // Verify user owns this case
  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
  })

  if (!caseRecord || caseRecord.userId !== session.user.id) {
    return new Response("Not found", { status: 404 })
  }

  const analysis = await db.eB1AAnalysis.findFirst({
    where: { caseId },
    orderBy: { createdAt: "desc" },
  })

  if (!analysis) {
    return NextResponse.json(null)
  }

  // Build criterionKey -> name map from DB
  const criteriaNames: Record<string, string> = {}
  if (caseRecord.applicationTypeId) {
    const mappings = await db.criteriaMapping.findMany({
      where: { applicationTypeId: caseRecord.applicationTypeId, active: true },
      select: { criterionKey: true, name: true },
    })
    for (const m of mappings) criteriaNames[m.criterionKey] = m.name
  }

  // Count evidence documents routed to each criterion
  const docRoutings = await db.documentCriterionRouting.groupBy({
    by: ["criterion"],
    where: { document: { caseId } },
    _count: { criterion: true },
  })
  const docCountsByCriterion: Record<string, number> = {}
  for (const r of docRoutings) {
    docCountsByCriterion[r.criterion] = r._count.criterion
  }

  // Extract criteria_summary from the full extraction if available
  const extraction = analysis.extraction as DetailedExtraction | null

  // Lazy backfill: assign item IDs if missing
  if (extraction && ensureItemIds(extraction)) {
    await db.eB1AAnalysis.update({
      where: { id: analysis.id },
      data: { extraction: JSON.parse(JSON.stringify(extraction)) },
    })
  }

  const criteriaSummary = extraction?.criteria_summary ?? []

  // Count docs per item via matchedItemIds
  const routingsWithItems = await db.documentCriterionRouting.findMany({
    where: { document: { caseId }, matchedItemIds: { isEmpty: false } },
    select: { matchedItemIds: true },
  })
  const docCountsByItem: Record<string, number> = {}
  for (const r of routingsWithItems) {
    for (const itemId of r.matchedItemIds) {
      docCountsByItem[itemId] = (docCountsByItem[itemId] ?? 0) + 1
    }
  }

  return NextResponse.json({
    id: analysis.id,
    criteria: analysis.criteria,
    extraction: extraction,
    criteria_summary: criteriaSummary,
    strongCount: analysis.strongCount,
    weakCount: analysis.weakCount,
    createdAt: analysis.createdAt,
    version: analysis.version,
    mergedWithSurvey: analysis.mergedWithSurvey,
    surveyVersion: analysis.surveyVersion,
    criteriaNames,
    criteriaThreshold: caseRecord.criteriaThreshold ?? 3,
    docCountsByCriterion,
    docCountsByItem,
  })
}
