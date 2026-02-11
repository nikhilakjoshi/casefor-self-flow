import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { autoRouteDocument } from "@/lib/criteria-routing"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { caseId } = await params

  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
    select: { userId: true },
  })
  if (!caseRecord || caseRecord.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  console.log(`[criteria-routing GET] fetching routings for case=${caseId}`)

  const routings = await db.documentCriterionRouting.findMany({
    where: { document: { caseId } },
    include: {
      document: {
        select: { id: true, name: true, category: true },
      },
    },
    orderBy: { criterion: "asc" },
  })

  // Group by criterion
  const byCriterion: Record<string, {
    criterion: string
    documents: {
      id: string
      documentId: string
      name: string
      category: string | null
      score: number
      recommendation: string
      autoRouted: boolean
    }[]
  }> = {}

  for (const r of routings) {
    if (!byCriterion[r.criterion]) {
      byCriterion[r.criterion] = { criterion: r.criterion, documents: [] }
    }
    byCriterion[r.criterion].documents.push({
      id: r.id,
      documentId: r.document.id,
      name: r.document.name,
      category: r.document.category,
      score: r.score,
      recommendation: r.recommendation,
      autoRouted: r.autoRouted,
    })
  }

  // Also return all case documents for assignment dropdown
  const allDocuments = await db.document.findMany({
    where: { caseId, source: "USER_UPLOADED" },
    select: { id: true, name: true, category: true },
    orderBy: { name: "asc" },
  })

  console.log(`[criteria-routing GET] returning ${routings.length} routing(s) across ${Object.keys(byCriterion).length} criteria, ${allDocuments.length} total docs`)

  return Response.json({ routings: byCriterion, documents: allDocuments })
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { caseId } = await params

  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
    select: { userId: true },
  })
  if (!caseRecord || caseRecord.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const body = await request.json()
  console.log(`[criteria-routing PUT] case=${caseId}`, body)

  const { documentId, criterion, action } = body as {
    documentId: string
    criterion: string
    action: "add" | "remove" | "re-route"
  }

  if (action === "re-route") {
    const docs = await db.document.findMany({
      where: { caseId, source: "USER_UPLOADED" },
      select: { id: true },
    })
    console.log(`[criteria-routing PUT] re-routing ${docs.length} doc(s)`)
    for (const doc of docs) {
      await autoRouteDocument(caseId, doc.id)
    }
    console.log(`[criteria-routing PUT] re-route complete`)
    return Response.json({ ok: true })
  }

  // Verify document belongs to case
  const doc = await db.document.findFirst({
    where: { id: documentId, caseId },
    select: { id: true },
  })
  if (!doc) {
    return Response.json({ error: "Document not found" }, { status: 404 })
  }

  if (action === "add") {
    await db.documentCriterionRouting.upsert({
      where: { documentId_criterion: { documentId, criterion } },
      create: {
        documentId,
        criterion,
        score: 0,
        recommendation: "MANUAL",
        autoRouted: false,
      },
      update: {
        autoRouted: false,
      },
    })
  } else if (action === "remove") {
    await db.documentCriterionRouting.deleteMany({
      where: { documentId, criterion },
    })
  }

  return Response.json({ ok: true })
}
