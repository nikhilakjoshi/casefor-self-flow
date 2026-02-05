import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'

export async function GET() {
  const criteria = await db.criteriaMapping.findMany({
    include: { applicationType: { select: { id: true, code: true, name: true } } },
    orderBy: [{ applicationTypeId: 'asc' }, { displayOrder: 'asc' }],
  })

  return NextResponse.json(criteria)
}

const CreateSchema = z.object({
  applicationTypeId: z.string().min(1),
  criterionKey: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  displayOrder: z.number().int().min(0).default(0),
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

  // Verify application type exists
  const appType = await db.applicationType.findUnique({
    where: { id: parsed.data.applicationTypeId },
  })
  if (!appType) {
    return NextResponse.json({ error: 'Application type not found' }, { status: 404 })
  }

  try {
    const criterion = await db.criteriaMapping.create({
      data: parsed.data,
      include: { applicationType: { select: { id: true, code: true, name: true } } },
    })
    return NextResponse.json(criterion, { status: 201 })
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
      return NextResponse.json(
        { error: 'Criterion key already exists for this application type' },
        { status: 409 }
      )
    }
    throw e
  }
}
