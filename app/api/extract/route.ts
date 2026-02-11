import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { generateCaseName } from "@/lib/case-name"
import { parseFile } from "@/lib/file-parser"
import { extractSurveyData, extractSurveyDataFromPdf } from "@/lib/survey-extractor"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

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
        userId: session.user.id,
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

    await Promise.all([
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

    return NextResponse.json({
      caseId: caseRecord.id,
      caseName: caseName || caseRecord.name,
      surveyData,
    })
  } catch (err) {
    console.error("Extract error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Extraction failed" },
      { status: 500 }
    )
  }
}
