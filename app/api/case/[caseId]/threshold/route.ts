import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const ThresholdSchema = z.object({
  threshold: z.number().int().min(1).max(10),
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

  const parsed = ThresholdSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'threshold must be an integer between 1 and 10' },
      { status: 400 }
    )
  }

  const { threshold } = parsed.data

  await db.case.update({
    where: { id: caseId },
    data: { criteriaThreshold: threshold },
  })

  return NextResponse.json({ success: true, criteriaThreshold: threshold })
}
