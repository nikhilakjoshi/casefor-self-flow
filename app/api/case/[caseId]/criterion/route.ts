import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { anthropic } from "@ai-sdk/anthropic"
import { generateText, Output } from "ai"
import { z } from "zod"
import { parseFile } from "@/lib/file-parser"
import { extractPdfText } from "@/lib/pdf-extractor"
import { chunkText } from "@/lib/chunker"
import { upsertChunks } from "@/lib/pinecone"
import { isS3Configured, uploadToS3, buildDocumentKey } from "@/lib/s3"
import { CRITERIA_METADATA, type CriterionId } from "@/lib/eb1a-extraction-schema"

const MODEL = "claude-sonnet-4-20250514"

const CriterionEvaluationSchema = z.object({
  strength: z.enum(["Strong", "Weak", "None"]),
  reason: z.string(),
  evidence: z.array(z.string()),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  const { caseId } = await params

  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
    include: {
      eb1aAnalyses: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  })

  if (!caseRecord || caseRecord.userId !== session.user.id) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }

  try {
    const contentType = request.headers.get("content-type") ?? ""
    let criterionId: string
    let additionalContext = ""
    let fileContent = ""

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      criterionId = formData.get("criterionId") as string
      additionalContext = (formData.get("context") as string) ?? ""
      const file = formData.get("file") as File | null

      if (file) {
        const buffer = await file.arrayBuffer()
        const isPdf = file.name.toLowerCase().endsWith(".pdf")

        if (isPdf) {
          fileContent = await extractPdfText(buffer)
        } else {
          fileContent = await parseFile(file)
        }

        // Persist file as Document (always, before optional Pinecone/S3)
        const ext = file.name.toLowerCase().split(".").pop()
        const docType = ext === "pdf" ? "PDF" : ext === "docx" ? "DOCX" : "MARKDOWN" as const

        const doc = await db.document.create({
          data: {
            caseId,
            name: file.name,
            type: docType,
            source: "USER_UPLOADED",
            status: "DRAFT",
            content: fileContent || null,
          },
        })

        // S3 upload (non-fatal)
        if (isS3Configured()) {
          try {
            const s3Key = buildDocumentKey(caseId, doc.id, file.name)
            const { url } = await uploadToS3(s3Key, Buffer.from(buffer), file.type)
            await db.document.update({ where: { id: doc.id }, data: { s3Key, s3Url: url } })
          } catch (s3Err) {
            console.error(`S3 upload failed for ${file.name}:`, s3Err)
          }
        }

        // Pinecone upsert (non-fatal)
        if (fileContent && fileContent.length > 20) {
          try {
            const chunks = chunkText(fileContent)
            const { vectorIds } = await upsertChunks(chunks, caseId)
            await db.resumeUpload.create({
              data: { caseId, fileName: file.name, fileSize: file.size, pineconeVectorIds: vectorIds },
            })
          } catch (pineconeErr) {
            console.error(`Pinecone upsert failed for ${file.name}:`, pineconeErr)
            // Still create ResumeUpload with empty vectorIds
            await db.resumeUpload.create({
              data: { caseId, fileName: file.name, fileSize: file.size, pineconeVectorIds: [] },
            })
          }
        }
      }
    } else {
      const body = await request.json()
      criterionId = body.criterionId
      additionalContext = body.context ?? ""
    }

    if (!criterionId || !CRITERIA_METADATA[criterionId as CriterionId]) {
      return new Response(JSON.stringify({ error: "Invalid criterion ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const meta = CRITERIA_METADATA[criterionId as CriterionId]
    const latestAnalysis = caseRecord.eb1aAnalyses[0]
    const existingExtraction = latestAnalysis?.extraction as Record<string, unknown> | null
    const extractedText = existingExtraction?.extracted_text as string | undefined

    // Build context from existing extraction + new input
    const contextParts: string[] = []
    if (extractedText) {
      contextParts.push(`EXISTING RESUME CONTENT:\n${extractedText.slice(0, 8000)}`)
    }
    if (additionalContext) {
      contextParts.push(`ADDITIONAL CONTEXT PROVIDED BY USER:\n${additionalContext}`)
    }
    if (fileContent) {
      contextParts.push(`ADDITIONAL DOCUMENT CONTENT:\n${fileContent.slice(0, 8000)}`)
    }

    const systemPrompt = `You are an EB-1A immigration expert. Evaluate the provided information ONLY for the following criterion. Do not use emojis.

CRITERION ${criterionId}: ${meta.name}
${meta.description}

EVALUATION GUIDELINES:
- Strong: Clear, compelling evidence that meets USCIS standards for this criterion
- Weak: Some evidence but needs strengthening or more documentation
- None: No relevant evidence found for this criterion

Provide:
1. strength: Your assessment (Strong/Weak/None)
2. reason: A concise explanation (2-3 sentences)
3. evidence: Array of specific quotes or facts that support your assessment (empty if None)

Be thorough but realistic. Focus ONLY on evidence relevant to this specific criterion.`

    const { output } = await generateText({
      model: anthropic(MODEL),
      output: Output.object({ schema: CriterionEvaluationSchema }),
      system: systemPrompt,
      prompt: contextParts.join("\n\n---\n\n"),
    })

    if (!output) {
      return new Response(JSON.stringify({ error: "Evaluation failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Update the analysis in the database
    if (latestAnalysis) {
      const existingCriteria = latestAnalysis.criteria as Array<{
        criterionId: string
        strength: string
        reason: string
        evidence: string[]
      }>

      const updatedCriteria = existingCriteria.map((c) =>
        c.criterionId === criterionId
          ? { ...c, ...output }
          : c
      )

      // Recalculate counts
      const strongCount = updatedCriteria.filter((c) => c.strength === "Strong").length
      const weakCount = updatedCriteria.filter((c) => c.strength === "Weak").length

      // Also update criteria_summary in extraction if it exists
      let updatedExtraction = existingExtraction
      if (existingExtraction?.criteria_summary) {
        const criteriaSummary = existingExtraction.criteria_summary as Array<{
          criterion_id: string
          strength: string
          summary: string
          key_evidence: string[]
          evidence_count: number
        }>

        const updatedSummary = criteriaSummary.map((s) =>
          s.criterion_id === criterionId
            ? {
                ...s,
                strength: output.strength,
                summary: output.reason,
                key_evidence: output.evidence,
                evidence_count: output.evidence.length,
              }
            : s
        )

        updatedExtraction = {
          ...existingExtraction,
          criteria_summary: updatedSummary,
        }
      }

      await db.eB1AAnalysis.update({
        where: { id: latestAnalysis.id },
        data: {
          criteria: updatedCriteria,
          extraction: updatedExtraction ? JSON.parse(JSON.stringify(updatedExtraction)) : undefined,
          strongCount,
          weakCount,
        },
      })
    }

    return new Response(
      JSON.stringify({
        criterionId,
        ...output,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.error("Criterion evaluation error:", err)
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Evaluation failed",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
