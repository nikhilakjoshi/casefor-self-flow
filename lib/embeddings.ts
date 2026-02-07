import { embed, embedMany } from "ai";
import { google } from "@ai-sdk/google";

const EMBEDDING_MODEL = "gemini-embedding-001";

export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: google.embedding(EMBEDDING_MODEL),
    value: text,
  });
  return embedding;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const { embeddings } = await embedMany({
    model: google.embedding(EMBEDDING_MODEL),
    values: texts,
  });
  return embeddings;
}
