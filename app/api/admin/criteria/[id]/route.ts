import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  displayOrder: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
})

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params

  const existing = await db.criteriaMapping.findUnique({ where: { id } })
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

  const updated = await db.criteriaMapping.update({
    where: { id },
    data: parsed.data,
    include: { applicationType: { select: { id: true, code: true, name: true } } },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params

  const existing = await db.criteriaMapping.findUnique({ where: { id } })
  if (!existing) {
    return new Response('Not found', { status: 404 })
  }

  await db.criteriaMapping.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
