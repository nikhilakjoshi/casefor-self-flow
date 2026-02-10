import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { parseDocx, parseTxt, parseMarkdown, parseCsv, parseExcel } from "@/lib/file-parser"
import { extractPdfText } from "@/lib/pdf-extractor"
import { chunkText } from "@/lib/chunker"
import { upsertChunks } from "@/lib/pinecone"
import { classifyDocument } from "@/lib/document-classifier"
import { runDocumentVerification } from "@/lib/evidence-verification"

const MAX_FILES = 10

async function extractText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const ext = file.name.toLowerCase().split(".").pop()

  if (ext === "pdf") return extractPdfText(buffer)
  if (ext === "docx") return parseDocx(buffer)
  if (ext === "txt") return parseTxt(buffer)
  if (ext === "md" || ext === "markdown") return parseMarkdown(buffer)
  if (ext === "csv") return parseCsv(buffer)
  if (ext === "xlsx" || ext === "xls") return parseExcel(buffer)
  throw new Error("Unsupported file type")
}

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

  const verifications = await db.evidenceVerification.findMany({
    where: { caseId },
    include: {
      document: {
        select: { id: true, name: true, category: true, classificationConfidence: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  // Group by document, keeping only latest version per criterion
  const byDoc: Record<string, {
    document: { id: string; name: string; category: string | null; classificationConfidence: number | null }
    criteria: Record<string, unknown>
  }> = {}

  for (const v of verifications) {
    if (!byDoc[v.documentId]) {
      byDoc[v.documentId] = { document: v.document, criteria: {} }
    }
    // Only keep latest version per criterion (already ordered desc)
    if (!byDoc[v.documentId].criteria[v.criterion]) {
      byDoc[v.documentId].criteria[v.criterion] = {
        criterion: v.criterion,
        version: v.version,
        score: v.score,
        recommendation: v.recommendation,
        data: v.data,
      }
    }
  }

  return Response.json(Object.values(byDoc))
}

export async function POST(
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

  const formData = await request.formData()
  const files = formData.getAll("files") as File[]

  if (!files || files.length === 0) {
    return Response.json({ error: "No files provided" }, { status: 400 })
  }
  if (files.length > MAX_FILES) {
    return Response.json({ error: `Max ${MAX_FILES} files` }, { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      try {
        for (const file of files) {
          let text: string
          try {
            text = await extractText(file)
          } catch {
            send({ type: "doc_error", name: file.name, error: "Failed to extract text" })
            continue
          }

          if (!text || text.length < 50) {
            send({ type: "doc_error", name: file.name, error: "Insufficient text content" })
            continue
          }

          // Create Document + Pinecone vectors
          const ext = file.name.toLowerCase().split(".").pop()
          const docType = ext === "pdf" ? "PDF" : ext === "docx" ? "DOCX" : "MARKDOWN" as const

          const chunks = chunkText(text)
          const { vectorIds } = await upsertChunks(chunks, caseId)

          const [, doc] = await Promise.all([
            db.resumeUpload.create({
              data: {
                caseId,
                fileName: file.name,
                fileSize: file.size,
                pineconeVectorIds: vectorIds,
              },
            }),
            db.document.create({
              data: {
                caseId,
                name: file.name,
                type: docType,
                source: "USER_UPLOADED",
                status: "DRAFT",
                content: text,
              },
            }),
          ])

          // Classify async
          classifyDocument(doc.id, file.name, text).catch(() => {})

          send({ type: "doc_started", documentId: doc.id, name: file.name })

          // Run 5 verification agents in parallel
          await runDocumentVerification(caseId, doc.id, text, (criterion, result) => {
            send({ type: "criterion_complete", documentId: doc.id, criterion, result })
          })

          send({ type: "doc_complete", documentId: doc.id })
        }

        send({ type: "all_complete" })
      } catch (err) {
        console.error("Evidence verification stream error:", err)
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
