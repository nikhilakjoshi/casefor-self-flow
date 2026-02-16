import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { sendShareInvitationEmail } from '@/lib/email'
import type { SharePermission } from '@prisma/client'

type Params = { params: Promise<{ caseId: string; docId: string }> }

async function verifyOwnership(caseId: string, userId: string) {
  const c = await db.case.findUnique({ where: { id: caseId } })
  if (!c || c.userId !== userId) return null
  return c
}

// POST - create share invitation
export async function POST(request: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { caseId, docId } = await params
  const caseRecord = await verifyOwnership(caseId, session.user.id)
  if (!caseRecord) {
    return new Response('Not found', { status: 404 })
  }

  const doc = await db.document.findFirst({ where: { id: docId, caseId } })
  if (!doc) {
    return new Response('Document not found', { status: 404 })
  }

  const body = await request.json()
  const { email, permission } = body as { email: string; permission: SharePermission }

  if (!email || !permission) {
    return NextResponse.json({ error: 'email and permission required' }, { status: 400 })
  }

  if (!['VIEW', 'EDIT', 'FULL'].includes(permission)) {
    return NextResponse.json({ error: 'invalid permission' }, { status: 400 })
  }

  // Check if invitee already has an account
  const invitee = await db.user.findUnique({ where: { email } })

  const token = randomBytes(32).toString('hex')

  // Upsert: update permission if already shared to this email+doc
  const share = await db.documentShare.upsert({
    where: { documentId_inviteeEmail: { documentId: docId, inviteeEmail: email } },
    update: {
      permission,
      status: invitee ? 'ACCEPTED' : 'PENDING',
      inviteeId: invitee?.id ?? null,
    },
    create: {
      documentId: docId,
      caseId,
      inviterId: session.user.id,
      inviteeEmail: email,
      inviteeId: invitee?.id ?? null,
      permission,
      status: invitee ? 'ACCEPTED' : 'PENDING',
      token,
    },
  })

  // Send invitation email
  try {
    await sendShareInvitationEmail({
      to: email,
      inviterName: session.user.name || session.user.email || 'Someone',
      documentName: doc.name,
      caseName: caseRecord.name || `Case ${caseRecord.id.slice(-6)}`,
      permission,
      token: share.token,
    })
  } catch (err) {
    console.error('Failed to send share invitation email:', err)
  }

  return NextResponse.json(share)
}

// GET - list shares for document
export async function GET(_request: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { caseId, docId } = await params
  const caseRecord = await verifyOwnership(caseId, session.user.id)
  if (!caseRecord) {
    return new Response('Not found', { status: 404 })
  }

  const shares = await db.documentShare.findMany({
    where: { documentId: docId, caseId, status: { not: 'REVOKED' } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      token: true,
      inviteeEmail: true,
      permission: true,
      status: true,
      createdAt: true,
      invitee: { select: { name: true, image: true } },
    },
  })

  return NextResponse.json(shares)
}
