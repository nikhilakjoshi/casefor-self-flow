import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { generateCaseName } from "@/lib/case-name"
import { parseFile } from "@/lib/file-parser"
import { chunkText } from "@/lib/chunker"
import { upsertChunks } from "@/lib/pinecone"
import {
  streamExtractAndEvaluate,
  streamExtractAndEvaluateFromPdf,
  extractionToLegacyFormat,
  countExtractionStrengths,
  type DetailedExtraction,
} from "@/lib/eb1a-agent"
import { extractProfile, extractProfileFromPdf } from "@/lib/profile-extractor"
import { isS3Configured, uploadToS3, buildDocumentKey } from "@/lib/s3"

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  const formData = await request.formData()
  const file = formData.get("file") as File | null

  if (!file) {
    return new Response(JSON.stringify({ error: "No file provided" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  try {
    // Lookup EB-1A ApplicationType for auto-assignment
    const eb1aType = await db.applicationType.findUnique({
      where: { code: "EB1A" },
    })
    if (!eb1aType) {
      console.warn(
        "EB-1A ApplicationType not found (seed not run?), proceeding without applicationTypeId"
      )
    }

    // Create Case record
    const caseRecord = await db.case.create({
      data: {
        userId: session.user.id,
        name: generateCaseName(),
        status: "SCREENING",
        ...(eb1aType && { applicationTypeId: eb1aType.id }),
      },
    })

    const isPdf = file.name.toLowerCase().endsWith(".pdf")
    const buffer = await file.arrayBuffer()

    // Get the streaming response - now returns detailed extraction
    const streamResult = isPdf
      ? await streamExtractAndEvaluateFromPdf(buffer)
      : await streamExtractAndEvaluate(await parseFile(file))

    const encoder = new TextEncoder()

    // Create readable stream from partialOutputStream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const partialObject of streamResult.partialOutputStream) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(partialObject)}\n\n`)
            )
          }
          controller.close()
        } catch (err) {
          controller.error(err)
        }
      },
    })

    // Save to DB in background after stream completes
    streamResult.output.then(async (output) => {
      if (!output) return

      const extraction = output as DetailedExtraction
      const extractedText = extraction.extracted_text ?? ""
      const textToChunk = extractedText || (isPdf ? "" : await parseFile(file))

      // Convert to legacy format for backward compatibility
      const legacyFormat = extractionToLegacyFormat(extraction)
      const counts = countExtractionStrengths(extraction)

      // Run chunking/embedding and profile extraction in parallel
      const [, profileData] = await Promise.all([
        // Chunk and embed
        textToChunk
          ? (async () => {
              const chunks = chunkText(textToChunk)
              const { vectorIds } = await upsertChunks(chunks, caseRecord.id)
              const ext = file.name.toLowerCase().split('.').pop()
              const docType = ext === 'pdf' ? 'PDF' : ext === 'docx' ? 'DOCX' : 'MARKDOWN' as const
              const [, doc] = await Promise.all([
                db.resumeUpload.create({
                  data: {
                    caseId: caseRecord.id,
                    fileName: file.name,
                    fileSize: file.size,
                    pineconeVectorIds: vectorIds,
                  },
                }),
                db.document.create({
                  data: {
                    caseId: caseRecord.id,
                    name: file.name,
                    type: docType,
                    source: 'USER_UPLOADED',
                    status: 'DRAFT',
                    content: textToChunk,
                  },
                }),
              ])

              // Upload to S3 if configured
              if (isS3Configured()) {
                const key = buildDocumentKey(caseRecord.id, doc.id, file.name)
                const s3Buffer = Buffer.from(buffer)
                const { url } = await uploadToS3(key, s3Buffer, file.type)
                await db.document.update({
                  where: { id: doc.id },
                  data: { s3Key: key, s3Url: url },
                })
              }
            })()
          : Promise.resolve(),
        // Extract profile
        isPdf
          ? extractProfileFromPdf(buffer)
          : textToChunk
            ? extractProfile(textToChunk)
            : Promise.resolve(null),
      ])

      // Create/update CaseProfile with extracted data
      if (profileData) {
        await db.caseProfile.upsert({
          where: { caseId: caseRecord.id },
          create: { caseId: caseRecord.id, data: profileData },
          update: { data: profileData },
        })
      }

      // Save EB1A analysis with full extraction
      await db.eB1AAnalysis.create({
        data: {
          caseId: caseRecord.id,
          criteria: legacyFormat.criteria,
          extraction: JSON.parse(JSON.stringify(extraction)),
          strongCount: counts.strong,
          weakCount: counts.weak,
        },
      })
    })

    const response = new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Case-Id": caseRecord.id,
        "Set-Cookie": `pendingCaseId=${caseRecord.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`,
      },
    })

    return response
  } catch (err) {
    console.error("Analyze error:", err)
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Analysis failed",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
