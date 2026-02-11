import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { db } from "./db";
import { getCriteriaForCase } from "./criteria";
import { type CriterionResult } from "./eb1a-agent";
import { getPrompt, substituteVars, resolveModel } from "./agent-prompt";

const FALLBACK_MODEL = "claude-sonnet-4-20250514";

const DocumentAssessmentSchema = z.object({
  documentId: z.string(),
  strength: z.enum(["weak", "moderate", "strong"]),
  feedback: z.string().describe("Brief feedback on why this rating was given and how to improve"),
  suggestions: z.array(z.string()).describe("Specific suggestions for improvement"),
});

const VerificationResultSchema = z.object({
  assessments: z.array(DocumentAssessmentSchema),
  overallStrength: z.enum(["weak", "moderate", "strong"]),
  overallFeedback: z.string(),
});

type VerificationResult = z.infer<typeof VerificationResultSchema>;

export async function verifyDocuments(caseId: string): Promise<{
  items: Array<{
    id: string;
    type: string;
    label: string;
    description: string;
    criterionKey?: string;
    status: string;
    documentId?: string;
    documentName?: string;
    feedback?: string;
  }>;
  summary: {
    total: number;
    completed: number;
    strong: number;
    moderate: number;
    weak: number;
    missing: number;
  };
  lastVerifiedAt: string;
}> {
  console.log(`[DocumentVerifier:${caseId}] Starting verification`);

  // Fetch all required data
  const [criteria, analysis, documents, profile] = await Promise.all([
    getCriteriaForCase(caseId),
    db.eB1AAnalysis.findFirst({
      where: { caseId },
      orderBy: { createdAt: "desc" },
    }),
    db.document.findMany({
      where: { caseId },
      orderBy: { createdAt: "desc" },
    }),
    db.caseProfile.findUnique({ where: { caseId } }),
  ]);

  const analysisCriteria = analysis
    ? (analysis.criteria as CriterionResult[])
    : [];

  const profileData = (profile?.data as Record<string, unknown>) ?? {};

  // Get latest version of each document (group by base name)
  const latestDocuments = new Map<string, typeof documents[0]>();
  for (const doc of documents) {
    const baseName = extractBaseName(doc.name);
    if (!latestDocuments.has(baseName)) {
      latestDocuments.set(baseName, doc);
    }
  }

  const docsToVerify = Array.from(latestDocuments.values()).filter(
    (d) => d.content && d.content.length > 0
  );

  if (docsToVerify.length === 0) {
    console.log(`[DocumentVerifier:${caseId}] No documents to verify`);
    return buildChecklistResponse(caseId, criteria, analysisCriteria, documents, {});
  }

  // Build verification prompt
  const documentSummaries = docsToVerify
    .map(
      (d) => `
## Document: ${d.name} (ID: ${d.id})
Type: ${d.type}
Status: ${d.status}
Content:
${d.content?.slice(0, 3000)}${(d.content?.length ?? 0) > 3000 ? "\n... (truncated)" : ""}
`
    )
    .join("\n---\n");

  const criteriaContext = analysisCriteria
    .map(
      (c) =>
        `- ${c.criterionId} (${c.strength}): ${c.reason}\n  Evidence: ${c.evidence.join("; ")}`
    )
    .join("\n");

  const FALLBACK_PROMPT = `You are an expert EB-1A immigration petition reviewer. Your job is to assess the quality of evidence documents for an EB-1A extraordinary ability petition. Do not use emojis.

## APPLICANT PROFILE
{{profileData}}

## CRITERIA ASSESSMENT
{{criteriaContext}}

## DOCUMENTS TO VERIFY
{{documentSummaries}}

## YOUR TASK

For each document, assess its strength as evidence for an EB-1A petition:

**STRONG**: The document is well-written, specific, provides concrete evidence of extraordinary ability, uses real numbers/dates/achievements, and would likely be convincing to USCIS.

**MODERATE**: The document has good content but could be improved. May be missing specific details, could be more compelling, or needs minor revisions.

**WEAK**: The document has significant issues - generic language, lacks specificity, contains placeholders, or doesn't effectively support the petition.

For each document, provide:
1. A strength rating (weak/moderate/strong)
2. Brief feedback explaining the rating
3. Specific suggestions for improvement

Also provide an overall assessment of the evidence package.`;

  const p = await getPrompt("document-verifier");
  const promptTemplate = p?.content ?? FALLBACK_PROMPT;
  const prompt = substituteVars(promptTemplate, {
    profileData: JSON.stringify(profileData, null, 2),
    criteriaContext: criteriaContext || "No criteria analysis available.",
    documentSummaries,
  });

  console.log(`[DocumentVerifier:${caseId}] Calling LLM to verify ${docsToVerify.length} documents`);

  const result = await generateObject({
    model: p ? resolveModel(p.provider, p.modelName) : anthropic(FALLBACK_MODEL),
    schema: VerificationResultSchema,
    prompt,
  });

  const verification = result.object;
  console.log(`[DocumentVerifier:${caseId}] Verification complete, overall: ${verification.overallStrength}`);

  // Store verification results
  const assessmentsMap: Record<string, { strength: string; feedback: string }> = {};
  for (const assessment of verification.assessments) {
    assessmentsMap[assessment.documentId] = {
      strength: assessment.strength,
      feedback: assessment.feedback,
    };
  }

  await db.documentVerification.create({
    data: {
      caseId,
      assessments: assessmentsMap,
      overallStrength: verification.overallStrength,
      overallFeedback: verification.overallFeedback,
    },
  });

  return buildChecklistResponse(caseId, criteria, analysisCriteria, documents, assessmentsMap);
}

