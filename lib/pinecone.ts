import { Pinecone } from '@pinecone-database/pinecone'
import { embedTexts } from './embeddings'

const globalForPinecone = globalThis as unknown as {
  pinecone: Pinecone | undefined
}

function getPineconeClient(): Pinecone {
  if (!process.env.PINECONE_API_KEY) {
    throw new Error('PINECONE_API_KEY environment variable is not set')
  }

  if (!globalForPinecone.pinecone) {
    globalForPinecone.pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    })
  }

  return globalForPinecone.pinecone
}

export function getIndex() {
  const indexName = process.env.PINECONE_INDEX
  if (!indexName) {
    throw new Error('PINECONE_INDEX environment variable is not set')
  }

  const client = getPineconeClient()
  return client.index(indexName)
}

export interface UpsertResult {
  vectorIds: string[]
}

/**
 * Upsert text chunks to Pinecone with caseId metadata
 * @param chunks - Array of text chunks to embed and store
 * @param caseId - Case ID to associate with vectors
 * @returns Array of vector IDs that were upserted
 */
export async function upsertChunks(
  chunks: string[],
  caseId: string
): Promise<UpsertResult> {
  if (chunks.length === 0) {
    return { vectorIds: [] }
  }

  const index = getIndex()
  const embeddings = await embedTexts(chunks)

  const vectors = chunks.map((chunk, i) => ({
    id: `${caseId}-${i}-${Date.now()}`,
    values: embeddings[i],
    metadata: {
      caseId,
      text: chunk,
      chunkIndex: i,
    },
  }))

  await index.upsert({ records: vectors })

  return { vectorIds: vectors.map((v) => v.id) }
}

export const pinecone = {
  getClient: getPineconeClient,
  getIndex,
  upsertChunks,
}
