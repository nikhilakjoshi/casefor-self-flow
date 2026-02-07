import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'

const CreateRecommenderSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  relationshipType: z.enum([
    'ACADEMIC_ADVISOR',
    'RESEARCH_COLLABORATOR',
    'INDUSTRY_COLLEAGUE',
    'SUPERVISOR',
    'MENTEE',
    'CLIENT',
    'PEER_EXPERT',
    'OTHER',
  ]),
  relationshipContext: z.string().min(1),
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
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { caseId } = await params

  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
  })

  if (!caseRecord || caseRecord.userId !== session.user.id) {
    return new Response('Not found', { status: 404 })
  }

  const recommenders = await db.recommender.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(recommenders)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { caseId } = await params

  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
  })

  if (!caseRecord || caseRecord.userId !== session.user.id) {
    return new Response('Not found', { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = CreateRecommenderSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: result.error.flatten() },
      { status: 400 }
    )
  }

  const data = result.data
  const recommender = await db.recommender.create({
    data: {
      caseId,
      name: data.name,
      title: data.title,
      relationshipType: data.relationshipType,
      relationshipContext: data.relationshipContext,
      email: data.email ?? null,
      phone: data.phone ?? null,
      linkedIn: data.linkedIn ?? null,
      countryRegion: data.countryRegion ?? null,
      organization: data.organization ?? null,
      bio: data.bio ?? null,
      credentials: data.credentials ?? null,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      durationYears: data.durationYears ?? null,
      ...(data.contextNotes && { contextNotes: data.contextNotes as Prisma.InputJsonValue }),
    },
  })

  return NextResponse.json(recommender, { status: 201 })
}
