import { generateText, Output } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { getPrompt, resolveModel } from "./agent-prompt";

const FALLBACK_MODEL = "gemini-2.5-flash";

export const RecommenderSchema = z.object({
  name: z.string().nullable(),
  title: z.string().nullable(),
  organization: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  linkedIn: z.string().nullable(),
  countryRegion: z.string().nullable(),
  bio: z.string().nullable(),
  credentials: z.string().nullable(),
});

export type ExtractedRecommender = z.infer<typeof RecommenderSchema>;

const FALLBACK_PROMPT = `You are an expert at extracting structured professional information from resumes, CVs, LinkedIn profiles, and web pages. Do not use emojis in any output.

Extract the following information if present:
- name: Full name
- title: Current professional title/position
- organization: Current employer/organization/university
- email: Contact email
- phone: Phone number
- linkedIn: LinkedIn profile URL
- countryRegion: Country or region
- bio: Brief professional biography (2-3 sentences summarizing career)
- credentials: Notable credentials, degrees, fellowships (e.g. "Ph.D., IEEE Fellow, ACM Distinguished Member")

Return null for fields with no data. Be precise and extract only what's explicitly stated.`;

async function getPromptAndModel() {
  const p = await getPrompt("recommender-extractor");
  return {
    model: p ? resolveModel(p.provider, p.modelName) : google(FALLBACK_MODEL),
    system: p?.content ?? FALLBACK_PROMPT,
  };
}

export async function extractRecommenderFromText(
  text: string
): Promise<ExtractedRecommender> {
  const { model, system } = await getPromptAndModel();
  const { output } = await generateText({
    model,
    output: Output.object({ schema: RecommenderSchema }),
    system,
    prompt: `Extract professional information from this text:\n\n${text}`,
  });

  return output!;
}

export async function extractRecommenderFromPdf(
  pdfBuffer: ArrayBuffer
): Promise<ExtractedRecommender> {
  const { model, system } = await getPromptAndModel();
  const { output } = await generateText({
    model,
    output: Output.object({ schema: RecommenderSchema }),
    system,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract professional information from this PDF.",
          },
          {
            type: "file",
            data: Buffer.from(pdfBuffer),
            mediaType: "application/pdf",
          },
        ],
      },
    ],
  });

  return output!;
}

export async function enrichRecommender(
  partial: ExtractedRecommender
): Promise<ExtractedRecommender> {
  const nullFields = Object.entries(partial)
    .filter(([, v]) => v === null)
    .map(([k]) => k);

  if (nullFields.length === 0) return partial;

  const known = Object.entries(partial)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  const p = await getPrompt("recommender-extractor");
  const { output } = await generateText({
    model: p ? resolveModel(p.provider, p.modelName) : google(FALLBACK_MODEL),
    output: Output.object({ schema: RecommenderSchema }),
    system: `You are a research assistant. Given partial information about a professional, use Google Search to find the missing fields. Do not use emojis. Only fill fields you can verify from search results. Return null for fields you cannot confirm.`,
    prompt: `I have partial information about a professional:\n${known}\n\nPlease search for this person and fill in the missing fields: ${nullFields.join(", ")}`,
    providerOptions: {
      google: { useSearchGrounding: true },
    },
  });

  // Merge: keep existing non-null values, fill nulls from enrichment
  const enriched = output!;
  const merged = { ...partial };
  for (const key of nullFields) {
    const k = key as keyof ExtractedRecommender;
    if (enriched[k] !== null) {
      (merged as Record<string, string | null>)[k] = enriched[k];
    }
  }

  return merged;
}
