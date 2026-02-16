import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import type { SharePermission } from '@prisma/client'

type Params = { params: Promise<{ caseId: string; docId: string; shareId: string }> }

async function verifyOwnership(caseId: string, userId: string) {
  const c = await db.case.findUnique({ where: { id: caseId } })
  if (!c || c.userId !== userId) return null
  return c
}

// PATCH - update permission
export async function PATCH(request: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { caseId, shareId } = await params
  if (!await verifyOwnership(caseId, session.user.id)) {
    return new Response('Not found', { status: 404 })
  }

  const body = await request.json()
  const { permission } = body as { permission: SharePermission }

  if (!permission || !['VIEW', 'EDIT', 'FULL'].includes(permission)) {
    return NextResponse.json({ error: 'invalid permission' }, { status: 400 })
  }

  const share = await db.documentShare.update({
    where: { id: shareId },
    data: { permission },
  })

  return NextResponse.json(share)
}

// DELETE - revoke share
export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { caseId, shareId } = await params
  if (!await verifyOwnership(caseId, session.user.id)) {
    return new Response('Not found', { status: 404 })
  }

  await db.documentShare.update({
    where: { id: shareId },
    data: { status: 'REVOKED' },
  })

  return new Response(null, { status: 204 })
}
