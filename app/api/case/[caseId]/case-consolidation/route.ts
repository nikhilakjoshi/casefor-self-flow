import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { streamCaseConsolidation } from "@/lib/case-consolidation"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ caseId: string }> }
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

  const latest = await db.caseConsolidation.findFirst({
    where: { caseId },
    orderBy: { createdAt: "desc" },
  })

  return Response.json(latest?.data ?? null)
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ caseId: string }> }
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

  const streamResult = await streamCaseConsolidation(caseId)

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const partial of streamResult.partialOutputStream) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(partial)}\n\n`)
          )
        }
        controller.close()
      } catch (err) {
        console.error("Case consolidation stream error:", err)
        controller.error(err)
      }
    },
  })

  // Save to DB after stream completes
  streamResult.output.then(async (output) => {
    if (!output) return
    try {
      const latest = await db.caseConsolidation.findFirst({
        where: { caseId },
        orderBy: { version: "desc" },
        select: { version: true },
      })
      await db.caseConsolidation.create({
        data: {
          caseId,
          version: (latest?.version ?? 0) + 1,
          data: JSON.parse(JSON.stringify(output)),
        },
      })
    } catch (err) {
      console.error("Failed to save case consolidation:", err)
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
