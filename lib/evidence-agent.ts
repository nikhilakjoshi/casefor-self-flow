import { ToolLoopAgent, tool, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { db } from "./db";
import { getCriteriaForCase, type Criterion } from "./criteria";
import { type CriterionResult } from "./eb1a-agent";
import { isS3Configured, uploadToS3, buildDocumentKey } from "./s3";

const MODEL = "claude-sonnet-4-20250514";
const MAX_HISTORY = 20;

function buildEvidenceSystemPrompt(opts: {
  criteria: Criterion[];
  threshold: number;
  profile: Record<string, unknown> | null;
  analysis: CriterionResult[] | null;
  templateNames: string[];
}): string {
  const criteriaList = opts.criteria
    .map((c) => `- ${c.key}: ${c.name} -- ${c.description}`)
    .join("\n");

  const profileSection = opts.profile
    ? `CURRENT APPLICANT PROFILE:\n${JSON.stringify(opts.profile, null, 2)}`
    : "APPLICANT PROFILE: Not yet established.";

  const analysisSection = opts.analysis
    ? `CURRENT ANALYSIS (${opts.analysis.filter((c) => c.strength === "Strong").length} Strong, need ${opts.threshold}+):\n${opts.analysis.map((c) => `${c.criterionId}: ${c.strength} - ${c.reason}`).join("\n")}`
    : "ANALYSIS: No analysis yet.";

  const templateSection =
    opts.templateNames.length > 0
      ? `AVAILABLE TEMPLATES: ${opts.templateNames.join(", ")}`
      : "";

  return `You are an expert EB-1A immigration evidence gathering specialist. You help applicants compile and draft the evidence documents needed for a strong petition.

YOUR ROLE:
- You focus on the EVIDENCE GATHERING phase, after initial criteria analysis is complete.
- You draft recommendation letters, personal statements, petition letters, and other supporting documents.
- You use templates to generate high-quality first drafts that the applicant can refine.
- You help organize and track all evidence documents for the case.

YOUR BEHAVIOR:
- When the applicant asks for a document, use the appropriate drafting tool.
- Always fetch the profile and analysis first so drafts are grounded in real case data.
- After drafting, explain what was generated and suggest revisions.
- Proactively suggest which documents would strengthen weak criteria.
- Be specific about USCIS requirements and what each document should demonstrate.

EB-1A CRITERIA (need ${opts.threshold}+ Strong):
${criteriaList}

${profileSection}

${analysisSection}

${templateSection}

TOOL USAGE RULES:
- Call getProfile and getAnalysis before drafting to ensure documents reflect current case data.
- Call listDocuments to check what already exists before creating duplicates.
- When drafting, specify relevant criterionKeys so the document is linked to the right criteria.
- After drafting, summarize what was created and ask if revisions are needed.`;
}

function createEvidenceAgentTools(caseId: string) {
  const logPrefix = `[EvidenceAgent:${caseId}]`;

  return {
    getProfile: tool({
      description:
        "Fetch the applicant profile for this case. Call this before drafting documents to ground them in real data.",
      inputSchema: z.object({}),
      execute: async () => {
        console.log(`${logPrefix} [getProfile] Called`);
        const profile = await db.caseProfile.findUnique({
          where: { caseId },
        });
        if (!profile) {
          console.log(`${logPrefix} [getProfile] No profile found`);
          return { exists: false, data: null };
        }
        console.log(`${logPrefix} [getProfile] Found profile`);
        return { exists: true, data: profile.data };
      },
    }),

    getAnalysis: tool({
      description:
        "Fetch the latest EB-1A criteria analysis. Use this to understand which criteria are Strong/Weak/None before drafting evidence.",
      inputSchema: z.object({}),
      execute: async () => {
        console.log(`${logPrefix} [getAnalysis] Called`);
        const analysis = await db.eB1AAnalysis.findFirst({
          where: { caseId },
          orderBy: { createdAt: "desc" },
        });
        if (!analysis) {
          console.log(`${logPrefix} [getAnalysis] No analysis found`);
          return { exists: false, criteria: null };
        }
        console.log(
          `${logPrefix} [getAnalysis] Found v${analysis.version}, strong: ${analysis.strongCount}`,
        );
        return {
          exists: true,
          version: analysis.version,
          criteria: analysis.criteria,
          strongCount: analysis.strongCount,
          weakCount: analysis.weakCount,
        };
      },
    }),

    listDocuments: tool({
      description:
        "List all documents for this case. Check existing docs before creating new ones to avoid duplicates.",
      inputSchema: z.object({}),
      execute: async () => {
        console.log(`${logPrefix} [listDocuments] Called`);
        const docs = await db.document.findMany({
          where: { caseId },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            type: true,
            source: true,
            status: true,
            criterionId: true,
            templateId: true,
            createdAt: true,
          },
        });
        console.log(`${logPrefix} [listDocuments] Found ${docs.length} docs`);
        return { documents: docs };
      },
    }),

    draftRecommendationLetter: tool({
      description:
        "Draft a recommendation letter for the EB-1A petition. The letter will be from a qualified expert attesting to the applicant's extraordinary ability. Provide the recommender's name/title and which criteria the letter should support.",
      inputSchema: z.object({
        recommenderName: z
          .string()
          .describe("Name of the person writing the recommendation"),
        recommenderTitle: z
          .string()
          .describe("Title/position of the recommender"),
        recommenderRelation: z
          .string()
          .describe(
            "How the recommender knows the applicant (e.g., 'PhD advisor', 'research collaborator')",
          ),
        criterionKeys: z
          .array(z.string())
          .describe(
            "Which EB-1A criteria this letter should address (e.g., ['original_contributions', 'scholarly_articles'])",
          ),
        additionalContext: z
          .string()
          .optional()
          .describe("Any additional context or instructions for the letter"),
      }),
      execute: async ({
        recommenderName,
        recommenderTitle,
        recommenderRelation,
        criterionKeys,
        additionalContext,
      }) => {
        console.log(
          `${logPrefix} [draftRecLetter] Drafting for ${recommenderName}, criteria: ${criterionKeys}`,
        );

        // Fetch template
        const template = await db.template.findFirst({
          where: {
            type: "RECOMMENDATION_LETTER",
            active: true,
            applicationType: {
              cases: { some: { id: caseId } },
            },
          },
        });

        // Fetch profile + analysis for context
        const [profile, analysis] = await Promise.all([
          db.caseProfile.findUnique({ where: { caseId } }),
          db.eB1AAnalysis.findFirst({
            where: { caseId },
            orderBy: { createdAt: "desc" },
          }),
        ]);

        const profileData = (profile?.data as Record<string, unknown>) ?? {};
        const analysisCriteria = analysis
          ? (analysis.criteria as CriterionResult[])
          : [];

        // Build relevant criteria context
        const relevantCriteria = analysisCriteria.filter((c) =>
          criterionKeys.includes(c.criterionId),
        );
        const criteriaContext = relevantCriteria
          .map(
            (c) =>
              `${c.criterionId} (${c.strength}): ${c.reason}\nEvidence: ${c.evidence.join("; ")}`,
          )
          .join("\n\n");

        const applicantName =
          (profileData.name as string) ?? "the applicant";

        const letterContent = `# Recommendation Letter - DRAFT

**From:** ${recommenderName}, ${recommenderTitle}
**Relationship:** ${recommenderRelation}
**For:** ${applicantName}
**Supporting Criteria:** ${criterionKeys.join(", ")}

---

${template?.content ?? "Draft a recommendation letter for an EB-1A petition."}

---

## Context for Drafting

**Applicant Profile:** ${JSON.stringify(profileData, null, 2)}

**Relevant Criteria Assessment:**
${criteriaContext || "No analysis data available yet."}

${additionalContext ? `**Additional Instructions:** ${additionalContext}` : ""}

---

*This is a draft template. The recommender should customize with specific examples and personal knowledge of the applicant's work.*`;

        // Find criterion mapping IDs for linking
        const criterionMapping = criterionKeys.length > 0
          ? await db.criteriaMapping.findFirst({
              where: {
                criterionKey: criterionKeys[0],
                applicationType: { cases: { some: { id: caseId } } },
              },
            })
          : null;

        // Create Document record
        const doc = await db.document.create({
          data: {
            caseId,
            name: `Recommendation Letter - ${recommenderName}`,
            type: "MARKDOWN",
            source: "SYSTEM_GENERATED",
            content: letterContent,
            status: "DRAFT",
            criterionId: criterionMapping?.id ?? null,
            templateId: template?.id ?? null,
          },
        });

        // Upload to S3 if configured
        if (isS3Configured()) {
          try {
            const key = buildDocumentKey(
              caseId,
              doc.id,
              `rec-letter-${recommenderName.toLowerCase().replace(/\s+/g, "-")}.md`,
            );
            const { url } = await uploadToS3(
              key,
              Buffer.from(letterContent),
              "text/markdown",
            );
            await db.document.update({
              where: { id: doc.id },
              data: { s3Key: key, s3Url: url },
            });
          } catch (err) {
            console.error(`${logPrefix} [draftRecLetter] S3 upload failed:`, err);
          }
        }

        console.log(
          `${logPrefix} [draftRecLetter] Created document ${doc.id}`,
        );
        return {
          success: true,
          documentId: doc.id,
          name: doc.name,
          status: doc.status,
        };
      },
    }),

    draftPersonalStatement: tool({
      description:
        "Draft a personal statement for the EB-1A petition. The statement describes the applicant's career trajectory, achievements, and how they demonstrate extraordinary ability.",
      inputSchema: z.object({
        focusCriteria: z
          .array(z.string())
          .optional()
          .describe(
            "Which criteria to emphasize (defaults to all Strong criteria)",
          ),
        additionalContext: z
          .string()
          .optional()
          .describe("Any additional context or instructions"),
      }),
      execute: async ({ focusCriteria, additionalContext }) => {
        console.log(
          `${logPrefix} [draftPersonalStatement] Drafting, focus: ${focusCriteria}`,
        );

        const template = await db.template.findFirst({
          where: {
            type: "PERSONAL_STATEMENT",
            active: true,
            applicationType: {
              cases: { some: { id: caseId } },
            },
          },
        });

        const [profile, analysis] = await Promise.all([
          db.caseProfile.findUnique({ where: { caseId } }),
          db.eB1AAnalysis.findFirst({
            where: { caseId },
            orderBy: { createdAt: "desc" },
          }),
        ]);

        const profileData = (profile?.data as Record<string, unknown>) ?? {};
        const analysisCriteria = analysis
          ? (analysis.criteria as CriterionResult[])
          : [];

        const strongCriteria = analysisCriteria.filter(
          (c) => c.strength === "Strong",
        );
        const focusOn = focusCriteria ?? strongCriteria.map((c) => c.criterionId);
        const relevantCriteria = analysisCriteria.filter((c) =>
          focusOn.includes(c.criterionId),
        );

        const criteriaContext = relevantCriteria
          .map(
            (c) =>
              `${c.criterionId} (${c.strength}): ${c.reason}\nEvidence: ${c.evidence.join("; ")}`,
          )
          .join("\n\n");

        const applicantName =
          (profileData.name as string) ?? "the applicant";

        const statementContent = `# Personal Statement - DRAFT

**Applicant:** ${applicantName}
**Focus Criteria:** ${focusOn.join(", ")}

---

${template?.content ?? "Draft a personal statement for an EB-1A petition."}

---

## Context for Drafting

**Applicant Profile:** ${JSON.stringify(profileData, null, 2)}

**Key Criteria Assessment:**
${criteriaContext || "No analysis data available yet."}

${additionalContext ? `**Additional Instructions:** ${additionalContext}` : ""}

---

*This is a draft. The applicant should review and personalize with their own voice and additional details.*`;

        const doc = await db.document.create({
          data: {
            caseId,
            name: `Personal Statement - ${applicantName}`,
            type: "MARKDOWN",
            source: "SYSTEM_GENERATED",
            content: statementContent,
            status: "DRAFT",
            templateId: template?.id ?? null,
          },
        });

        if (isS3Configured()) {
          try {
            const key = buildDocumentKey(
              caseId,
              doc.id,
              "personal-statement.md",
            );
            const { url } = await uploadToS3(
              key,
              Buffer.from(statementContent),
              "text/markdown",
            );
            await db.document.update({
              where: { id: doc.id },
              data: { s3Key: key, s3Url: url },
            });
          } catch (err) {
            console.error(
              `${logPrefix} [draftPersonalStatement] S3 upload failed:`,
              err,
            );
          }
        }

        console.log(
          `${logPrefix} [draftPersonalStatement] Created document ${doc.id}`,
        );
        return {
          success: true,
          documentId: doc.id,
          name: doc.name,
          status: doc.status,
        };
      },
    }),

    generateFromTemplate: tool({
      description:
        "Generate a document from a specific template. Fetches the template by ID, uses profile/analysis context, and creates a Document record. Use this for petition letters, USCIS form instructions, or custom templates.",
      inputSchema: z.object({
        templateId: z.string().describe("ID of the template to use"),
        variables: z
          .record(z.string(), z.string())
          .optional()
          .describe(
            "Optional key-value variables to inject into the template (replaces {{key}} placeholders)",
          ),
        criterionKeys: z
          .array(z.string())
          .optional()
          .describe("Which criteria this document relates to"),
        additionalContext: z
          .string()
          .optional()
          .describe("Additional instructions for generation"),
      }),
      execute: async ({
        templateId,
        variables,
        criterionKeys,
        additionalContext,
      }) => {
        console.log(
          `${logPrefix} [generateFromTemplate] Template: ${templateId}`,
        );

        const template = await db.template.findUnique({
          where: { id: templateId },
        });

        if (!template) {
          return { success: false, error: "Template not found" };
        }

        const [profile, analysis] = await Promise.all([
          db.caseProfile.findUnique({ where: { caseId } }),
          db.eB1AAnalysis.findFirst({
            where: { caseId },
            orderBy: { createdAt: "desc" },
          }),
        ]);

        const profileData = (profile?.data as Record<string, unknown>) ?? {};
        const analysisCriteria = analysis
          ? (analysis.criteria as CriterionResult[])
          : [];

        // Replace {{var}} placeholders in template content
        let processedContent = template.content;
        if (variables) {
          for (const [key, value] of Object.entries(variables)) {
            processedContent = processedContent.replace(
              new RegExp(`\\{\\{${key}\\}\\}`, "g"),
              value,
            );
          }
        }

        const applicantName =
          (profileData.name as string) ?? "the applicant";

        const relevantCriteria = criterionKeys
          ? analysisCriteria.filter((c) =>
              criterionKeys.includes(c.criterionId),
            )
          : analysisCriteria.filter((c) => c.strength === "Strong");

        const criteriaContext = relevantCriteria
          .map(
            (c) =>
              `${c.criterionId} (${c.strength}): ${c.reason}\nEvidence: ${c.evidence.join("; ")}`,
          )
          .join("\n\n");

        const docContent = `# ${template.name} - DRAFT

**Applicant:** ${applicantName}
**Template:** ${template.name} (v${template.version})

---

${processedContent}

---

## Context for Drafting

**Applicant Profile:** ${JSON.stringify(profileData, null, 2)}

**Criteria Assessment:**
${criteriaContext || "No analysis data available yet."}

${additionalContext ? `**Additional Instructions:** ${additionalContext}` : ""}

---

*This is a draft generated from template "${template.name}". Review and customize before finalizing.*`;

        const criterionMapping =
          criterionKeys && criterionKeys.length > 0
            ? await db.criteriaMapping.findFirst({
                where: {
                  criterionKey: criterionKeys[0],
                  applicationType: { cases: { some: { id: caseId } } },
                },
              })
            : null;

        const doc = await db.document.create({
          data: {
            caseId,
            name: `${template.name} - ${applicantName}`,
            type: "MARKDOWN",
            source: "SYSTEM_GENERATED",
            content: docContent,
            status: "DRAFT",
            criterionId: criterionMapping?.id ?? null,
            templateId: template.id,
          },
        });

        if (isS3Configured()) {
          try {
            const key = buildDocumentKey(
              caseId,
              doc.id,
              `${template.name.toLowerCase().replace(/\s+/g, "-")}.md`,
            );
            const { url } = await uploadToS3(
              key,
              Buffer.from(docContent),
              "text/markdown",
            );
            await db.document.update({
              where: { id: doc.id },
              data: { s3Key: key, s3Url: url },
            });
          } catch (err) {
            console.error(
              `${logPrefix} [generateFromTemplate] S3 upload failed:`,
              err,
            );
          }
        }

        console.log(
          `${logPrefix} [generateFromTemplate] Created document ${doc.id}`,
        );
        return {
          success: true,
          documentId: doc.id,
          name: doc.name,
          templateName: template.name,
          status: doc.status,
        };
      },
    }),
  };
}

