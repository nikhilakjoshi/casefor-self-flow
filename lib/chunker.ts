/**
 * Text chunking utility for vector embeddings
 * Splits text into overlapping chunks for better semantic search
 */

const CHUNK_SIZE = 500;
const OVERLAP = 50;

/**
 * Split text into chunks with overlap
 * @param text - The text to chunk
 * @param chunkSize - Size of each chunk in characters (default: 500)
 * @param overlap - Number of overlapping characters between chunks (default: 50)
 * @returns Array of text chunks
 */
export function chunkText(
  text: string,
  chunkSize: number = CHUNK_SIZE,
  overlap: number = OVERLAP
): string[] {
  if (!text || text.length === 0) {
    return [];
  }

  if (chunkSize <= 0) {
    throw new Error("chunkSize must be positive");
  }

  if (overlap < 0 || overlap >= chunkSize) {
    throw new Error("overlap must be >= 0 and < chunkSize");
  }

  const chunks: string[] = [];
  const step = chunkSize - overlap;
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end);
    chunks.push(chunk);

    if (end >= text.length) {
      break;
    }

    start += step;
  }

  return chunks;
}
