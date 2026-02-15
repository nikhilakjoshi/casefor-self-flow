import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { generateCaseName } from "@/lib/case-name"
import { NextResponse } from "next/server"

export async function POST() {
  const session = await auth()
  const userId = session?.user?.id ?? null

  try {
    const eb1aType = await db.applicationType.findUnique({
      where: { code: "EB1A" },
    })

    const caseName = generateCaseName()

    const caseRecord = await db.case.create({
      data: {
        userId,
        name: caseName,
        status: "SCREENING",
        intakeStatus: "PENDING",
        ...(eb1aType && { applicationTypeId: eb1aType.id }),
      },
    })

    // Create empty profile so survey can populate it
    await db.caseProfile.create({
      data: { caseId: caseRecord.id, data: {} },
    })

    const res = NextResponse.json({
      caseId: caseRecord.id,
      caseName,
    })

    if (!userId) {
      res.headers.set(
        "Set-Cookie",
        `pendingCaseId=${caseRecord.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`
      )
    }

    return res
  } catch (err) {
    console.error("Create survey-only case error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create case" },
      { status: 500 }
    )
  }
}
