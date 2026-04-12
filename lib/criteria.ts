import { db } from "./db";

export interface Criterion {
  id: string;
  key: string;
  name: string;
  description: string;
  displayOrder: number;
}

/** Fetch active criteria for a case via its applicationTypeId. Falls back to EB1A. */
export async function getCriteriaForCase(caseId: string): Promise<Criterion[]> {
  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
    select: { applicationTypeId: true },
  });

  const typeCode = caseRecord?.applicationTypeId
    ? undefined // we'll query by applicationTypeId directly
    : "EB1A"; // fallback

  if (caseRecord?.applicationTypeId) {
    const mappings = await db.criteriaMapping.findMany({
      where: { applicationTypeId: caseRecord.applicationTypeId, active: true },
      orderBy: { displayOrder: "asc" },
    });
    return mappings.map(toFlatCriterion);
  }

  return getCriteriaForType(typeCode!);
}

/** Fetch active criteria by ApplicationType code. */
export async function getCriteriaForType(code: string): Promise<Criterion[]> {
  const appType = await db.applicationType.findUnique({
    where: { code },
    include: {
      criteria: {
        where: { active: true },
        orderBy: { displayOrder: "asc" },
      },
    },
  });

  if (!appType) return [];

  return appType.criteria.map(toFlatCriterion);
}

/** Full criterion metadata including USCIS text and guidance. */
export interface CriterionMetadata {
  key: string;
  name: string;
  description: string;
  uscis: string;
  guidance: string;
  displayOrder: number;
}

/**
 * Fetch full criteria metadata for an application type.
 * Returns a Record keyed by criterionKey.
 * Used by front-end components that need names/descriptions, replacing
 * the static CRITERIA_METADATA constant from eb1a-extraction-schema.ts.
 */
export async function getCriteriaMetadata(
  applicationTypeId: string | null,
): Promise<Record<string, CriterionMetadata>> {
  let mappings;
  if (applicationTypeId) {
    mappings = await db.criteriaMapping.findMany({
      where: { applicationTypeId, active: true },
      orderBy: { displayOrder: "asc" },
    });
  } else {
    // Fallback: load EB1A
    const eb1a = await db.applicationType.findUnique({ where: { code: "EB1A" } });
    if (!eb1a) return {};
    mappings = await db.criteriaMapping.findMany({
      where: { applicationTypeId: eb1a.id, active: true },
      orderBy: { displayOrder: "asc" },
    });
  }

  const result: Record<string, CriterionMetadata> = {};
  for (const m of mappings) {
    result[m.criterionKey] = {
      key: m.criterionKey,
      name: m.name,
      description: m.description,
      uscis: m.uscisText || m.description,
      guidance: m.guidanceText || "",
      displayOrder: m.displayOrder,
    };
  }
  return result;
}

/**
 * Get the applicationTypeId for a case. Utility for pipeline functions
 * that take caseId and need to resolve the type.
 */
export async function getApplicationTypeId(caseId: string): Promise<string | null> {
  const c = await db.case.findUnique({
    where: { id: caseId },
    select: { applicationTypeId: true },
  });
  return c?.applicationTypeId ?? null;
}

function toFlatCriterion(m: {
  id: string;
  criterionKey: string;
  name: string;
  description: string;
  displayOrder: number;
}): Criterion {
  return {
    id: m.id,
    key: m.criterionKey,
    name: m.name,
    description: m.description,
    displayOrder: m.displayOrder,
  };
}
