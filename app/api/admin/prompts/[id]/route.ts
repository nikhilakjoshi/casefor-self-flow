import { db } from '@/lib/db'
import { invalidateCache } from '@/lib/agent-prompt'
import { NextResponse } from 'next/server'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params

  const prompt = await db.agentPrompt.findUnique({
    where: { id },
    include: {
      versions: {
        orderBy: { version: 'desc' },
        take: 20,
        select: {
          id: true,
          version: true,
          provider: true,
          modelName: true,
          createdAt: true,
        },
      },
    },
  })
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

  // Create new version if content or model config changed
  const d = parsed.data
  if (d.content || d.provider || d.modelName || d.temperature !== undefined || d.maxTokens !== undefined) {
    const latest = await db.agentPromptVersion.findFirst({
      where: { promptId: id },
      orderBy: { version: 'desc' },
    })
    const nextVersion = (latest?.version ?? 0) + 1
    await db.agentPromptVersion.create({
      data: {
        promptId: id,
        version: nextVersion,
        content: updated.content,
        provider: updated.provider,
        modelName: updated.modelName,
        temperature: updated.temperature,
        maxTokens: updated.maxTokens,
      },
    })
  }

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
