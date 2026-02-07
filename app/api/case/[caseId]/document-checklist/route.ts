import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCriteriaForCase } from "@/lib/criteria";
import { type CriterionResult } from "@/lib/eb1a-agent";
import type { Document } from "@prisma/client";

type StrengthLevel = "missing" | "draft" | "weak" | "moderate" | "strong";

interface ChecklistItem {
  id: string;
  type: "personal_statement" | "recommendation_letter" | "evidence_document";
  label: string;
  description: string;
  criterionKey?: string;
  status: StrengthLevel;
  documentId?: string;
  documentName?: string;
  feedback?: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { caseId } = await params;

  // Verify case ownership
  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
    include: {
      profile: true,
    },
  });

  if (!caseRecord || caseRecord.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  // Get criteria and analysis
  const [criteria, analysis, documents, verification] = await Promise.all([
    getCriteriaForCase(caseId),
    db.eB1AAnalysis.findFirst({
      where: { caseId },
      orderBy: { createdAt: "desc" },
    }),
    db.document.findMany({
      where: { caseId },
      orderBy: { createdAt: "desc" },
    }),
    db.documentVerification.findFirst({
      where: { caseId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const analysisCriteria = analysis
    ? (analysis.criteria as CriterionResult[])
    : [];

  // Build checklist items
  const items: ChecklistItem[] = [];

  // 1. Personal Statement (always required)
  const personalStatementDoc = documents.find((d: Document) =>
    d.name.toLowerCase().includes("personal statement")
  );
  const psVerification = verification?.assessments
    ? (verification.assessments as Record<string, { strength: string; feedback: string }>)[
        personalStatementDoc?.id ?? ""
      ]
    : null;

  items.push({
    id: "personal_statement",
    type: "personal_statement",
    label: "Personal Statement",
    description: "A narrative describing your career and achievements",
    status: getDocumentStatus(personalStatementDoc, psVerification),
    documentId: personalStatementDoc?.id,
    documentName: personalStatementDoc?.name,
    feedback: psVerification?.feedback,
  });

  // 2. Recommendation letters for each strong criterion
  const strongCriteria = analysisCriteria.filter((c) => c.strength === "Strong");

  for (const criterion of strongCriteria) {
    const criterionInfo = criteria.find((c) => c.key === criterion.criterionId);
    const recLetterDoc = documents.find(
      (d: Document) =>
        d.name.toLowerCase().includes("recommendation") &&
        d.name.toLowerCase().includes(criterionInfo?.name.toLowerCase().slice(0, 10) ?? "")
    );

    // Fallback: find any rec letter linked to this criterion
    const linkedRecLetter =
      recLetterDoc ??
      documents.find(
        (d: Document) =>
          d.name.toLowerCase().includes("recommendation") &&
          d.criterionId &&
          criteria.find((c) => c.id === d.criterionId)?.key === criterion.criterionId
      );

    const docVerification = verification?.assessments
      ? (verification.assessments as Record<string, { strength: string; feedback: string }>)[
          linkedRecLetter?.id ?? ""
        ]
      : null;

    items.push({
      id: `rec_${criterion.criterionId}`,
      type: "recommendation_letter",
      label: `Recommendation: ${criterionInfo?.name ?? criterion.criterionId}`,
      description: `Letter supporting ${criterionInfo?.name ?? criterion.criterionId}`,
      criterionKey: criterion.criterionId,
      status: getDocumentStatus(linkedRecLetter, docVerification),
      documentId: linkedRecLetter?.id,
      documentName: linkedRecLetter?.name,
      feedback: docVerification?.feedback,
    });
  }

  // 3. Additional evidence documents for weak criteria
  const weakCriteria = analysisCriteria.filter((c) => c.strength === "Weak");

  for (const criterion of weakCriteria) {
    const criterionInfo = criteria.find((c) => c.key === criterion.criterionId);
    const evidenceDoc = documents.find(
      (d: Document) =>
        d.criterionId &&
        criteria.find((c) => c.id === d.criterionId)?.key === criterion.criterionId
    );

    const docVerification = verification?.assessments
      ? (verification.assessments as Record<string, { strength: string; feedback: string }>)[
          evidenceDoc?.id ?? ""
        ]
      : null;

    items.push({
      id: `evidence_${criterion.criterionId}`,
      type: "evidence_document",
      label: `Evidence: ${criterionInfo?.name ?? criterion.criterionId}`,
      description: `Supporting document for ${criterionInfo?.name ?? criterion.criterionId}`,
      criterionKey: criterion.criterionId,
      status: getDocumentStatus(evidenceDoc, docVerification),
      documentId: evidenceDoc?.id,
      documentName: evidenceDoc?.name,
      feedback: docVerification?.feedback,
    });
  }

  // Calculate summary
  const summary = {
    total: items.length,
    completed: items.filter((i) => i.status !== "missing").length,
    strong: items.filter((i) => i.status === "strong").length,
    moderate: items.filter((i) => i.status === "moderate").length,
    weak: items.filter((i) => i.status === "weak").length,
    missing: items.filter((i) => i.status === "missing").length,
  };

  return Response.json({
    items,
    summary,
    lastVerifiedAt: verification?.createdAt?.toISOString() ?? null,
  });
}

function getDocumentStatus(
  doc: { id: string; status: string } | undefined | null,
  verification: { strength: string; feedback: string } | null | undefined
): StrengthLevel {
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
