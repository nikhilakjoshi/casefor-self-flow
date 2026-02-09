import { generateText, Output } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { db } from "./db";
import { queryContext, type RAGResult } from "./rag";
import { getCriteriaForCase } from "./criteria";
import {
  CriterionResultSchema,
  type CriterionResult,
  countCriteriaStrengths,
} from "./eb1a-agent";

const MODEL = "gemini-2.5-flash";

const AffectedCriteriaSchema = z.object({
  affectedCriterionIds: z
    .array(z.string())
    .describe("IDs of criteria that may be affected by the new evidence"),
});

const PartialEvaluationSchema = z.object({
  criteria: z.array(CriterionResultSchema),
});

export async function runIncrementalAnalysis(
  caseId: string,
  newDocumentText: string,
): Promise<void> {
  // Get current analysis
  const currentAnalysis = await db.eB1AAnalysis.findFirst({
    where: { caseId },
    orderBy: { createdAt: "desc" },
  });

  if (!currentAnalysis) {
    // No existing analysis, skip incremental
    return;
  }

  const currentCriteria = currentAnalysis.criteria as CriterionResult[];

  // Fetch dynamic criteria for this case
  const dbCriteria = await getCriteriaForCase(caseId);

  // Step 1: Determine which criteria are affected
  const criteriaList = dbCriteria.map((c) => `- ${c.key}: ${c.name}`).join(
    "\n",
  );

  const { output: affected } = await generateText({
    model: google(MODEL),
    output: Output.object({ schema: AffectedCriteriaSchema }),
    system: `You analyze new documents for EB-1A visa cases. Do not use emojis.
Given new evidence, identify which of the 10 criteria might be strengthened.

CRITERIA:
${criteriaList}

Only list criteria that the new evidence DIRECTLY supports.`,
    prompt: `New document content:\n\n${newDocumentText.slice(0, 5000)}`,
  });

  if (!affected?.affectedCriterionIds?.length) {
    return; // No criteria affected
  }

  // Step 2: Re-evaluate affected criteria with full context
  const contextResults = await queryContext(
    caseId,
    newDocumentText.slice(0, 1000),
    10,
  );
  const fullContext = contextResults.map((r: RAGResult) => r.text).join("\n\n");

  const affectedCriteriaDetails = dbCriteria.filter((c) =>
    affected.affectedCriterionIds.includes(c.key),
  )
    .map((c) => `- ${c.key}: ${c.name} - ${c.description}`)
    .join("\n");

  const { output: reeval } = await generateText({
    model: google(MODEL),
    output: Output.object({ schema: PartialEvaluationSchema }),
    system: `You are an immigration attorney. Re-evaluate these specific EB-1A criteria based on all available evidence. Do not use emojis.

CRITERIA TO EVALUATE:
${affectedCriteriaDetails}

Be thorough - look for any evidence supporting each criterion.`,
    prompt: `All available evidence:\n\n${fullContext}\n\nEvaluate each criterion listed above.`,
  });

  if (!reeval?.criteria?.length) {
    return;
  }

  // Step 3: Merge updated criteria with existing
  const updatedCriteria = currentCriteria.map((c) => {
    const updated = reeval.criteria.find(
      (u) => u.criterionId === c.criterionId,
    );
    if (updated) {
      // Only upgrade strength, never downgrade
      if (
        (c.strength === "None" && updated.strength !== "None") ||
        (c.strength === "Weak" && updated.strength === "Strong")
      ) {
        return updated;
      }
    }
    return c;
  });

  const counts = countCriteriaStrengths({ criteria: updatedCriteria });

  // Step 4: Save new analysis version
  await db.eB1AAnalysis.create({
    data: {
      caseId,
      version: (currentAnalysis.version ?? 0) + 1,
      criteria: updatedCriteria,
      strongCount: counts.strong,
      weakCount: counts.weak,
    },
  });
}