function extractBaseName(name: string): string {
  const dashIndex = name.lastIndexOf(" - ");
  if (dashIndex > 0) {
    return name.substring(0, dashIndex);
  }
  return name;
}

async function buildChecklistResponse(
  caseId: string,
  criteria: Array<{ id: string; key: string; name: string; description: string }>,
  analysisCriteria: CriterionResult[],
  documents: Array<{
    id: string;
    name: string;
    status: string;
    criterionId: string | null;
  }>,
  assessments: Record<string, { strength: string; feedback: string }>
) {
  type StrengthLevel = "missing" | "draft" | "weak" | "moderate" | "strong";

  interface ChecklistItem {
    id: string;
    type: string;
    label: string;
    description: string;
    criterionKey?: string;
    status: StrengthLevel;
    documentId?: string;
    documentName?: string;
    feedback?: string;
  }

  const items: ChecklistItem[] = [];

  // Personal Statement
  const personalStatementDoc = documents.find((d) =>
    d.name.toLowerCase().includes("personal statement")
  );
  const psVerification = assessments[personalStatementDoc?.id ?? ""];

  items.push({
    id: "personal_statement",
    type: "personal_statement",
    label: "Personal Statement",
    description: "A narrative describing your career and achievements",
    status: getStatus(personalStatementDoc, psVerification),
    documentId: personalStatementDoc?.id,
    documentName: personalStatementDoc?.name,
    feedback: psVerification?.feedback,
  });

  // Recommendation letters for strong criteria
  const strongCriteria = analysisCriteria.filter((c) => c.strength === "Strong");

  for (const criterion of strongCriteria) {
    const criterionInfo = criteria.find((c) => c.key === criterion.criterionId);
    const linkedRecLetter = documents.find(
      (d) =>
        d.name.toLowerCase().includes("recommendation") &&
        d.criterionId &&
        criteria.find((c) => c.id === d.criterionId)?.key === criterion.criterionId
    );

    const docVerification = assessments[linkedRecLetter?.id ?? ""];

    items.push({
      id: `rec_${criterion.criterionId}`,
      type: "recommendation_letter",
      label: `Recommendation: ${criterionInfo?.name ?? criterion.criterionId}`,
      description: `Letter supporting ${criterionInfo?.name ?? criterion.criterionId}`,
      criterionKey: criterion.criterionId,
      status: getStatus(linkedRecLetter, docVerification),
      documentId: linkedRecLetter?.id,
      documentName: linkedRecLetter?.name,
      feedback: docVerification?.feedback,
    });
  }

  // Evidence for weak criteria
  const weakCriteria = analysisCriteria.filter((c) => c.strength === "Weak");

  for (const criterion of weakCriteria) {
    const criterionInfo = criteria.find((c) => c.key === criterion.criterionId);
    const evidenceDoc = documents.find(
      (d) =>
        d.criterionId &&
        criteria.find((c) => c.id === d.criterionId)?.key === criterion.criterionId
    );

    const docVerification = assessments[evidenceDoc?.id ?? ""];

    items.push({
      id: `evidence_${criterion.criterionId}`,
      type: "evidence_document",
      label: `Evidence: ${criterionInfo?.name ?? criterion.criterionId}`,
      description: `Supporting document for ${criterionInfo?.name ?? criterion.criterionId}`,
      criterionKey: criterion.criterionId,
      status: getStatus(evidenceDoc, docVerification),
      documentId: evidenceDoc?.id,
      documentName: evidenceDoc?.name,
      feedback: docVerification?.feedback,
    });
  }

  const summary = {
    total: items.length,
    completed: items.filter((i) => i.status !== "missing").length,
    strong: items.filter((i) => i.status === "strong").length,
    moderate: items.filter((i) => i.status === "moderate").length,
    weak: items.filter((i) => i.status === "weak").length,
    missing: items.filter((i) => i.status === "missing").length,
  };

  return {
    items,
    summary,
    lastVerifiedAt: new Date().toISOString(),
  };
}

function getStatus(
  doc: { id: string; status: string } | undefined | null,
  verification: { strength: string; feedback: string } | null | undefined
): "missing" | "draft" | "weak" | "moderate" | "strong" {
  if (!doc) return "missing";
  if (!verification) return "draft";

  switch (verification.strength) {
    case "strong":
      return "strong";
    case "moderate":
      return "moderate";
    case "weak":
      return "weak";
    default:
      return "draft";
  }
}
