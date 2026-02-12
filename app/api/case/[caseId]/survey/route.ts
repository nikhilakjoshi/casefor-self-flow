import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"

const SurveyUpdateSchema = z.object({
  data: z.record(z.string(), z.unknown()).optional(),
  skippedSections: z.array(z.string()).optional(),
  intakeStatus: z.enum(["PENDING", "PARTIAL", "COMPLETED", "SKIPPED"]).optional(),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const session = await auth()
  const { caseId } = await params

  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
    include: { profile: true },
  })

  if (!caseRecord) return new Response("Not found", { status: 404 })
  if (caseRecord.userId && caseRecord.userId !== session?.user?.id) {
    return new Response("Not found", { status: 404 })
  }

  return NextResponse.json({
    intakeStatus: caseRecord.intakeStatus,
    skippedSections: caseRecord.skippedSections,
    profileData: caseRecord.profile?.data ?? {},
  })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const session = await auth()
  const { caseId } = await params

  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
    include: { profile: true },
  })

  if (!caseRecord) return new Response("Not found", { status: 404 })
  if (caseRecord.userId && caseRecord.userId !== session?.user?.id) {
    return new Response("Not found", { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = SurveyUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid request" },
      { status: 400 }
    )
  }

  const { data, skippedSections, intakeStatus } = parsed.data

  if (skippedSections !== undefined || intakeStatus !== undefined) {
    await db.case.update({
      where: { id: caseId },
      data: {
        ...(skippedSections !== undefined && { skippedSections }),
        ...(intakeStatus !== undefined && { intakeStatus }),
      },
    })
  }

  if (data) {
    const existingData = (caseRecord.profile?.data as Record<string, unknown>) ?? {}
    const merged = deepMerge(existingData, data)

    await db.caseProfile.upsert({
      where: { caseId },
      create: { caseId, data: merged as object },
      update: { data: merged as object },
    })
  }

  return NextResponse.json({ success: true })
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    const tVal = target[key]
    const sVal = source[key]
    if (
      tVal &&
      sVal &&
      typeof tVal === "object" &&
      typeof sVal === "object" &&
      !Array.isArray(tVal) &&
      !Array.isArray(sVal)
    ) {
      result[key] = deepMerge(
        tVal as Record<string, unknown>,
        sVal as Record<string, unknown>
      )
    } else {
      result[key] = sVal
    }
  }
  return result
}
