import { db } from '@/lib/db'
import { invalidateCache } from '@/lib/agent-prompt'
import { NextResponse } from 'next/server'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params

  const prompt = await db.agentPrompt.findUnique({ where: { id } })
  if (!prompt) {
    return new Response('Not found', { status: 404 })
  }

  return NextResponse.json(prompt)
}

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  content: z.string().min(1).optional(),
  provider: z.enum(['anthropic', 'google']).optional(),
  modelName: z.string().min(1).optional(),
  temperature: z.number().min(0).max(2).nullable().optional(),
  maxTokens: z.number().int().positive().nullable().optional(),
  active: z.boolean().optional(),
})

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params

  const existing = await db.agentPrompt.findUnique({ where: { id } })
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

  const updated = await db.agentPrompt.update({
    where: { id },
    data: parsed.data,
  })

  invalidateCache(existing.slug)

  return NextResponse.json(updated)
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params

  const existing = await db.agentPrompt.findUnique({ where: { id } })
  if (!existing) {
    return new Response('Not found', { status: 404 })
  }

  await db.agentPrompt.delete({ where: { id } })
  invalidateCache(existing.slug)

  return NextResponse.json({ success: true })
}
