import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params

  const template = await db.template.findUnique({
    where: { id },
    include: {
      applicationType: { select: { id: true, code: true, name: true } },
      variations: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!template) {
    return new Response('Not found', { status: 404 })
  }

  return NextResponse.json(template)
}

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['PERSONAL_STATEMENT', 'RECOMMENDATION_LETTER', 'PETITION', 'USCIS_FORM', 'OTHER']).optional(),
  systemInstruction: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  active: z.boolean().optional(),
  version: z.number().int().min(1).optional(),
})

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params

  const existing = await db.template.findUnique({ where: { id } })
  if (!existing) {
    return new Response('Not found', { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid fields', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const updated = await db.template.update({
    where: { id },
    data: parsed.data,
    include: {
      applicationType: { select: { id: true, code: true, name: true } },
      variations: { orderBy: { createdAt: 'asc' } },
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params

  const existing = await db.template.findUnique({ where: { id } })
  if (!existing) {
    return new Response('Not found', { status: 404 })
  }

  await db.template.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
