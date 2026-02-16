import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id || !session.user.email) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { token } = await request.json()
  if (!token) {
    return NextResponse.json({ error: 'token required' }, { status: 400 })
  }

  const share = await db.documentShare.findUnique({ where: { token } })
  if (!share) {
    return NextResponse.json({ error: 'Invalid invitation' }, { status: 404 })
  }

  if (share.status === 'REVOKED') {
    return NextResponse.json({ error: 'Invitation revoked' }, { status: 410 })
  }

  if (share.status === 'ACCEPTED' && share.inviteeId) {
    // Already accepted - just return the share
    return NextResponse.json({ shareId: share.id, alreadyAccepted: true })
  }

  // Check email matches
  if (share.inviteeEmail.toLowerCase() !== session.user.email.toLowerCase()) {
    return NextResponse.json(
      { error: 'This invitation was sent to a different email address' },
      { status: 403 }
    )
  }

  // Accept
  await db.documentShare.update({
    where: { id: share.id },
    data: { status: 'ACCEPTED', inviteeId: session.user.id },
  })

  return NextResponse.json({ shareId: share.id })
}
