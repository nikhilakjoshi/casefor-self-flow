import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params

  const variations = await db.templateVariation.findMany({
    where: { templateId: id },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(variations)
}

const CreateSchema = z.object({
  label: z.string().min(1),
  content: z.string().min(1),
  matchField: z.string().default(''),
  matchValue: z.string().default(''),
  isDefault: z.boolean().default(false),
})

export async function POST(request: Request, { params }: Params) {
  const { id } = await params

  const template = await db.template.findUnique({ where: { id } })
  if (!template) {
    return new Response('Template not found', { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid fields', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // If setting as default, unset other defaults
  if (parsed.data.isDefault) {
    await db.templateVariation.updateMany({
      where: { templateId: id, isDefault: true },
      data: { isDefault: false },
    })
  }

  const variation = await db.templateVariation.create({
    data: { templateId: id, ...parsed.data },
  })

  return NextResponse.json(variation, { status: 201 })
}
