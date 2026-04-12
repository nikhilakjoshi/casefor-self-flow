import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { z } from "zod"

const PatchSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  defaultThreshold: z.number().int().min(1).max(10).optional(),
  active: z.boolean().optional(),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const appType = await db.applicationType.findUnique({
    where: { id },
    include: {
      criteria: { orderBy: { displayOrder: "asc" } },
      criterionPromptLinks: true,
      evidenceTypeDefinitions: { orderBy: { displayOrder: "asc" } },
      strengthRubric: true,
      denialFramework: true,
      _count: { select: { cases: true, criteria: true, templates: true } },
    },
  })
  if (!appType) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json(appType)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await request.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid fields", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const updated = await db.applicationType.update({
    where: { id },
    data: parsed.data,
    include: {
      _count: { select: { criteria: true, cases: true } },
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  // Check for existing cases
  const caseCount = await db.case.count({ where: { applicationTypeId: id } })
  if (caseCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${caseCount} case(s) use this type` },
      { status: 409 },
    )
  }

  // Delete associated entities first (cascade not configured for all)
  await db.criterionPromptLink.deleteMany({ where: { applicationTypeId: id } })
  await db.evidenceTypeDefinition.deleteMany({ where: { applicationTypeId: id } })
  await db.strengthRubric.deleteMany({ where: { applicationTypeId: id } })
  await db.denialFramework.deleteMany({ where: { applicationTypeId: id } })
  await db.criteriaMapping.deleteMany({ where: { applicationTypeId: id } })
  await db.applicationType.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
