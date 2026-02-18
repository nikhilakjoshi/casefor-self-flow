import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { isS3Configured, downloadFromS3 } from '@/lib/s3'
import { PDFDocument } from 'pdf-lib'
import { generateSeparatorPage } from '@/lib/exhibit-separator'
import { addPageNumbers } from '@/lib/pdf-numbering'
import { markdownToPdf } from '@/lib/pdf-utils'

// Assembly order by category -- USCIS filing convention
const CATEGORY_ORDER: string[] = [
  'I140',
  'G28',
  'I907',
  'G1450PPU',
  'G1450300',
  'G1450I40',
  'COVER_LETTER',
  'PETITION_LETTER',
  'PERSONAL_STATEMENT',
  'USCIS_ADVISORY_LETTER',
  'RECOMMENDATION_LETTER',
  'EXECUTIVE_RESUME',
  'RESUME_CV',
  'AWARD_CERTIFICATE',
  'PUBLICATION',
  'MEDIA_COVERAGE',
  'PATENT',
  'MEMBERSHIP_CERTIFICATE',
  'EMPLOYMENT_VERIFICATION',
  'SALARY_DOCUMENTATION',
  'CITATION_REPORT',
  'JUDGING_EVIDENCE',
  'PASSPORT_ID',
  'I20',
  'VISA_STAMP',
  'I797_APPROVAL',
  'I94',
  'DEGREE_CERTIFICATE',
  'OTHER',
]

const CATEGORY_LABELS: Record<string, string> = {
  I140: 'Form I-140',
  G28: 'Form G-28',
  I907: 'Form I-907',
  G1450PPU: 'Form G-1450 (Premium Processing)',
  G1450300: 'Form G-1450 (Filing Fee)',
  G1450I40: 'Form G-1450 (I-40)',
  COVER_LETTER: 'Cover Letter',
  PETITION_LETTER: 'Petition Letter',
  PERSONAL_STATEMENT: 'Personal Statement',
  USCIS_ADVISORY_LETTER: 'USCIS Advisory Letter',
  RECOMMENDATION_LETTER: 'Recommendation Letters',
  EXECUTIVE_RESUME: 'Executive Resume',
  RESUME_CV: 'Resume / CV',
  AWARD_CERTIFICATE: 'Award Certificates',
  PUBLICATION: 'Publications',
  MEDIA_COVERAGE: 'Media Coverage',
  PATENT: 'Patents',
  MEMBERSHIP_CERTIFICATE: 'Membership Certificates',
  EMPLOYMENT_VERIFICATION: 'Employment Verification',
  SALARY_DOCUMENTATION: 'Salary Documentation',
  CITATION_REPORT: 'Citation Reports',
  JUDGING_EVIDENCE: 'Judging Evidence',
  PASSPORT_ID: 'Passport / ID',
  I20: 'I-20 (Certificate of Eligibility)',
  VISA_STAMP: 'Visa Stamps',
  I797_APPROVAL: 'I-797 Approval Notice',
  I94: 'I-94 (Arrival/Departure Record)',
  DEGREE_CERTIFICATE: 'Degree Certificates',
  OTHER: 'Other Documents',
}

export async function POST(
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

  // Fetch all FINAL-status documents
  const documents = await db.document.findMany({
    where: { caseId, status: 'FINAL' },
    select: {
      id: true,
      name: true,
      type: true,
      category: true,
      content: true,
      s3Key: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  if (documents.length === 0) {
    return Response.json(
      { error: 'No finalized documents to assemble. Mark documents as FINAL first.' },
      { status: 400 }
    )
  }

  // Group documents by category, ordered by CATEGORY_ORDER
  const grouped = new Map<string, typeof documents>()
  for (const doc of documents) {
    const cat = doc.category || 'OTHER'
    if (!grouped.has(cat)) grouped.set(cat, [])
    grouped.get(cat)!.push(doc)
  }

  // Sort groups by CATEGORY_ORDER
  const sortedCategories = [...grouped.keys()].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a)
    const bi = CATEGORY_ORDER.indexOf(b)
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })

  // Build merged PDF
  const mergedPdf = await PDFDocument.create()
  let exhibitIndex = 0
  const exhibitLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

  for (const category of sortedCategories) {
    const docs = grouped.get(category)!
    const label = exhibitIndex < exhibitLabels.length
      ? exhibitLabels[exhibitIndex]
      : `${exhibitIndex + 1}`
    const categoryLabel = CATEGORY_LABELS[category] || category
    const separatorLabel = `Exhibit ${label} - ${categoryLabel}`

    // Insert separator page
    const separatorBytes = await generateSeparatorPage(separatorLabel)
    const separatorDoc = await PDFDocument.load(separatorBytes)
    const [separatorPage] = await mergedPdf.copyPages(separatorDoc, [0])
    mergedPdf.addPage(separatorPage)

    // Add each document in the category
    for (const doc of docs) {
      let pdfBytes: Uint8Array | null = null

      if (doc.type === 'PDF' && doc.s3Key && isS3Configured()) {
        try {
          pdfBytes = await downloadFromS3(doc.s3Key)
        } catch {
          // Skip documents that fail to download
          continue
        }
      } else if (doc.content) {
        // Convert markdown/text content to PDF
        pdfBytes = await markdownToPdf(doc.content, doc.name)
      } else {
        // No content available -- skip
        continue
      }

      try {
        const docPdf = await PDFDocument.load(pdfBytes)
        const pageIndices = docPdf.getPageIndices()
        const copiedPages = await mergedPdf.copyPages(docPdf, pageIndices)
        for (const page of copiedPages) {
          mergedPdf.addPage(page)
        }
      } catch {
        // Skip documents that fail to parse as PDF
        continue
      }
    }

    exhibitIndex++
  }

  if (mergedPdf.getPageCount() === 0) {
    return Response.json(
      { error: 'No document content could be assembled. Ensure documents have content or are uploaded to S3.' },
      { status: 400 }
    )
  }

  // Add page numbers to the assembled PDF
  const mergedBytes = await mergedPdf.save()
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
