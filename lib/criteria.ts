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
