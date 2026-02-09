import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'

type Params = { params: Promise<{ id: string; varId: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const { id, varId } = await params

  const existing = await db.templateVariation.findFirst({
    where: { id: varId, templateId: id },
  })
  if (!existing) {
    return new Response('Not found', { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const PatchSchema = z.object({
    label: z.string().min(1).optional(),
    content: z.string().min(1).optional(),
    matchField: z.string().optional(),
    matchValue: z.string().optional(),
    isDefault: z.boolean().optional(),
    active: z.boolean().optional(),
  })

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid fields', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // If setting as default, unset other defaults
  if (parsed.data.isDefault) {
    await db.templateVariation.updateMany({
      where: { templateId: id, isDefault: true, id: { not: varId } },
      data: { isDefault: false },
    })
  }

  const updated = await db.templateVariation.update({
    where: { id: varId },
    data: parsed.data,
  })

  return NextResponse.json(updated)
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id, varId } = await params

  const existing = await db.templateVariation.findFirst({
    where: { id: varId, templateId: id },
  })
  if (!existing) {
    return new Response('Not found', { status: 404 })
  }

  await db.templateVariation.delete({ where: { id: varId } })

  return NextResponse.json({ success: true })
}
