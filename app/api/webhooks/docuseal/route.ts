import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { uploadToS3, buildDocumentKey } from '@/lib/s3'

// Verify webhook authenticity via shared secret
function verifyWebhook(request: Request): boolean {
  const secret = process.env.DOCUSEAL_WEBHOOK_SECRET
  if (!secret) return true // skip verification if no secret configured
  const header = request.headers.get('x-docuseal-webhook-secret')
  return header === secret
}

export async function POST(request: Request) {
  if (!verifyWebhook(request)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = await request.json()
  const { event_type, data } = body

  try {
    switch (event_type) {
      case 'form.completed': {
        // A single signer completed their form
        const submitterId = data.id as number
        const signer = await db.signer.findUnique({
          where: { docusealSubmitterId: submitterId },
          include: { signatureRequest: { include: { signers: true } } },
        })
        if (!signer) break

        await db.signer.update({
          where: { id: signer.id },
          data: { status: 'COMPLETED', signedAt: new Date() },
        })

        // Check if all signers completed
        const allSigners = signer.signatureRequest.signers
        const othersCompleted = allSigners
          .filter((s) => s.id !== signer.id)
          .every((s) => s.status === 'COMPLETED')

        if (othersCompleted) {
          await db.signatureRequest.update({
            where: { id: signer.signatureRequestId },
            data: { status: 'COMPLETED', completedAt: new Date() },
          })
        }
        break
      }

      case 'submission.completed': {
        // Full submission completed -- download signed PDF
        const submissionId = data.id as number
        const sigReq = await db.signatureRequest.findUnique({
          where: { docusealSubmissionId: submissionId },
          include: { document: true },
        })
        if (!sigReq) break

        await db.signatureRequest.update({
          where: { id: sigReq.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            auditLogUrl: data.audit_log_url || null,
          },
        })

        // Download signed PDF from DocuSeal and store in S3
        const documents = data.documents as
          | Array<{ name: string; url: string }>
          | undefined
        if (documents && documents.length > 0) {
          const signedPdfUrl = documents[0].url
          const pdfRes = await fetch(signedPdfUrl)
          if (pdfRes.ok) {
            const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())
            const signedDocName = `${sigReq.document.name} - Signed`
            const signedFileName = `${signedDocName}.pdf`

            // Create new Document record for signed copy
            const signedDoc = await db.document.create({
              data: {
                caseId: sigReq.caseId,
                name: signedDocName,
                type: 'PDF',
                source: 'SYSTEM_GENERATED',
                status: 'FINAL',
                category: sigReq.document.category,
              },
            })

            const s3Key = buildDocumentKey(
              sigReq.caseId,
              signedDoc.id,
              signedFileName
            )
            const { url } = await uploadToS3(s3Key, pdfBuffer, 'application/pdf')

            await db.document.update({
              where: { id: signedDoc.id },
              data: { s3Key, s3Url: url },
            })

            // Store signed doc reference on the signature request
            await db.signatureRequest.update({
              where: { id: sigReq.id },
              data: { signedDocumentS3Key: s3Key, signedDocumentS3Url: url },
            })

            // Copy criterion routings from original doc to signed doc
            const routings = await db.documentCriterionRouting.findMany({
              where: { documentId: sigReq.documentId },
            })
            if (routings.length > 0) {
              await db.documentCriterionRouting.createMany({
                data: routings.map((r) => ({
                  documentId: signedDoc.id,
                  criterion: r.criterion,
                  score: r.score,
                  recommendation: r.recommendation,
                })),
              })
            }
          }
        }
        break
      }

      case 'form.declined': {
        const submitterId = data.id as number
        const signer = await db.signer.findUnique({
          where: { docusealSubmitterId: submitterId },
        })
        if (!signer) break

        await db.signer.update({
          where: { id: signer.id },
          data: { status: 'DECLINED' },
        })

        await db.signatureRequest.update({
          where: { id: signer.signatureRequestId },
          data: { status: 'DECLINED' },
        })
        break
      }

      case 'form.opened': {
        const submitterId = data.id as number
        const signer = await db.signer.findUnique({
          where: { docusealSubmitterId: submitterId },
        })
        if (!signer) break

        if (signer.status === 'PENDING' || signer.status === 'SENT') {
          await db.signer.update({
            where: { id: signer.id },
            data: { status: 'OPENED' },
          })
        }
        break
      }
    }
  } catch (err) {
    console.error('DocuSeal webhook error:', err)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
