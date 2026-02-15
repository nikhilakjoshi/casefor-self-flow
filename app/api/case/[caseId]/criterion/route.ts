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
import { runSingleCriterionVerification } from "@/lib/evidence-verification"

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
    let uploadedDocId: string | null = null

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
        uploadedDocId = doc.id

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

If the user indicates evidence is incorrect or irrelevant, exclude it from your evaluation.
When evidence has been removed, re-evaluate strength based on remaining evidence only.

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

    // Run evidence verification + create routing for the dropped file
    let verification: { score: number; recommendation: string; verified_claims: string[]; red_flags: string[]; matched_item_ids: string[] } | null = null
    if (uploadedDocId && fileContent) {
      try {
        const result = await runSingleCriterionVerification(caseId, uploadedDocId, fileContent, criterionId)
        verification = {
          score: result.score,
          recommendation: result.recommendation,
          verified_claims: result.verified_claims,
          red_flags: result.red_flags,
          matched_item_ids: result.matched_item_ids,
        }

        // Create DocumentCriterionRouting record (autoRouted: false since user explicitly dropped on this criterion)
        await db.documentCriterionRouting.upsert({
          where: { documentId_criterion: { documentId: uploadedDocId, criterion: criterionId } },
          create: {
            documentId: uploadedDocId,
            criterion: criterionId,
            score: result.score,
            recommendation: result.recommendation,
            autoRouted: false,
            matchedItemIds: result.matched_item_ids,
          },
          update: {
            score: result.score,
            recommendation: result.recommendation,
            matchedItemIds: result.matched_item_ids,
          },
        })
      } catch (verifyErr) {
        console.error("Evidence verification failed (non-fatal):", verifyErr)
      }
    }

    return new Response(
      JSON.stringify({
        criterionId,
        ...output,
        ...(verification && { verification }),
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

const EVIDENCE_CATEGORIES = [
  "publications", "awards", "patents", "memberships", "media_coverage",
  "judging_activities", "speaking_engagements", "grants", "leadership_roles",
  "compensation", "exhibitions", "commercial_success", "original_contributions",
] as const

export async function DELETE(
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
    const { criterionId, evidenceIndex, evidenceSource, category } = await request.json()

    if (!criterionId || !CRITERIA_METADATA[criterionId as CriterionId]) {
      return new Response(JSON.stringify({ error: "Invalid criterion ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const latestAnalysis = caseRecord.eb1aAnalyses[0]
    if (!latestAnalysis) {
      return new Response(JSON.stringify({ error: "No analysis found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    }

    const existingExtraction = latestAnalysis.extraction as Record<string, unknown> | null
    const existingCriteria = latestAnalysis.criteria as Array<{
      criterionId: string; strength: string; reason: string; evidence: string[]
    }>

    let updatedExtraction = existingExtraction ? { ...existingExtraction } : null
    let updatedCriteria = [...existingCriteria]

    if (evidenceSource === "key_evidence") {
      // Remove from criteria_summary key_evidence
      if (updatedExtraction?.criteria_summary) {
        const criteriaSummary = (updatedExtraction.criteria_summary as Array<{
          criterion_id: string; strength: string; summary: string
          key_evidence: string[]; evidence_count: number
        }>).map((s) => {
          if (s.criterion_id !== criterionId) return s
          const ke = [...s.key_evidence]
          ke.splice(evidenceIndex, 1)
          return { ...s, key_evidence: ke, evidence_count: Math.max(0, s.evidence_count - 1) }
        })
        updatedExtraction = { ...updatedExtraction, criteria_summary: criteriaSummary }
      }
      // Also remove from criteria[].evidence at same index
      updatedCriteria = updatedCriteria.map((c) => {
        if (c.criterionId !== criterionId) return c
        const ev = [...c.evidence]
        ev.splice(evidenceIndex, 1)
        return { ...c, evidence: ev }
      })
    } else if (evidenceSource === "evidence") {
      // Legacy evidence removal
      updatedCriteria = updatedCriteria.map((c) => {
        if (c.criterionId !== criterionId) return c
        const ev = [...c.evidence]
        ev.splice(evidenceIndex, 1)
        return { ...c, evidence: ev }
      })
    } else if (evidenceSource === "extraction_item") {
      // Remove extraction category item by removing criterionId from mapped_criteria
      if (updatedExtraction && category && EVIDENCE_CATEGORIES.includes(category)) {
        const arr = updatedExtraction[category] as Record<string, unknown>[] | undefined
        if (arr) {
          // Find items matching this criterion and use evidenceIndex within that filtered set
          let matchIdx = 0
          const updated = arr.map((item) => {
            const mc = item.mapped_criteria as string[] | undefined
            if (!mc?.includes(criterionId)) return item
            if (matchIdx === evidenceIndex) {
              matchIdx++
              const newMc = mc.filter((id) => id !== criterionId)
              return { ...item, mapped_criteria: newMc }
            }
            matchIdx++
            return item
          })
          updatedExtraction = { ...updatedExtraction, [category]: updated }
        }
      }
    } else {
      return new Response(JSON.stringify({ error: "Invalid evidenceSource" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Re-evaluate criterion with remaining evidence via Claude
    const meta = CRITERIA_METADATA[criterionId as CriterionId]
    const extractedText = updatedExtraction?.extracted_text as string | undefined

    const contextParts: string[] = []
    if (extractedText) {
      contextParts.push(`EXISTING RESUME CONTENT:\n${extractedText.slice(0, 8000)}`)
    }

    // Gather remaining evidence for context
    const remainingCriterion = updatedCriteria.find((c) => c.criterionId === criterionId)
    if (remainingCriterion?.evidence?.length) {
      contextParts.push(`REMAINING EVIDENCE:\n${remainingCriterion.evidence.join("\n")}`)
    }

    // Gather remaining extraction items
    if (updatedExtraction) {
      for (const cat of EVIDENCE_CATEGORIES) {
        const arr = updatedExtraction[cat] as Record<string, unknown>[] | undefined
        if (!arr?.length) continue
        const matching = arr.filter((item) => {
          const mc = item.mapped_criteria as string[] | undefined
          return mc?.includes(criterionId)
        })
        if (matching.length > 0) {
          contextParts.push(`REMAINING ${cat.toUpperCase()} ITEMS:\n${JSON.stringify(matching, null, 2)}`)
        }
      }
    }

    contextParts.push("NOTICE: Evidence was removed by the user. Re-evaluate based on remaining evidence only.")

    const systemPrompt = `You are an EB-1A immigration expert. Evaluate the provided information ONLY for the following criterion. Do not use emojis.

CRITERION ${criterionId}: ${meta.name}
${meta.description}

EVALUATION GUIDELINES:
- Strong: Clear, compelling evidence that meets USCIS standards for this criterion
- Weak: Some evidence but needs strengthening or more documentation
- None: No relevant evidence found for this criterion

If the user indicates evidence is incorrect or irrelevant, exclude it from your evaluation.
When evidence has been removed, re-evaluate strength based on remaining evidence only.

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
      return new Response(JSON.stringify({ error: "Re-evaluation failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Apply Claude's re-evaluation
    updatedCriteria = updatedCriteria.map((c) =>
      c.criterionId === criterionId ? { ...c, ...output } : c
    )

    const strongCount = updatedCriteria.filter((c) => c.strength === "Strong").length
    const weakCount = updatedCriteria.filter((c) => c.strength === "Weak").length

    if (updatedExtraction?.criteria_summary) {
      const criteriaSummary = (updatedExtraction.criteria_summary as Array<{
        criterion_id: string; strength: string; summary: string
        key_evidence: string[]; evidence_count: number
      }>).map((s) =>
        s.criterion_id === criterionId
          ? { ...s, strength: output.strength, summary: output.reason, key_evidence: output.evidence, evidence_count: output.evidence.length }
          : s
      )
      updatedExtraction = { ...updatedExtraction, criteria_summary: criteriaSummary }
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

    return new Response(
      JSON.stringify({ criterionId, ...output }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.error("Evidence removal error:", err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Removal failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
