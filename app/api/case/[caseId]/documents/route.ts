import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import {
  isS3Configured,
  uploadToS3,
  buildDocumentKey,
} from '@/lib/s3'
import type { DocumentCategory } from '@prisma/client'
import { classifyDocument } from '@/lib/document-classifier'

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
      category: true,
      classificationConfidence: true,
      recommenderId: true,
      createdAt: true,
      _count: { select: { evidenceVerifications: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(
    documents.map((d) => ({
      ...d,
      evidenceVerificationCount: d._count.evidenceVerifications,
      _count: undefined,
    }))
  )
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
  const context = (formData.get('context') as string | null)?.trim() || null
  const categoryOverride = (formData.get('category') as string | null)?.trim() || null
  const classifySync = formData.get('classifySync') === 'true'

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
      ...(categoryOverride && { category: categoryOverride as DocumentCategory }),
    },
  })

  // Upload to S3 if configured; otherwise store inline for markdown
  if (isS3Configured()) {
    const key = buildDocumentKey(caseId, document.id, file.name)
    const buffer = Buffer.from(await file.arrayBuffer())
    const { url } = await uploadToS3(key, buffer, file.type)

    await db.document.update({
      where: { id: document.id },
      data: {
        s3Key: key,
        s3Url: url,
        ...(context && { content: `[User context]: ${context}` }),
      },
    })

    if (!categoryOverride) {
      if (classifySync) {
        const result = await classifyDocument(document.id, file.name, context)
        return NextResponse.json({
          ...document,
          s3Key: key,
          s3Url: url,
          category: result?.category || document.category,
          classificationConfidence: result?.confidence ?? null,
        })
      }
      classifyDocument(document.id, file.name, context).catch(() => {})
    }

    return NextResponse.json({
      ...document,
      s3Key: key,
      s3Url: url,
      category: categoryOverride || document.category,
    })
  }

  // No S3: store inline content for markdown files
  if (docType === 'MARKDOWN') {
    const text = await file.text()
    const fullContent = context ? `${text}\n\n---\n[User context]: ${context}` : text
    await db.document.update({
      where: { id: document.id },
      data: { content: fullContent },
    })

    if (!categoryOverride) {
      if (classifySync) {
        const result = await classifyDocument(document.id, file.name, fullContent)
        return NextResponse.json({
          ...document,
          content: fullContent,
          category: result?.category || document.category,
          classificationConfidence: result?.confidence ?? null,
        })
      }
      classifyDocument(document.id, file.name, fullContent).catch(() => {})
    }

    return NextResponse.json({ ...document, content: fullContent })
  }

  // Non-markdown without S3: store context if provided
  if (context) {
    await db.document.update({
      where: { id: document.id },
      data: { content: `[User context]: ${context}` },
    })
  }

  if (!categoryOverride) {
    if (classifySync) {
      const result = await classifyDocument(document.id, file.name, context)
      return NextResponse.json({
        ...document,
        category: result?.category || document.category,
        classificationConfidence: result?.confidence ?? null,
      })
    }
    classifyDocument(document.id, file.name, context).catch(() => {})
  }

  return NextResponse.json(document)
}
