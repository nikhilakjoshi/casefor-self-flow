import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { downloadFromS3 } from '@/lib/s3'
import {
  isDocuSealConfigured,
  createSubmissionFromPdf,
} from '@/lib/docuseal'
import { markdownToPdf } from '@/lib/pdf-utils'

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

  // Get PDF bytes -- either from S3 or by converting markdown to PDF
  let pdfBytes: Uint8Array

  if (doc.type === 'MARKDOWN') {
    if (!doc.content) {
      return NextResponse.json(
        { error: 'Markdown document has no content' },
        { status: 400 }
      )
    }
    pdfBytes = await markdownToPdf(doc.content, doc.name)
  } else if (doc.s3Key) {
    pdfBytes = await downloadFromS3(doc.s3Key)
  } else {
    return NextResponse.json(
      { error: 'Document has no file content' },
      { status: 400 }
    )
  }

  const fileBase64 = Buffer.from(pdfBytes).toString('base64')

  // Create DocuSeal template + submission
  const submission = await createSubmissionFromPdf(
    doc.name,
    fileBase64,
    signers.map((s) => ({
      email: s.email,
      name: s.name,
      role: s.role || 'First Party',
    }))
  )

  // DocuSeal /submissions returns an array of submitter objects directly
  const submitters = Array.isArray(submission) ? submission : submission.submitters ?? [submission]
  const submissionId = submitters[0]?.submission_id ?? submitters[0]?.id

  // Store SignatureRequest + Signers
  const signatureRequest = await db.signatureRequest.create({
    data: {
      caseId,
      documentId: docId,
      docusealSubmissionId: submissionId,
      sentByUserId: session.user.id,
      signers: {
        create: submitters.map((sub: Record<string, unknown>) => ({
          docusealSubmitterId: sub.id as number,
          slug: (sub.slug as string) || '',
          role: (sub.role as string) || 'First Party',
          email: (sub.email as string) || '',
          name: (sub.name as string) || '',
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
