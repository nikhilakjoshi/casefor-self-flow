import { db } from "./db";
import type { TemplateVariation } from "@prisma/client";

/**
 * Resolve the best matching variation for a template given profile data.
 * Checks non-default variations first (case-insensitive contains match),
 * falls back to isDefault variation.
 */
export async function resolveVariation(
  templateId: string,
  profileData: Record<string, unknown>,
): Promise<TemplateVariation | null> {
  const variations = await db.templateVariation.findMany({
    where: { templateId, active: true },
    orderBy: { createdAt: "asc" },
  });

  if (variations.length === 0) return null;

  // Try non-default variations first
  for (const v of variations) {
    if (v.isDefault) continue;
    if (!v.matchField || !v.matchValue) continue;

    const fieldValue = profileData[v.matchField];
    if (fieldValue == null) continue;

    const fieldStr = String(fieldValue).toLowerCase();
    const matchStr = v.matchValue.toLowerCase();

    if (fieldStr.includes(matchStr)) {
      return v;
    }
  }

  // Fallback to default
  return variations.find((v) => v.isDefault) ?? null;
}
