import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const rubric = await db.strengthRubric.findUnique({
    where: { applicationTypeId: id },
  })
  return NextResponse.json(rubric)
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { content } = await request.json()
  if (!content || typeof content !== "string") {
    return NextResponse.json({ error: "content required" }, { status: 400 })
  }

  const rubric = await db.strengthRubric.upsert({
    where: { applicationTypeId: id },
    update: { content },
    create: { applicationTypeId: id, content },
  })

  return NextResponse.json(rubric)
}
