import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

type Params = {
  params: Promise<{ caseId: string; docId: string; requestId: string }>
}

async function verifyOwnership(caseId: string, userId: string) {
  const c = await db.case.findUnique({ where: { id: caseId } })
  if (!c || c.userId !== userId) return null
  return c
}

const DOCUSEAL_API_URL =
  process.env.DOCUSEAL_API_URL || 'https://api.docuseal.com'

// POST - resend signing email to pending signers
export async function POST(_request: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { caseId, docId, requestId } = await params
  const caseRecord = await verifyOwnership(caseId, session.user.id)
  if (!caseRecord) {
    return new Response('Not found', { status: 404 })
  }

  const sigReq = await db.signatureRequest.findFirst({
    where: { id: requestId, documentId: docId, caseId, status: 'PENDING' },
    include: { signers: { where: { status: { in: ['PENDING', 'SENT'] } } } },
  })
  if (!sigReq) {
    return NextResponse.json(
      { error: 'No pending signature request found' },
      { status: 404 }
    )
  }

  const apiKey = process.env.DOCUSEAL_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'DocuSeal not configured' },
      { status: 503 }
    )
  }

  // Resend email for each pending signer via DocuSeal API
  const results = await Promise.allSettled(
    sigReq.signers.map(async (signer) => {
      const res = await fetch(
        `${DOCUSEAL_API_URL}/submitters/${signer.docusealSubmitterId}`,
        {
          method: 'PUT',
          headers: {
            'X-Auth-Token': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ send_email: true }),
        }
      )
      if (!res.ok) throw new Error(`Resend failed for ${signer.email}`)
    })
  )

  const sent = results.filter((r) => r.status === 'fulfilled').length

  return NextResponse.json({ sent, total: sigReq.signers.length })
}
