import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { generateCaseName } from "@/lib/case-name"
import { parseFile } from "@/lib/file-parser"
import { extractSurveyData, extractSurveyDataFromPdf } from "@/lib/survey-extractor"
import { NextResponse } from "next/server"
import { isS3Configured, uploadToS3, buildDocumentKey } from "@/lib/s3"

export async function POST(request: Request) {
  const session = await auth()
  const userId = session?.user?.id ?? null

  const formData = await request.formData()
  const file = formData.get("file") as File | null

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  try {
    const eb1aType = await db.applicationType.findUnique({
      where: { code: "EB1A" },
    })

    const caseRecord = await db.case.create({
      data: {
        userId,
        name: generateCaseName(),
        status: "SCREENING",
        ...(eb1aType && { applicationTypeId: eb1aType.id }),
      },
    })

    const isPdf = file.name.toLowerCase().endsWith(".pdf")
    const buffer = await file.arrayBuffer()

    // Extract survey data directly using LLM with survey schema
    const surveyData = isPdf
      ? await extractSurveyDataFromPdf(buffer)
      : await extractSurveyData(await parseFile(file))

    // Derive meaningful case name from extraction
    const fullName = surveyData?.background?.fullName
    const field = surveyData?.background?.areaOfExpertise
    const caseName = fullName
      ? field ? `${fullName} - ${field}` : fullName
      : null

    // Save extracted data to profile
    const ext = file.name.toLowerCase().split('.').pop()
    const docType = ext === 'pdf' ? 'PDF' : ext === 'docx' ? 'DOCX' : 'MARKDOWN' as const

    const results = await Promise.all([
      ...(caseName ? [db.case.update({ where: { id: caseRecord.id }, data: { name: caseName } })] : []),
      db.caseProfile.create({
        data: { caseId: caseRecord.id, data: surveyData as object },
      }),
      db.resumeUpload.create({
        data: {
          caseId: caseRecord.id,
          fileName: file.name,
          fileSize: file.size,
          pineconeVectorIds: [],
        },
      }),
      db.document.create({
        data: {
          caseId: caseRecord.id,
          name: file.name,
          type: docType,
          source: 'USER_UPLOADED',
          status: 'DRAFT',
        },
      }),
    ])

    // Upload to S3 if configured (doc is last element in results)
    const doc = results[results.length - 1] as { id: string }
    if (isS3Configured()) {
      const key = buildDocumentKey(caseRecord.id, doc.id, file.name)
      const s3Buffer = Buffer.from(buffer)
      const { url } = await uploadToS3(key, s3Buffer, file.type)
      await db.document.update({
        where: { id: doc.id },
        data: { s3Key: key, s3Url: url },
      })
    }

    const res = NextResponse.json({
      caseId: caseRecord.id,
      caseName: caseName || caseRecord.name,
      surveyData,
    })

    if (!userId) {
      res.headers.set(
        "Set-Cookie",
        `pendingCaseId=${caseRecord.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`
      )
    }

    return res
  } catch (err) {
    console.error("Extract error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Extraction failed" },
      { status: 500 }
    )
  }
}
