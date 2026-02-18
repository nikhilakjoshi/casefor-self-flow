import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { isS3Configured, downloadFromS3 } from '@/lib/s3'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { generateSeparatorPage } from '@/lib/exhibit-separator'
import { addPageNumbers } from '@/lib/pdf-numbering'
import { markdownToPdf } from '@/lib/pdf-utils'
import { assemblePackage } from '@/lib/package-assembly'
import type { PackageStructure, PackageExhibit } from '@/lib/package-assembly'

async function generateTocPage(
  exhibits: PackageExhibit[],
  pageMap: Map<string, number>
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold)

  const pageWidth = 612
  const pageHeight = 792
  const margin = 72
  const lineHeight = 20

  const page = doc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  // Title
  const title = 'TABLE OF CONTENTS'
  const titleWidth = boldFont.widthOfTextAtSize(title, 16)
  page.drawText(title, {
    x: (pageWidth - titleWidth) / 2,
    y,
    size: 16,
    font: boldFont,
    color: rgb(0, 0, 0),
  })
  y -= lineHeight * 2

  for (const exhibit of exhibits) {
    if (y < margin + lineHeight) {
      // Would need multi-page TOC for very large packages -- skip for now
      break
    }

    const label = `Exhibit ${exhibit.label}`
    const text = `${label} - ${exhibit.title}`
    const pageNum = pageMap.get(exhibit.label)
    const pageText = pageNum != null ? `${pageNum}` : ''

    page.drawText(text, { x: margin, y, size: 11, font: boldFont, color: rgb(0, 0, 0) })

    if (pageText) {
      const numWidth = font.widthOfTextAtSize(pageText, 11)
      page.drawText(pageText, {
        x: pageWidth - margin - numWidth,
        y,
        size: 11,
        font,
        color: rgb(0.4, 0.4, 0.4),
      })
    }

    y -= lineHeight

    // List docs under this exhibit
    for (const d of exhibit.documents) {
      if (y < margin + lineHeight) break
      page.drawText(`    ${d.name}`, { x: margin + 16, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) })
      y -= lineHeight * 0.8
    }

    y -= 4
  }

  return doc.save()
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
    select: { id: true, userId: true, name: true },
  })

  if (!caseRecord || caseRecord.userId !== session.user.id) {
    return new Response('Not found', { status: 404 })
  }

  // Optionally use a saved version
  const body = await request.json().catch(() => ({}))
  let structure: PackageStructure

  if (body.versionId) {
    const pv = await db.packageVersion.findFirst({
      where: { id: body.versionId, caseId },
    })
    if (!pv) return new Response('Version not found', { status: 404 })
    structure = pv.data as unknown as PackageStructure
  } else {
    structure = await assemblePackage(caseId)
  }

  if (structure.exhibits.length === 0) {
    return Response.json({ error: 'No exhibits to export.' }, { status: 400 })
  }

  // Fetch all referenced documents
  const allDocIds = structure.exhibits.flatMap((e) => e.documents.map((d) => d.documentId))
  const docs = await db.document.findMany({
    where: { id: { in: allDocIds } },
    select: { id: true, name: true, type: true, content: true, s3Key: true },
  })
  const docMap = new Map(docs.map((d) => [d.id, d]))

  // Pass 1: build merged PDF (without TOC) to get page counts per exhibit
  const contentPdf = await PDFDocument.create()
  const exhibitPageStart = new Map<string, number>()

  for (const exhibit of structure.exhibits) {
    const separatorLabel = `Exhibit ${exhibit.label} - ${exhibit.title}`
    const separatorBytes = await generateSeparatorPage(separatorLabel)
    const separatorDoc = await PDFDocument.load(separatorBytes)
    const [separatorPage] = await contentPdf.copyPages(separatorDoc, [0])

    exhibitPageStart.set(exhibit.label, contentPdf.getPageCount() + 1) // 1-indexed, will offset by TOC pages
    contentPdf.addPage(separatorPage)

    for (const ref of exhibit.documents) {
      const doc = docMap.get(ref.documentId)
      if (!doc) continue

      // Use frozen snapshot for system-generated docs in saved versions
      const content = structure.letterSnapshots?.[ref.documentId] ?? doc.content

      let pdfBytes: Uint8Array | null = null

      if (doc.type === 'PDF' && doc.s3Key && isS3Configured()) {
        try { pdfBytes = await downloadFromS3(doc.s3Key) } catch { continue }
      } else if (doc.type === 'DOCX' && doc.s3Key && isS3Configured()) {
        // DOCX -> markdown -> PDF via mammoth
        try {
          const docxBytes = await downloadFromS3(doc.s3Key)
          const mammoth = await import('mammoth')
          const result = await mammoth.extractRawText({ buffer: Buffer.from(docxBytes) })
          pdfBytes = await markdownToPdf(result.value, doc.name)
        } catch { continue }
      } else if (content) {
        pdfBytes = await markdownToPdf(content, doc.name)
      } else {
        continue
      }

      try {
        const docPdf = await PDFDocument.load(pdfBytes)
        const pageIndices = docPdf.getPageIndices()
        const copiedPages = await contentPdf.copyPages(docPdf, pageIndices)
        for (const page of copiedPages) contentPdf.addPage(page)
      } catch { continue }
    }
  }

  if (contentPdf.getPageCount() === 0) {
    return Response.json({ error: 'No document content could be assembled.' }, { status: 400 })
  }

  // Pass 2: generate TOC, then prepend it
  const tocBytes = await generateTocPage(structure.exhibits, exhibitPageStart)
  const tocDoc = await PDFDocument.load(tocBytes)
  const tocPageCount = tocDoc.getPageCount()

  // Adjust page numbers to account for TOC pages
  const adjustedPageMap = new Map<string, number>()
  for (const [label, pageNum] of exhibitPageStart) {
    adjustedPageMap.set(label, pageNum + tocPageCount)
  }

  // Regenerate TOC with corrected page numbers
  const finalTocBytes = await generateTocPage(structure.exhibits, adjustedPageMap)
  const finalTocDoc = await PDFDocument.load(finalTocBytes)

  // Build final PDF: TOC + content
  const finalPdf = await PDFDocument.create()

  const tocPages = await finalPdf.copyPages(finalTocDoc, finalTocDoc.getPageIndices())
  for (const p of tocPages) finalPdf.addPage(p)

  const contentPages = await finalPdf.copyPages(contentPdf, contentPdf.getPageIndices())
  for (const p of contentPages) finalPdf.addPage(p)

  // Add page numbers
  const mergedBytes = await finalPdf.save()
  const numberedBytes = await addPageNumbers(new Uint8Array(mergedBytes))

  const caseName = caseRecord.name || caseId
  const filename = `${caseName.replace(/[^a-zA-Z0-9-_]/g, '_')}_package.pdf`

  return new Response(Buffer.from(numberedBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': numberedBytes.length.toString(),
    },
  })
}
