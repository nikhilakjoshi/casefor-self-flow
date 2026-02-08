import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
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

    // Save extracted data to profile
    await Promise.all([
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
    ])

    return NextResponse.json({
      caseId: caseRecord.id,
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
