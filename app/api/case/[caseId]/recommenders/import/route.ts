import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { generateText, Output } from 'ai'
import { google } from '@ai-sdk/google'
import { getPrompt, resolveModel } from '@/lib/agent-prompt'
import type { Prisma } from '@prisma/client'

const FALLBACK_MODEL = 'gemini-2.5-flash'

const RELATIONSHIP_TYPES = [
  'ACADEMIC_ADVISOR',
  'RESEARCH_COLLABORATOR',
  'INDUSTRY_COLLEAGUE',
  'SUPERVISOR',
  'MENTEE',
  'CLIENT',
  'PEER_EXPERT',
  'OTHER',
] as const

const RECOMMENDER_FIELDS = [
  'name',
  'title',
  'organization',
  'email',
  'phone',
  'linkedIn',
  'countryRegion',
  'bio',
  'credentials',
] as const

const MapRequestSchema = z.object({
  action: z.literal('map'),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())).max(50, 'Maximum 50 rows allowed'),
})

const MappedRecommenderSchema = z.object({
  name: z.string().nullable(),
  title: z.string().nullable(),
  organization: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  linkedIn: z.string().nullable(),
  countryRegion: z.string().nullable(),
  bio: z.string().nullable(),
  credentials: z.string().nullable(),
  relationshipType: z.enum(RELATIONSHIP_TYPES).nullable(),
  relationshipContext: z.string().nullable(),
})

const MapOutputSchema = z.object({
  mapping: z.array(
    z.object({
      csvColumn: z.string(),
      field: z.enum([...RECOMMENDER_FIELDS, 'relationshipType']).nullable(),
    })
  ),
  recommenders: z.array(MappedRecommenderSchema),
})

const CreateRecommenderSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  relationshipType: z.enum(RELATIONSHIP_TYPES),
  relationshipContext: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  linkedIn: z.string().optional().nullable(),
  countryRegion: z.string().optional().nullable(),
  organization: z.string().optional().nullable(),
  bio: z.string().optional().nullable(),
  credentials: z.string().optional().nullable(),
})

const CreateRequestSchema = z.object({
  action: z.literal('create'),
  recommenders: z.array(CreateRecommenderSchema),
})

async function getModelConfig() {
  const p = await getPrompt('recommender-extractor')
  return {
    model: p ? resolveModel(p.provider, p.modelName) : google(FALLBACK_MODEL),
  }
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

  const { action } = (body as { action?: string }) ?? {}

  if (action === 'map') {
    const parsed = MapRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { headers, rows } = parsed.data

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No data rows' }, { status: 400 })
    }

    const csvPreview = [headers.join(','), ...rows.map((r) => r.join(','))].join(
      '\n'
    )

    const { model } = await getModelConfig()

    const { output } = await generateText({
      model,
      output: Output.object({ schema: MapOutputSchema }),
      system: `You map CSV columns to recommender fields and extract structured data. Do not use emojis.

Available fields to map to: ${RECOMMENDER_FIELDS.join(', ')}, relationshipType
Relationship types: ${RELATIONSHIP_TYPES.join(', ')}

For each CSV column, determine which recommender field it maps to (or null if no match).
Then for each row, produce a recommender object with all fields filled from the CSV data.
For relationshipType: infer from available context (title, org, etc). Default to OTHER if unclear.
For relationshipContext: generate a brief sentence describing how this person could serve as a recommender, based on their name, title, organization, and role. Example: "Senior colleague at Google who supervised AI research projects."`,
      prompt: `Map these CSV columns and extract recommender data:\n\n${csvPreview}`,
    })

    if (!output) {
      return NextResponse.json(
        { error: 'Failed to map columns' },
        { status: 500 }
      )
    }

    return NextResponse.json(output)
  }

  if (action === 'create') {
    const parsed = CreateRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const data: Prisma.RecommenderCreateManyInput[] = parsed.data.recommenders.map(
      (r) => ({
        caseId,
        name: r.name,
        title: r.title,
        relationshipType: r.relationshipType,
        relationshipContext: r.relationshipContext,
        email: r.email ?? null,
        phone: r.phone ?? null,
        linkedIn: r.linkedIn ?? null,
        countryRegion: r.countryRegion ?? null,
        organization: r.organization ?? null,
        bio: r.bio ?? null,
        credentials: r.credentials ?? null,
      })
    )

    const result = await db.recommender.createMany({ data })

    return NextResponse.json({ created: result.count }, { status: 201 })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
