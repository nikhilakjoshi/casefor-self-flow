import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'

export async function GET() {
  const templates = await db.template.findMany({
    include: {
      applicationType: { select: { id: true, code: true, name: true } },
      _count: { select: { variations: true } },
    },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  })

  return NextResponse.json(templates)
}

const CreateSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['PERSONAL_STATEMENT', 'RECOMMENDATION_LETTER', 'PETITION', 'USCIS_FORM', 'OTHER']),
  applicationTypeId: z.string().min(1),
  systemInstruction: z.string().min(1),
  description: z.string().optional(),
})

export async function POST(request: Request) {
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

  const appType = await db.applicationType.findUnique({
    where: { id: parsed.data.applicationTypeId },
  })
  if (!appType) {
    return NextResponse.json({ error: 'Application type not found' }, { status: 404 })
  }

  const template = await db.template.create({
    data: parsed.data,
    include: {
      applicationType: { select: { id: true, code: true, name: true } },
      _count: { select: { variations: true } },
    },
  })

  return NextResponse.json(template, { status: 201 })
}
