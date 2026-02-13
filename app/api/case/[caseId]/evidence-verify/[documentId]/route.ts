import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { runDocumentVerification } from "@/lib/evidence-verification"
import { autoRouteDocument } from "@/lib/criteria-routing"
import { isS3Configured, getSignedDownloadUrl } from "@/lib/s3"
import { extractPdfText } from "@/lib/pdf-extractor"
import { parseDocx } from "@/lib/file-parser"

async function getDocumentText(doc: {
  content: string | null
  s3Key: string | null
  type: string
}): Promise<string | null> {
  // Prefer inline content
  if (doc.content && doc.content.length >= 50) return doc.content

  // Fallback: download from S3 and extract
  if (doc.s3Key && isS3Configured()) {
    const url = await getSignedDownloadUrl(doc.s3Key)
    const res = await fetch(url)
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()

    if (doc.type === "PDF") return extractPdfText(buffer)
    if (doc.type === "DOCX") return parseDocx(buffer)
    // TXT/MD
    return new TextDecoder().decode(buffer)
  }

  return null
}

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
    select: { id: true, name: true, content: true, s3Key: true, type: true },
  })
  if (!document) {
    return Response.json({ error: "Document not found" }, { status: 404 })
  }

  const text = await getDocumentText(document)
  if (!text || text.length < 50) {
    return Response.json({ error: "Document has no extractable text" }, { status: 400 })
  }

  // Persist extracted text if it was missing
  if (!document.content || document.content.length < 50) {
    await db.document.update({
      where: { id: documentId },
      data: { content: text },
    })
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

        // Auto-route based on verification scores
        console.log(`[evidence-verify] running autoRouteDocument for re-verify doc=${documentId}`)
        await autoRouteDocument(caseId, documentId)
        console.log(`[evidence-verify] autoRouteDocument complete for re-verify doc=${documentId}`)

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
