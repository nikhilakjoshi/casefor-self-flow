import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const globalForS3 = globalThis as unknown as {
  s3Client: S3Client | undefined
}

/**
 * Check if all required S3 env vars are present
 */
export function isS3Configured(): boolean {
  return !!(
    process.env.AWS_REGION &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_S3_BUCKET
  )
}

function getS3Client(): S3Client {
  if (!isS3Configured()) {
    throw new Error(
      'S3 not configured. Required env vars: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET'
    )
  }

  if (!globalForS3.s3Client) {
    globalForS3.s3Client = new S3Client({
      region: process.env.AWS_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })
  }

  return globalForS3.s3Client
}

function getBucket(): string {
  const bucket = process.env.AWS_S3_BUCKET
  if (!bucket) throw new Error('AWS_S3_BUCKET env var not set')
  return bucket
}

/**
 * Key convention: cases/{caseId}/documents/{documentId}/{filename}
 */
export function buildDocumentKey(
  caseId: string,
  documentId: string,
  filename: string
): string {
  return `cases/${caseId}/documents/${documentId}/${filename}`
}

export async function uploadToS3(
  key: string,
  body: Buffer | ReadableStream,
  contentType: string
): Promise<{ key: string; url: string }> {
  const client = getS3Client()
  const bucket = getBucket()

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  )

  const url = `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
  return { key, url }
}

export async function getSignedDownloadUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  const client = getS3Client()
  const bucket = getBucket()

  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn }
  )
}

export async function deleteFromS3(key: string): Promise<void> {
  const client = getS3Client()
  const bucket = getBucket()

  await client.send(
    new DeleteObjectCommand({ Bucket: bucket, Key: key })
  )
}
