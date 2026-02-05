import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import {
  isS3Configured,
  uploadToS3,
  buildDocumentKey,
} from '@/lib/s3'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { caseId } = await params

  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
  })

  if (!caseRecord || caseRecord.userId !== session.user.id) {
    return new Response('Not found', { status: 404 })
  }

  const documents = await db.document.findMany({
    where: { caseId },
    select: {
      id: true,
      name: true,
      type: true,
      source: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(documents)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { caseId } = await params

  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
  })

  if (!caseRecord || caseRecord.userId !== session.user.id) {
    return new Response('Not found', { status: 404 })
  }

  const contentType = request.headers.get('content-type') || ''

  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json(
      { error: 'Expected multipart/form-data' },
      { status: 400 }
    )
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const ext = file.name.toLowerCase().split('.').pop()
  let docType: 'MARKDOWN' | 'DOCX' | 'PDF'
  if (ext === 'md' || ext === 'markdown') {
    docType = 'MARKDOWN'
  } else if (ext === 'docx') {
    docType = 'DOCX'
  } else if (ext === 'pdf') {
    docType = 'PDF'
  } else {
    return NextResponse.json(
      { error: 'Unsupported file type. Accepted: PDF, DOCX, MD' },
      { status: 400 }
    )
  }

  // Create document record first to get ID for S3 key
  const document = await db.document.create({
    data: {
      caseId,
      name: file.name,
      type: docType,
      source: 'USER_UPLOADED',
      status: 'DRAFT',
    },
  })

  // Upload to S3 if configured; otherwise store inline for markdown
  if (isS3Configured()) {
    const key = buildDocumentKey(caseId, document.id, file.name)
    const buffer = Buffer.from(await file.arrayBuffer())
    const { url } = await uploadToS3(key, buffer, file.type)

    await db.document.update({
      where: { id: document.id },
      data: { s3Key: key, s3Url: url },
    })

    return NextResponse.json({
      ...document,
      s3Key: key,
      s3Url: url,
    })
  }

  // No S3: store inline content for markdown files
  if (docType === 'MARKDOWN') {
    const text = await file.text()
    await db.document.update({
      where: { id: document.id },
      data: { content: text },
    })

    return NextResponse.json({ ...document, content: text })
  }

  // Non-markdown without S3: record exists but no content stored
  return NextResponse.json(document)
}
