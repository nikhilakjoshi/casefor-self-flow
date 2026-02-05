import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'

export async function GET() {
  const types = await db.applicationType.findMany({
    orderBy: { code: 'asc' },
    include: {
      _count: { select: { criteria: true, cases: true } },
    },
  })

  return NextResponse.json(types)
}

const CreateSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  defaultThreshold: z.number().int().min(1).max(10).default(3),
  active: z.boolean().default(true),
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

  try {
    const appType = await db.applicationType.create({
      data: parsed.data,
      include: {
        _count: { select: { criteria: true, cases: true } },
      },
    })
    return NextResponse.json(appType, { status: 201 })
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
      return NextResponse.json(
        { error: 'Application type code already exists' },
        { status: 409 }
      )
    }
    throw e
  }
}
