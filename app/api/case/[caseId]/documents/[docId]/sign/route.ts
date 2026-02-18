import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { downloadFromS3 } from '@/lib/s3'
import {
  isDocuSealConfigured,
  createSubmissionFromPdf,
} from '@/lib/docuseal'

type Params = { params: Promise<{ caseId: string; docId: string }> }

async function verifyOwnership(caseId: string, userId: string) {
  const c = await db.case.findUnique({ where: { id: caseId } })
  if (!c || c.userId !== userId) return null
  return c
}

// POST - create signature request
export async function POST(request: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  if (!isDocuSealConfigured()) {
    return NextResponse.json(
      { error: 'DocuSeal not configured' },
      { status: 503 }
    )
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

  if (doc.status !== 'FINAL') {
    return NextResponse.json(
      { error: 'Document must be FINAL to request signatures' },
      { status: 400 }
    )
  }

  if (!doc.s3Key) {
    return NextResponse.json(
      { error: 'Document has no S3 file' },
      { status: 400 }
    )
  }

  // Check for existing pending request
  const existing = await db.signatureRequest.findFirst({
    where: { documentId: docId, status: 'PENDING' },
  })
  if (existing) {
    return NextResponse.json(
      { error: 'A pending signature request already exists for this document' },
      { status: 409 }
    )
  }

  const body = await request.json()
  const { signers } = body as {
    signers: Array<{ email: string; name: string; role?: string }>
  }

  if (!signers || signers.length === 0) {
    return NextResponse.json(
      { error: 'At least one signer required' },
      { status: 400 }
    )
  }

  // Download PDF from S3 and convert to base64
  const fileBytes = await downloadFromS3(doc.s3Key)
  const fileBase64 = Buffer.from(fileBytes).toString('base64')

  // Create DocuSeal submission
  const submission = await createSubmissionFromPdf(
    doc.name,
    fileBase64,
    signers.map((s) => ({
      email: s.email,
      name: s.name,
      role: s.role || 'Signer',
    }))
  )

  // Store SignatureRequest + Signers
  const signatureRequest = await db.signatureRequest.create({
    data: {
      caseId,
      documentId: docId,
      docusealSubmissionId: submission.id,
      sentByUserId: session.user.id,
      signers: {
        create: submission.submitters.map((sub) => ({
          docusealSubmitterId: sub.id,
          slug: sub.slug,
          role: sub.role || 'Signer',
          email: sub.email,
          name: sub.name || '',
          status: 'PENDING',
        })),
      },
    },
    include: { signers: true },
  })

  return NextResponse.json(signatureRequest)
}

// GET - list signature requests for document
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

  const requests = await db.signatureRequest.findMany({
    where: { documentId: docId, caseId },
    include: { signers: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(requests)
}
