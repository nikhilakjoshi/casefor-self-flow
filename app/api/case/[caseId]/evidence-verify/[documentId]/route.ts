import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { runDocumentVerification } from "@/lib/evidence-verification"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ caseId: string; documentId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { caseId, documentId } = await params

  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
    select: { userId: true },
  })
  if (!caseRecord || caseRecord.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const document = await db.document.findFirst({
    where: { id: documentId, caseId },
    select: { id: true, name: true, content: true },
  })
  if (!document) {
    return Response.json({ error: "Document not found" }, { status: 404 })
  }

  const text = document.content
  if (!text || text.length < 50) {
    return Response.json({ error: "Document has no extractable text" }, { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      try {
        send({ type: "doc_started", documentId, name: document.name })

        await runDocumentVerification(caseId, documentId, text, (criterion, result) => {
          send({ type: "criterion_complete", documentId, criterion, result })
        })

        send({ type: "doc_complete", documentId })
        send({ type: "all_complete" })
      } catch (err) {
        console.error("Re-verify stream error:", err)
        send({ type: "error", error: err instanceof Error ? err.message : "Verification failed" })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
