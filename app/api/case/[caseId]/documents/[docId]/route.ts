import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  isS3Configured,
  getSignedDownloadUrl,
  deleteFromS3,
} from '@/lib/s3'
import { classifyDocument } from '@/lib/document-classifier'

type Params = { params: Promise<{ caseId: string; docId: string }> }

async function verifyOwnership(caseId: string, userId: string) {
  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
  })
  if (!caseRecord || caseRecord.userId !== userId) return null
  return caseRecord
}

export async function GET(_request: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { caseId, docId } = await params

  if (!await verifyOwnership(caseId, session.user.id)) {
    return new Response('Not found', { status: 404 })
  }

  const document = await db.document.findUnique({
    where: { id: docId, caseId },
  })

  if (!document) {
    return new Response('Not found', { status: 404 })
  }

  let signedUrl: string | null = null
  if (document.s3Key && isS3Configured()) {
    try {
      signedUrl = await getSignedDownloadUrl(document.s3Key)
    } catch {
      // S3 error; return document without signed URL
    }
  }

  return NextResponse.json({ ...document, signedUrl })
}

const PatchSchema = z.object({
  content: z.string().optional(),
  status: z.enum(['DRAFT', 'FINAL']).optional(),
  name: z.string().min(1).optional(),
})

export async function PATCH(request: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { caseId, docId } = await params

  if (!await verifyOwnership(caseId, session.user.id)) {
    return new Response('Not found', { status: 404 })
  }

  const document = await db.document.findUnique({
    where: { id: docId, caseId },
  })

  if (!document) {
    return new Response('Not found', { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid fields. Accepts: content (string), status (DRAFT|FINAL), name (string)' },
      { status: 400 }
    )
  }

  const updated = await db.document.update({
    where: { id: docId },
    data: parsed.data,
  })

  if (parsed.data.content) {
    classifyDocument(docId, updated.name, parsed.data.content).catch(() => {})
  }

  return NextResponse.json(updated)
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { caseId, docId } = await params

  if (!await verifyOwnership(caseId, session.user.id)) {
    return new Response('Not found', { status: 404 })
  }

  const document = await db.document.findUnique({
    where: { id: docId, caseId },
  })

  if (!document) {
    return new Response('Not found', { status: 404 })
  }

  // Delete from S3 if key exists
  if (document.s3Key && isS3Configured()) {
    try {
      await deleteFromS3(document.s3Key)
    } catch {
      // S3 cleanup failed; still delete DB record
    }
  }

  await db.document.delete({
    where: { id: docId },
  })

  return NextResponse.json({ success: true })
}
