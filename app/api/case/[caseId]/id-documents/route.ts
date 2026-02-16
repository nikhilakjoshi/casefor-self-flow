import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isS3Configured, uploadToS3, buildDocumentKey } from "@/lib/s3"
import { extractFromIdDocument, type IdDocExtraction } from "@/lib/survey-extractor"
import { NextResponse } from "next/server"

const MAX_FILES = 5
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
])

function docTypeForMime(mime: string): "PDF" | "IMAGE" {
  return mime === "application/pdf" ? "PDF" : "IMAGE"
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const session = await auth()
  const { caseId } = await params

  const caseRecord = await db.case.findUnique({ where: { id: caseId } })
  if (!caseRecord) return new Response("Not found", { status: 404 })
  if (caseRecord.userId && caseRecord.userId !== session?.user?.id) {
    return new Response("Not found", { status: 404 })
  }

  if (!isS3Configured()) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const entries: { file: File; docName: string }[] = []

  for (const [key, value] of formData.entries()) {
    if (key.startsWith("file-") && value instanceof File) {
      const docName = formData.get(`name-${key.slice(5)}`) as string | null
      entries.push({ file: value, docName: docName || value.name })
    }
  }

  if (entries.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 })
  }
  if (entries.length > MAX_FILES) {
    return NextResponse.json({ error: `Max ${MAX_FILES} files allowed` }, { status: 400 })
  }

  const results: { fileName: string; documentId: string; success: boolean; error?: string }[] = []
  const extracted: IdDocExtraction = {
    fullName: null,
    dateOfBirth: null,
    countryOfBirth: null,
    citizenship: null,
  }

  for (const { file, docName } of entries) {
    if (!ALLOWED_TYPES.has(file.type)) {
      results.push({ fileName: file.name, documentId: "", success: false, error: "Unsupported file type" })
      continue
    }
    if (file.size > MAX_FILE_SIZE) {
      results.push({ fileName: file.name, documentId: "", success: false, error: "File exceeds 10MB limit" })
      continue
    }

    const document = await db.document.create({
      data: {
        caseId,
        name: docName,
        type: docTypeForMime(file.type),
        source: "USER_UPLOADED",
        category: "PASSPORT_ID",
        status: "FINAL",
      },
    })

    try {
      const buffer = Buffer.from(await file.arrayBuffer())
      const s3Key = buildDocumentKey(caseId, document.id, file.name)
      const { url } = await uploadToS3(s3Key, buffer, file.type)

      await db.document.update({
        where: { id: document.id },
        data: { s3Key, s3Url: url },
      })

      results.push({ fileName: file.name, documentId: document.id, success: true })

      // Extract background fields from ID doc (silently continue on failure)
      try {
        const mediaType = file.type as "application/pdf" | "image/jpeg" | "image/png"
        const fields = await extractFromIdDocument(buffer, mediaType)
        // Merge: later docs fill gaps from earlier ones
        if (fields.fullName && !extracted.fullName) extracted.fullName = fields.fullName
        if (fields.dateOfBirth && !extracted.dateOfBirth) extracted.dateOfBirth = fields.dateOfBirth
        if (fields.countryOfBirth && !extracted.countryOfBirth) extracted.countryOfBirth = fields.countryOfBirth
        if (fields.citizenship && !extracted.citizenship) extracted.citizenship = fields.citizenship
      } catch {
        // Extraction failure is non-fatal; file is already stored
      }
    } catch {
      await db.document.delete({ where: { id: document.id } })
      results.push({ fileName: file.name, documentId: "", success: false, error: "Upload failed" })
    }
  }

  return NextResponse.json({ results, extracted })
}
