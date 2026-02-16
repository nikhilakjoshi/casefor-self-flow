import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getShareAccess } from '@/lib/share-access'

type Params = { params: Promise<{ shareId: string }> }

// GET - get shared doc content
export async function GET(_request: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { shareId } = await params
  const share = await getShareAccess(shareId, session.user.id)
  if (!share) {
    return new Response('Forbidden', { status: 403 })
  }

  const caseRecord = await db.case.findUnique({
    where: { id: share.caseId },
    select: { name: true },
  })

  return NextResponse.json({
    id: share.id,
    permission: share.permission,
    caseName: caseRecord?.name || `Case ${share.caseId.slice(-6)}`,
    document: {
      id: share.document.id,
      name: share.document.name,
      content: share.document.content,
      category: share.document.category,
      status: share.document.status,
    },
    user: { id: session.user.id, name: session.user.name },
  })
}

// PATCH - save edits (EDIT/FULL only)
export async function PATCH(request: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { shareId } = await params
  const share = await getShareAccess(shareId, session.user.id, ['EDIT', 'FULL'])
  if (!share) {
    return new Response('Forbidden', { status: 403 })
  }

  const { content } = await request.json()
  if (typeof content !== 'string') {
    return NextResponse.json({ error: 'content required' }, { status: 400 })
  }

  await db.document.update({
    where: { id: share.documentId },
    data: { content },
  })

  return NextResponse.json({ ok: true })
}
