import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'

export async function GET() {
  const prompts = await db.agentPrompt.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      category: true,
      provider: true,
      modelName: true,
      temperature: true,
      maxTokens: true,
      active: true,
      variables: true,
      updatedAt: true,
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  })

  return NextResponse.json(prompts)
}

const CreateSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.enum(['static', 'dynamic-system', 'dynamic-user']),
  content: z.string().min(1),
  provider: z.enum(['anthropic', 'google']).default('anthropic'),
  modelName: z.string().min(1).default('claude-sonnet-4-20250514'),
  variables: z.array(z.object({
    key: z.string(),
    label: z.string(),
    description: z.string(),
  })).default([]),
  temperature: z.number().min(0).max(2).nullable().optional(),
  maxTokens: z.number().int().positive().nullable().optional(),
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

  const existing = await db.agentPrompt.findUnique({
    where: { slug: parsed.data.slug },
  })
  if (existing) {
    return NextResponse.json({ error: 'Slug already exists' }, { status: 409 })
  }

  const prompt = await db.agentPrompt.create({
    data: {
      ...parsed.data,
      defaultContent: parsed.data.content,
    },
  })

  return NextResponse.json(prompt, { status: 201 })
}
