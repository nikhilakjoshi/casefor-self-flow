import { ToolLoopAgent, tool, stepCountIs, streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { db } from "./db";
import { getCriteriaForCase, type Criterion } from "./criteria";
import { type CriterionResult } from "./eb1a-agent";
import { isS3Configured, uploadToS3, buildDocumentKey } from "./s3";

const MODEL = "claude-sonnet-4-20250514";
const GENERATION_MODEL = "claude-sonnet-4-20250514";
const STREAM_UPDATE_INTERVAL_MS = 500;

interface GenerateDocumentOpts {
  documentId: string;
  documentType: string;
  templateContent: string | null;
  templateName: string | null;
  profile: Record<string, unknown>;
  criteria: CriterionResult[];
  additionalContext?: string;
  specificInstructions?: string;
}

async function streamDocumentContent(opts: GenerateDocumentOpts): Promise<string> {
  const {
    documentId,
    documentType,
    templateContent,
    profile,
    criteria,
    additionalContext,
    specificInstructions,
  } = opts;

  const strongCriteria = criteria.filter((c) => c.strength === "Strong");
  const weakCriteria = criteria.filter((c) => c.strength === "Weak");

  const criteriaSection = criteria
    .map(
      (c) =>
        `- ${c.criterionId} (${c.strength}): ${c.reason}\n  Evidence: ${c.evidence.join("; ")}`,
    )
    .join("\n");

  const templateSection = templateContent
    ? `## TEMPLATE TO FOLLOW

The document should follow this template's structure, tone, and formatting guidelines:

---
${templateContent}
---

Use this template as a guide for structure and style. Replace placeholder content with actual information from the applicant's profile and evidence.`
    : `## DOCUMENT TYPE: ${documentType}

Generate a professional ${documentType} appropriate for an EB-1A immigration petition.`;

  const prompt = `You are an expert immigration document writer specializing in EB-1A extraordinary ability petitions.

${templateSection}

## APPLICANT PROFILE

${JSON.stringify(profile, null, 2)}

## CRITERIA ASSESSMENT

Strong criteria (${strongCriteria.length}):
${strongCriteria.map((c) => `- ${c.criterionId}: ${c.reason}`).join("\n") || "None yet"}

Weak criteria needing more evidence (${weakCriteria.length}):
${weakCriteria.map((c) => `- ${c.criterionId}: ${c.reason}`).join("\n") || "None"}

Full criteria details:
${criteriaSection || "No analysis available yet."}

${additionalContext ? `## ADDITIONAL CONTEXT\n${additionalContext}` : ""}

${specificInstructions ? `## SPECIFIC INSTRUCTIONS\n${specificInstructions}` : ""}

## YOUR TASK

Generate a complete, polished ${documentType} for this EB-1A applicant.

Requirements:
1. Follow the template structure and formatting exactly if provided
2. Use specific details from the applicant's profile - never use placeholders like [NAME] or [FIELD]
3. Highlight the applicant's extraordinary achievements that support the Strong criteria
4. Write in a professional, compelling tone appropriate for USCIS
5. Be specific and concrete - use real numbers, dates, and accomplishments from the profile
6. The document should be ready for review, not a template or outline

Output ONLY the document content in markdown format. Do not include any meta-commentary or explanations.`;

  const result = streamText({
    model: anthropic(GENERATION_MODEL),
    prompt,
  });

  let fullContent = "";
  let lastUpdateTime = 0;

  for await (const chunk of result.textStream) {
    fullContent += chunk;

    const now = Date.now();
    if (now - lastUpdateTime >= STREAM_UPDATE_INTERVAL_MS) {
      lastUpdateTime = now;
      await db.document.update({
        where: { id: documentId },
        data: { content: fullContent },
      });
    }
  }

  // Final update with complete content
  await db.document.update({
    where: { id: documentId },
    data: { content: fullContent },
  });

  return fullContent;
}
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
- You generate polished, complete documents using templates as structural guides.
- You help organize and track all evidence documents for the case.

YOUR BEHAVIOR:
- For the initial greeting (when the first user message is "Begin evidence gathering."), introduce yourself briefly, summarize the current case state (profile, strong/weak criteria), and suggest which evidence documents to draft first. Call getProfile, getAnalysis, and listDocuments to ground your greeting in real data.
- When the applicant asks for a document:
  1. First use listTemplates to find the right template for that document type
  2. Use the appropriate drafting tool (draftPersonalStatement, draftRecommendationLetter, or generateFromTemplate)
  3. The drafting tools will use the template structure + applicant profile + criteria analysis to generate a complete, polished document
- After drafting, explain what was generated and suggest any revisions needed.
- Proactively suggest which documents would strengthen weak criteria.
- Be specific about USCIS requirements and what each document should demonstrate.

DOCUMENT GENERATION:
- Templates provide the structure, formatting, and tone for each document type
- The system uses the template + applicant profile + criteria analysis to generate actual content
- Generated documents are complete drafts ready for applicant review - not templates with placeholders
- Each document is saved and linked to relevant criteria

EB-1A CRITERIA (need ${opts.threshold}+ Strong):
${criteriaList}

${profileSection}

${analysisSection}

${templateSection}

TOOL USAGE RULES:
- Call getProfile and getAnalysis before drafting to ensure documents reflect current case data.
- Call listDocuments to check what already exists before creating duplicates.
- Call listTemplates to see available templates and their content when you need to pick the right one.
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

    listTemplates: tool({
      description:
        "List all available templates for this case with their full content. Use this to see what templates are available and understand their structure before drafting documents.",
      inputSchema: z.object({
        type: z
          .enum(["PERSONAL_STATEMENT", "RECOMMENDATION_LETTER", "PETITION", "USCIS_FORM", "OTHER"])
          .optional()
          .describe("Filter by template type"),
      }),
      execute: async ({ type }) => {
        console.log(`${logPrefix} [listTemplates] Called, type filter: ${type}`);
        const templates = await db.template.findMany({
          where: {
            active: true,
            applicationType: { cases: { some: { id: caseId } } },
            ...(type ? { type } : {}),
          },
          select: {
            id: true,
            name: true,
            type: true,
            content: true,
            version: true,
          },
          orderBy: { name: "asc" },
        });
        console.log(`${logPrefix} [listTemplates] Found ${templates.length} templates`);
        return {
          templates: templates.map((t) => ({
            id: t.id,
            name: t.name,
            type: t.type,
            version: t.version,
            content: t.content,
          })),
        };
      },
    }),

    draftRecommendationLetter: tool({
      description:
        "Draft a recommendation letter for the EB-1A petition. Uses the recommendation letter template and applicant profile to generate a complete letter from the recommender's perspective.",
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

        const template = await db.template.findFirst({
          where: {
            type: "RECOMMENDATION_LETTER",
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

        const relevantCriteria = analysisCriteria.filter((c) =>
          criterionKeys.includes(c.criterionId),
        );

        const applicantName =
          (profileData.name as string) ?? "the applicant";

        const criterionMapping = criterionKeys.length > 0
          ? await db.criteriaMapping.findFirst({
              where: {
                criterionKey: criterionKeys[0],
                applicationType: { cases: { some: { id: caseId } } },
              },
            })
          : null;

        // Create document first with empty content so frontend can start polling
        const doc = await db.document.create({
          data: {
            caseId,
            name: `Recommendation Letter - ${recommenderName}`,
            type: "MARKDOWN",
            source: "SYSTEM_GENERATED",
            content: "",
            status: "DRAFT",
            criterionId: criterionMapping?.id ?? null,
            templateId: template?.id ?? null,
          },
        });

        console.log(`${logPrefix} [draftRecLetter] Created document ${doc.id}, streaming content`);

        // Stream content to the document
        const finalContent = await streamDocumentContent({
          documentId: doc.id,
          documentType: "Recommendation Letter",
          templateContent: template?.content ?? null,
          templateName: template?.name ?? null,
          profile: profileData,
          criteria: relevantCriteria.length > 0 ? relevantCriteria : analysisCriteria,
          additionalContext,
          specificInstructions: `This letter is from ${recommenderName}, ${recommenderTitle}.
Relationship to applicant: ${recommenderRelation}
The letter should address these EB-1A criteria: ${criterionKeys.join(", ")}
Write in first person from the recommender's perspective. The recommender is vouching for the applicant's extraordinary ability based on their professional relationship.`,
        });

        if (isS3Configured()) {
          try {
            const key = buildDocumentKey(
              caseId,
              doc.id,
              `rec-letter-${recommenderName.toLowerCase().replace(/\s+/g, "-")}.md`,
            );
            const { url } = await uploadToS3(
              key,
              Buffer.from(finalContent),
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
          `${logPrefix} [draftRecLetter] Finished streaming document ${doc.id}`,
        );
        return {
          success: true,
          documentId: doc.id,
          name: doc.name,
          status: doc.status,
          templateUsed: template?.name ?? "default",
        };
      },
    }),

    draftPersonalStatement: tool({
      description:
        "Draft a personal statement for the EB-1A petition. Uses the personal statement template and applicant profile to generate a complete, polished document.",
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
          .describe("Any additional context or instructions for the statement"),
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
        const relevantCriteria = focusOn.length > 0
          ? analysisCriteria.filter((c) => focusOn.includes(c.criterionId))
          : analysisCriteria;

        const applicantName =
          (profileData.name as string) ?? "the applicant";

        // Create document first with empty content so frontend can start polling
        const doc = await db.document.create({
          data: {
            caseId,
            name: `Personal Statement - ${applicantName}`,
            type: "MARKDOWN",
            source: "SYSTEM_GENERATED",
            content: "",
            status: "DRAFT",
            templateId: template?.id ?? null,
          },
        });

        console.log(`${logPrefix} [draftPersonalStatement] Created document ${doc.id}, streaming content`);

        // Stream content to the document
        const finalContent = await streamDocumentContent({
          documentId: doc.id,
          documentType: "Personal Statement",
          templateContent: template?.content ?? null,
          templateName: template?.name ?? null,
          profile: profileData,
          criteria: relevantCriteria,
          additionalContext,
          specificInstructions: focusCriteria
            ? `Focus especially on these criteria: ${focusCriteria.join(", ")}`
            : undefined,
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
              Buffer.from(finalContent),
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
          `${logPrefix} [draftPersonalStatement] Finished streaming document ${doc.id}`,
        );
        return {
          success: true,
          documentId: doc.id,
          name: doc.name,
          status: doc.status,
          templateUsed: template?.name ?? "default",
        };
      },
    }),

    generateFromTemplate: tool({
      description:
        "Generate a document from a specific template. Uses the template structure, applicant profile, and criteria analysis to generate a complete document. Use this for petition letters, USCIS form instructions, or any template-based document.",
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

        // Replace {{var}} placeholders in template content before passing to LLM
        let processedTemplate = template.content;
        if (variables) {
          for (const [key, value] of Object.entries(variables)) {
            processedTemplate = processedTemplate.replace(
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

        const criterionMapping =
          criterionKeys && criterionKeys.length > 0
            ? await db.criteriaMapping.findFirst({
                where: {
                  criterionKey: criterionKeys[0],
                  applicationType: { cases: { some: { id: caseId } } },
                },
              })
            : null;

        // Create document first with empty content so frontend can start polling
        const doc = await db.document.create({
          data: {
            caseId,
            name: `${template.name} - ${applicantName}`,
            type: "MARKDOWN",
            source: "SYSTEM_GENERATED",
            content: "",
            status: "DRAFT",
            criterionId: criterionMapping?.id ?? null,
            templateId: template.id,
          },
        });

        console.log(`${logPrefix} [generateFromTemplate] Created document ${doc.id}, streaming content`);

        // Stream content to the document
        const finalContent = await streamDocumentContent({
          documentId: doc.id,
          documentType: template.name,
          templateContent: processedTemplate,
          templateName: template.name,
          profile: profileData,
          criteria: relevantCriteria.length > 0 ? relevantCriteria : analysisCriteria,
          additionalContext,
          specificInstructions: criterionKeys
            ? `Focus on these criteria: ${criterionKeys.join(", ")}`
            : undefined,
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
              Buffer.from(finalContent),
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
          `${logPrefix} [generateFromTemplate] Finished streaming document ${doc.id}`,
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
