import { db } from "./db"

export const ROUTING_THRESHOLD = 5.0
export const ROUTABLE_RECOMMENDATIONS = ["STRONG", "INCLUDE_WITH_SUPPORT"]

export async function autoRouteDocument(caseId: string, documentId: string): Promise<void> {
  console.log(`[criteria-routing] autoRouteDocument called — caseId=${caseId} documentId=${documentId}`)

  // Get latest-version EvidenceVerification records for this document
  const verifications = await db.evidenceVerification.findMany({
    where: { caseId, documentId },
    orderBy: { version: "desc" },
  })
  console.log(`[criteria-routing] found ${verifications.length} verification records`)

  // Keep only latest version per criterion
  const latest = new Map<string, { criterion: string; score: number; recommendation: string; matchedItemIds: string[] }>()
  for (const v of verifications) {
    if (!latest.has(v.criterion)) {
      const data = v.data as Record<string, unknown> | null
      const matchedItemIds = Array.isArray(data?.matched_item_ids) ? (data.matched_item_ids as string[]) : []
      latest.set(v.criterion, { criterion: v.criterion, score: v.score, recommendation: v.recommendation, matchedItemIds })
    }
  }
  console.log(`[criteria-routing] latest per criterion:`, [...latest.values()].map((v) => `${v.criterion}=${v.score}/${v.recommendation}`).join(", "))

  // Filter to passing criteria
  const passing = [...latest.values()].filter(
    (v) => v.score >= ROUTING_THRESHOLD && ROUTABLE_RECOMMENDATIONS.includes(v.recommendation)
  )
  const passingCriteria = new Set(passing.map((p) => p.criterion))
  console.log(`[criteria-routing] passing threshold (>=${ROUTING_THRESHOLD} + ${ROUTABLE_RECOMMENDATIONS.join("|")}): ${passing.length > 0 ? [...passingCriteria].join(", ") : "none"}`)

  // Delete auto-routed records that no longer pass
  const deleted = await db.documentCriterionRouting.deleteMany({
    where: {
      documentId,
      autoRouted: true,
      criterion: { notIn: [...passingCriteria] },
    },
  })
  if (deleted.count > 0) {
    console.log(`[criteria-routing] removed ${deleted.count} stale auto-routed record(s)`)
  }

  // Upsert passing criteria
  for (const p of passing) {
    const result = await db.documentCriterionRouting.upsert({
      where: { documentId_criterion: { documentId, criterion: p.criterion } },
      create: {
        documentId,
        criterion: p.criterion,
        score: p.score,
        recommendation: p.recommendation,
        autoRouted: true,
        matchedItemIds: p.matchedItemIds,
      },
      update: {
        score: p.score,
        recommendation: p.recommendation,
        matchedItemIds: p.matchedItemIds,
      },
    })
    console.log(`[criteria-routing] upserted ${p.criterion} — score=${p.score} rec=${p.recommendation} id=${result.id}`)
  }

  console.log(`[criteria-routing] done — routed to ${passing.length} criteria`)
}