export async function runEvidenceAgent(opts: {
  caseId: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  onFinish?: (text: string) => Promise<void>;
}) {
  const { caseId, messages, onFinish } = opts;
  const log = (msg: string, ...args: unknown[]) =>
    console.log(`[EvidenceAgent:${caseId}] ${msg}`, ...args);

  log("runEvidenceAgent called, messages:", messages.length);

  // Gather context in parallel
  const [criteria, caseRecord, profile, analysis, templates] =
    await Promise.all([
      getCriteriaForCase(caseId),
      db.case.findUnique({
        where: { id: caseId },
        select: { criteriaThreshold: true },
      }),
      db.caseProfile.findUnique({ where: { caseId } }),
      db.eB1AAnalysis.findFirst({
        where: { caseId },
        orderBy: { createdAt: "desc" },
      }),
      db.template.findMany({
        where: {
          active: true,
          applicationType: { cases: { some: { id: caseId } } },
        },
        select: { id: true, name: true, type: true },
      }),
    ]);

  const threshold = caseRecord?.criteriaThreshold ?? 3;
  log(
    "context gathered - criteria:",
    criteria.length,
    "threshold:",
    threshold,
    "profile:",
    !!profile,
    "analysis:",
    !!analysis,
    "templates:",
    templates.length,
  );

  const instructions = buildEvidenceSystemPrompt({
    criteria,
    threshold,
    profile: (profile?.data as Record<string, unknown>) ?? null,
    analysis: analysis ? (analysis.criteria as CriterionResult[]) : null,
    templateNames: templates.map((t) => `${t.name} (${t.id})`),
  });

  const tools = createEvidenceAgentTools(caseId);

  log("creating ToolLoopAgent with model:", MODEL, "tools:", Object.keys(tools));

  const agent = new ToolLoopAgent({
    model: anthropic(MODEL),
    instructions,
    tools,
    stopWhen: stepCountIs(7),
    onStepFinish: ({ toolCalls, text, finishReason }) => {
      log("step finished - finishReason:", finishReason);
      log("step text length:", text?.length ?? 0);
      log(
        "step toolCalls:",
        toolCalls?.map((tc: { toolName: string }) => tc.toolName) ?? "none",
      );
    },
    onFinish: async ({ text }) => {
      log("agent finished, text length:", text?.length ?? 0);
      if (onFinish) await onFinish(text);
    },
  });

  log("starting stream");
  return agent.stream({ messages: messages.slice(-MAX_HISTORY) });
}
