import { getIndex } from './pinecone'
import { embedText } from './embeddings'

export interface RAGResult {
  text: string
  score: number
}

export async function queryContext(
  caseId: string,
  query: string,
  topK: number = 5
): Promise<RAGResult[]> {
  const index = getIndex()
  const queryEmbedding = await embedText(query)

  const results = await index.query({
    vector: queryEmbedding,
    topK,
    filter: { caseId: { $eq: caseId } },
    includeMetadata: true,
  })

  return (results.matches || [])
    .filter((match) => match.metadata?.text)
    .map((match) => ({
      text: match.metadata!.text as string,
      score: match.score ?? 0,
    }))
}
