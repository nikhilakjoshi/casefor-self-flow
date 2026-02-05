import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { caseId } = await params

  // Verify user owns this case
  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
  })

  if (!caseRecord || caseRecord.userId !== session.user.id) {
    return new Response('Not found', { status: 404 })
  }

  const analysis = await db.eB1AAnalysis.findFirst({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
  })

  if (!analysis) {
    return NextResponse.json(null)
  }

  return NextResponse.json({
    id: analysis.id,
    criteria: analysis.criteria,
    strongCount: analysis.strongCount,
    weakCount: analysis.weakCount,
    createdAt: analysis.createdAt,
    version: analysis.version,
  })
}
