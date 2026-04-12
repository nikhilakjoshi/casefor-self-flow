import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { z } from "zod"

const CloneSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  defaultThreshold: z.number().int().min(1).max(10).optional(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sourceId } = await params
  const body = await request.json()
  const parsed = CloneSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid fields", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  // Check code uniqueness
  const existing = await db.applicationType.findUnique({
    where: { code: parsed.data.code },
  })
  if (existing) {
    return NextResponse.json(
      { error: `Code "${parsed.data.code}" already exists` },
      { status: 409 },
    )
  }

  // Load source with all associated entities
  const source = await db.applicationType.findUnique({
    where: { id: sourceId },
    include: {
      criteria: true,
      criterionPromptLinks: true,
      evidenceTypeDefinitions: true,
      strengthRubric: true,
      denialFramework: true,
    },
  })
  if (!source) {
    return NextResponse.json({ error: "Source type not found" }, { status: 404 })
  }

  // Create the new type + all associated entities in a transaction
  const newType = await db.$transaction(async (tx) => {
    const created = await tx.applicationType.create({
      data: {
        code: parsed.data.code,
        name: parsed.data.name,
        defaultThreshold: parsed.data.defaultThreshold ?? source.defaultThreshold,
        active: true,
      },
    })

    // Clone criteria
    if (source.criteria.length > 0) {
      await tx.criteriaMapping.createMany({
        data: source.criteria.map((c) => ({
          applicationTypeId: created.id,
          criterionKey: c.criterionKey,
          name: c.name,
          description: c.description,
          uscisText: c.uscisText,
          guidanceText: c.guidanceText,
          displayOrder: c.displayOrder,
          active: c.active,
        })),
      })
    }

    // Clone criterion prompt links
    if (source.criterionPromptLinks.length > 0) {
      await tx.criterionPromptLink.createMany({
        data: source.criterionPromptLinks.map((l) => ({
          applicationTypeId: created.id,
          criterionKey: l.criterionKey,
          purpose: l.purpose,
          promptSlug: l.promptSlug,
        })),
      })
    }

    // Clone evidence type definitions
    if (source.evidenceTypeDefinitions.length > 0) {
      await tx.evidenceTypeDefinition.createMany({
        data: source.evidenceTypeDefinitions.map((e) => ({
          applicationTypeId: created.id,
          schemaKey: e.schemaKey,
          name: e.name,
          description: e.description,
          fieldsJson: e.fieldsJson,
          displayOrder: e.displayOrder,
          active: e.active,
        })),
      })
    }

    // Clone strength rubric
    if (source.strengthRubric) {
      await tx.strengthRubric.create({
        data: {
          applicationTypeId: created.id,
          content: source.strengthRubric.content,
        },
      })
    }

    // Clone denial framework
    if (source.denialFramework) {
      await tx.denialFramework.create({
        data: {
          applicationTypeId: created.id,
          frameworkName: source.denialFramework.frameworkName,
          content: source.denialFramework.content,
        },
      })
    }

    return created
  })

  // Re-fetch with counts for response
  const result = await db.applicationType.findUnique({
    where: { id: newType.id },
    include: {
      _count: { select: { criteria: true, cases: true } },
    },
  })

  return NextResponse.json(result, { status: 201 })
}
