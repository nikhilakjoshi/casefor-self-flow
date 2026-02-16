import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET - list all docs shared with current user
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const shares = await db.documentShare.findMany({
    where: { inviteeId: session.user.id, status: 'ACCEPTED' },
    orderBy: { updatedAt: 'desc' },
    include: {
      document: {
        select: {
          id: true,
          name: true,
          category: true,
          status: true,
          updatedAt: true,
        },
      },
      inviter: {
        select: { name: true, email: true },
      },
    },
  })

  // Also fetch case names
  const caseIds = [...new Set(shares.map((s) => s.caseId))]
  const cases = await db.case.findMany({
    where: { id: { in: caseIds } },
    select: { id: true, name: true },
  })
  const caseMap = new Map(cases.map((c) => [c.id, c.name]))

  return NextResponse.json(
    shares.map((s) => ({
      id: s.id,
      permission: s.permission,
      document: s.document,
      caseName: caseMap.get(s.caseId) || `Case ${s.caseId.slice(-6)}`,
      inviter: s.inviter,
      updatedAt: s.updatedAt,
    }))
  )
}
