import { db } from "./db";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";

type CachedPrompt = {
  data: {
    slug: string;
    content: string;
    provider: string;
    modelName: string;
    temperature: number | null;
    maxTokens: number | null;
    active: boolean;
    variables: unknown;
  };
  fetchedAt: number;
};

const cache = new Map<string, CachedPrompt>();
const CACHE_TTL_MS = 60_000;

export async function getPrompt(slug: string) {
  const cached = cache.get(slug);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data.active ? cached.data : null;
  }

  const row = await db.agentPrompt.findUnique({
    where: { slug },
    select: {
      slug: true,
      content: true,
      provider: true,
      modelName: true,
      temperature: true,
      maxTokens: true,
      active: true,
      variables: true,
    },
  });

  if (row) {
    cache.set(slug, { data: row, fetchedAt: Date.now() });
    return row.active ? row : null;
  }
  return null;
}

export function substituteVars(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return key in vars ? vars[key] : match;
  });
}

export function resolveModel(provider: string, modelName: string) {
  if (provider === "google") return google(modelName);
  return anthropic(modelName);
}

export function invalidateCache(slug?: string) {
  if (slug) {
    cache.delete(slug);
  } else {
    cache.clear();
  }
}
