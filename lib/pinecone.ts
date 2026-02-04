import { Pinecone } from '@pinecone-database/pinecone'

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

export const pinecone = {
  getClient: getPineconeClient,
  getIndex,
}
