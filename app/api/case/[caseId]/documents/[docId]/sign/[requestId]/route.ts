import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { archiveSubmission } from '@/lib/docuseal'

type Params = {
  params: Promise<{ caseId: string; docId: string; requestId: string }>
}

async function verifyOwnership(caseId: string, userId: string) {
  const c = await db.case.findUnique({ where: { id: caseId } })
  if (!c || c.userId !== userId) return null
  return c
}

// DELETE - void a signature request
export async function DELETE(_request: Request, { params }: Params) {
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
    where: { id: requestId, documentId: docId, caseId },
  })
  if (!sigReq) {
    return new Response('Signature request not found', { status: 404 })
  }

  if (sigReq.status !== 'PENDING') {
    return NextResponse.json(
      { error: 'Can only void pending requests' },
      { status: 400 }
    )
  }

  // Void on DocuSeal
  try {
    await archiveSubmission(sigReq.docusealSubmissionId)
  } catch (err) {
    console.error('Failed to archive DocuSeal submission:', err)
  }

  await db.signatureRequest.update({
    where: { id: requestId },
    data: { status: 'VOIDED' },
  })

  return NextResponse.json({ success: true })
}
