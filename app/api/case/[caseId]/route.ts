import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const StatusSchema = z.object({
  status: z.enum(['SCREENING', 'ACTIVE', 'EVIDENCE', 'CLOSED']),
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

  const parsed = StatusSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'status must be one of: SCREENING, ACTIVE, EVIDENCE, CLOSED' },
      { status: 400 }
    )
  }

  const { status } = parsed.data

  await db.case.update({
    where: { id: caseId },
    data: { status },
  })

  return NextResponse.json({ success: true, status })
}
