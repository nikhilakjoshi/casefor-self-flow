import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const UpdateSchema = z.object({
  status: z.enum(['SCREENING', 'ACTIVE', 'EVIDENCE', 'CLOSED']).optional(),
  name: z.string().min(1).max(100).optional(),
}).refine(data => data.status || data.name, {
  message: 'At least one field (status or name) is required',
})

export async function PATCH(
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

  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || 'Invalid request' },
      { status: 400 }
    )
  }

  const { status, name } = parsed.data

  const updated = await db.case.update({
    where: { id: caseId },
    data: {
      ...(status && { status }),
      ...(name !== undefined && { name }),
    },
  })

  return NextResponse.json({ success: true, status: updated.status, name: updated.name })
}

export async function DELETE(
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

  await db.case.delete({
    where: { id: caseId },
  })

  return NextResponse.json({ success: true })
}
