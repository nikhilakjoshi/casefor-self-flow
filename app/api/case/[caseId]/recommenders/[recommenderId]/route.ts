import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

type Params = { params: Promise<{ caseId: string; recommenderId: string }> }

async function verifyOwnership(caseId: string, userId: string) {
  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
  })
  if (!caseRecord || caseRecord.userId !== userId) return null
  return caseRecord
}

export async function GET(_request: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { caseId, recommenderId } = await params

  if (!(await verifyOwnership(caseId, session.user.id))) {
    return new Response('Not found', { status: 404 })
  }

  const recommender = await db.recommender.findUnique({
    where: { id: recommenderId, caseId },
    include: { documents: true },
  })

  if (!recommender) {
    return new Response('Not found', { status: 404 })
  }

  return NextResponse.json(recommender)
}

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  relationshipType: z
    .enum([
      'ACADEMIC_ADVISOR',
      'RESEARCH_COLLABORATOR',
      'INDUSTRY_COLLEAGUE',
      'SUPERVISOR',
      'MENTEE',
      'CLIENT',
      'PEER_EXPERT',
      'OTHER',
    ])
    .optional(),
  relationshipContext: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  linkedIn: z.string().optional().nullable(),
  countryRegion: z.string().optional().nullable(),
  organization: z.string().optional().nullable(),
  bio: z.string().optional().nullable(),
  credentials: z.string().optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  durationYears: z.number().optional().nullable(),
  contextNotes: z.record(z.string(), z.unknown()).optional().nullable(),
  criteriaKeys: z.array(z.string()).optional(),
})

export async function PATCH(request: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { caseId, recommenderId } = await params

  if (!(await verifyOwnership(caseId, session.user.id))) {
    return new Response('Not found', { status: 404 })
  }

  const recommender = await db.recommender.findUnique({
    where: { id: recommenderId, caseId },
  })

  if (!recommender) {
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
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data
  const updateData: Prisma.RecommenderUpdateInput = {}

  if (data.name !== undefined) updateData.name = data.name
  if (data.title !== undefined) updateData.title = data.title
  if (data.relationshipType !== undefined) updateData.relationshipType = data.relationshipType
  if (data.relationshipContext !== undefined) updateData.relationshipContext = data.relationshipContext
  if (data.email !== undefined) updateData.email = data.email
  if (data.phone !== undefined) updateData.phone = data.phone
  if (data.linkedIn !== undefined) updateData.linkedIn = data.linkedIn
  if (data.countryRegion !== undefined) updateData.countryRegion = data.countryRegion
  if (data.organization !== undefined) updateData.organization = data.organization
  if (data.bio !== undefined) updateData.bio = data.bio
  if (data.credentials !== undefined) updateData.credentials = data.credentials
  if (data.startDate !== undefined) {
    updateData.startDate = data.startDate ? new Date(data.startDate) : null
  }
  if (data.endDate !== undefined) {
    updateData.endDate = data.endDate ? new Date(data.endDate) : null
  }
  if (data.durationYears !== undefined) updateData.durationYears = data.durationYears
  if (data.contextNotes !== undefined) {
    updateData.contextNotes = data.contextNotes as Prisma.InputJsonValue ?? Prisma.DbNull
  }
  if (data.criteriaKeys !== undefined) updateData.criteriaKeys = data.criteriaKeys

  const updated = await db.recommender.update({
    where: { id: recommenderId },
    data: updateData,
  })

  return NextResponse.json(updated)
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { caseId, recommenderId } = await params

  if (!(await verifyOwnership(caseId, session.user.id))) {
    return new Response('Not found', { status: 404 })
  }

  const recommender = await db.recommender.findUnique({
    where: { id: recommenderId, caseId },
  })

  if (!recommender) {
    return new Response('Not found', { status: 404 })
  }

  await db.recommender.delete({
    where: { id: recommenderId },
  })

  return new Response(null, { status: 204 })
}
