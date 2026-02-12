import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { parseFile } from "@/lib/file-parser"
import { chunkText } from "@/lib/chunker"
import { upsertChunks } from "@/lib/pinecone"
import {
  streamExtractAndEvaluate,
  streamExtractAndEvaluateFromPdf,
  streamQuickProfile,
  streamQuickProfileFromPdf,
  extractionToLegacyFormat,
  countExtractionStrengths,
  type DetailedExtraction,
} from "@/lib/eb1a-agent"
import { mergeExtractionWithSurvey } from "@/lib/merge-extraction"
import type { SurveyData } from "@/app/onboard/_lib/survey-schema"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const session = await auth()
  const { caseId } = await params

  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
    include: {
      resumeUploads: { orderBy: { createdAt: "desc" }, take: 1 },
      profile: true,
      eb1aAnalyses: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  })

  if (!caseRecord) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }

  if (caseRecord.userId && caseRecord.userId !== session?.user?.id) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }

  const contentType = request.headers.get("content-type") ?? ""

  // JSON request = reanalysis with survey merge
  if (contentType.includes("application/json")) {
    return handleReanalysis(caseId, caseRecord)
  }

  // FormData = file upload for new analysis
  return handleFileAnalysis(request, caseId, caseRecord, !session?.user?.id)
}

// Handle reanalysis - merge existing extraction with survey data
async function handleReanalysis(
  caseId: string,
  caseRecord: {
    profile: { data: unknown; version: number } | null
    eb1aAnalyses: Array<{ id: string; extraction: unknown; version: number }>
  }
) {
  try {
    const latestAnalysis = caseRecord.eb1aAnalyses[0]
    if (!latestAnalysis?.extraction) {
      return new Response(
        JSON.stringify({ error: "No extraction found to merge" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    const surveyData = (caseRecord.profile?.data ?? {}) as SurveyData
    const surveyVersion = caseRecord.profile?.version ?? 1
    const extraction = latestAnalysis.extraction as DetailedExtraction

    // Merge extraction with survey data
    const mergedExtraction = mergeExtractionWithSurvey(extraction, surveyData)

    // Convert to legacy format
    const legacyFormat = extractionToLegacyFormat(mergedExtraction)
    const counts = countExtractionStrengths(mergedExtraction)

    // Save new analysis version
    const newAnalysis = await db.eB1AAnalysis.create({
      data: {
        caseId,
        version: latestAnalysis.version + 1,
        criteria: legacyFormat.criteria,
        extraction: JSON.parse(JSON.stringify(mergedExtraction)),
        mergedWithSurvey: true,
        surveyVersion,
        strongCount: counts.strong,
        weakCount: counts.weak,
      },
    })

    return new Response(
      JSON.stringify({
        id: newAnalysis.id,
        version: newAnalysis.version,
        strongCount: counts.strong,
        weakCount: counts.weak,
        criteria: legacyFormat.criteria,
        extraction: mergedExtraction,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.error("Reanalysis error:", err)
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Reanalysis failed",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}

// Handle file upload analysis
async function handleFileAnalysis(
  request: Request,
  caseId: string,
  caseRecord: { profile: { data: unknown } | null },
  isAnonymous: boolean
) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const isPdf = file.name.toLowerCase().endsWith(".pdf")
    const buffer = await file.arrayBuffer()

    // Pass survey data if available
    const surveyData = caseRecord.profile?.data as Record<string, unknown> | undefined

    // Start both calls in parallel: quick profile (fast) + full extraction
    const parsedText = isPdf ? null : await parseFile(file)

    const [quickResult, fullResult] = await Promise.all([
      isPdf
        ? streamQuickProfileFromPdf(buffer, surveyData)
        : streamQuickProfile(parsedText!, surveyData),
      isPdf
        ? streamExtractAndEvaluateFromPdf(buffer, surveyData)
        : streamExtractAndEvaluate(parsedText!, surveyData),
    ])

    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Phase 1: stream quick profile (completes in ~1-2s)
          let quickFinal: Record<string, unknown> = {}
          for await (const partial of quickResult.partialOutputStream) {
            quickFinal = partial as Record<string, unknown>
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(quickFinal)}\n\n`)
            )
          }

          // Phase 2: stream full extraction, merging over quick profile data
          for await (const partial of fullResult.partialOutputStream) {
            const merged = { ...quickFinal, ...(partial as Record<string, unknown>) }
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(merged)}\n\n`)
            )
          }
          controller.close()
        } catch (err) {
          controller.error(err)
        }
      },
    })

    // Save to DB in background after full extraction completes
    fullResult.output.then(async (output) => {
      if (!output) return

      const extraction = output as DetailedExtraction
      const extractedText = extraction.extracted_text ?? ""
      const textToChunk = extractedText || (isPdf ? "" : (parsedText ?? await parseFile(file)))

      // Chunk and embed
      if (textToChunk) {
        const chunks = chunkText(textToChunk)
        const { vectorIds } = await upsertChunks(chunks, caseId)
        const ext = file.name.toLowerCase().split('.').pop()
        const docType = ext === 'pdf' ? 'PDF' : ext === 'docx' ? 'DOCX' : 'MARKDOWN' as const
        await Promise.all([
          db.resumeUpload.updateMany({
            where: { caseId, fileName: file.name },
            data: { pineconeVectorIds: vectorIds },
          }),
          db.document.create({
            data: {
              caseId,
              name: file.name,
              type: docType,
              source: 'USER_UPLOADED',
              status: 'DRAFT',
            },
          }),
        ])
      }

      // Convert to legacy format
      const legacyFormat = extractionToLegacyFormat(extraction)
      const counts = countExtractionStrengths(extraction)

      await db.eB1AAnalysis.create({
        data: {
          caseId,
          criteria: legacyFormat.criteria,
          extraction: JSON.parse(JSON.stringify(extraction)),
          strongCount: counts.strong,
          weakCount: counts.weak,
        },
      })
    })

    const headers: Record<string, string> = {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Case-Id": caseId,
    }

    if (isAnonymous) {
      headers["Set-Cookie"] = `pendingCaseId=${caseId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`
    }

    return new Response(stream, { headers })
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
