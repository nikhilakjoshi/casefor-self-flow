import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const framework = await db.denialFramework.findUnique({
    where: { applicationTypeId: id },
  })
  return NextResponse.json(framework)
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { frameworkName, content } = await request.json()
  if (!content || typeof content !== "string") {
    return NextResponse.json({ error: "content required" }, { status: 400 })
  }

  const framework = await db.denialFramework.upsert({
    where: { applicationTypeId: id },
    update: { content, ...(frameworkName && { frameworkName }) },
    create: {
      applicationTypeId: id,
      frameworkName: frameworkName || "Default Framework",
      content,
    },
  })

  return NextResponse.json(framework)
}
