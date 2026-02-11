import { ToolLoopAgent, tool, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { db } from "./db";
import { getCriteriaForCase, type Criterion } from "./criteria";
import { type CriterionResult } from "./eb1a-agent";
import { queryContext } from "./rag";
import { verifyDocuments } from "./document-verifier";
import { getPrompt, substituteVars, resolveModel } from "./agent-prompt";

const FALLBACK_MODEL = "claude-sonnet-4-20250514";
const MAX_HISTORY = 20;

function hardcodedBuildDocumentSystemPrompt(opts: {
  criteria: Criterion[];
  threshold: number;
  profile: Record<string, unknown> | null;
  analysis: CriterionResult[] | null;
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

  return `You are an expert EB-1A immigration document review specialist. You analyze what documents exist, identify gaps, and provide feedback on document quality.

FORMATTING: Do not use emojis in any responses.

YOUR ROLE:
- Review and analyze uploaded documents for an EB-1A extraordinary ability petition.
- Identify what documents are present, what's missing per the checklist.
- Explain verification feedback and suggest improvements.
- Help users understand document requirements and gaps.
- You do NOT draft documents. Direct users to the Evidence tab for document drafting.

YOUR BEHAVIOR:
- When asked about document gaps, use getChecklist to check verification results.
- When asked about specific document content, use getDocument or searchDocuments.
- Proactively suggest running verifyDocuments when new documents are uploaded.
- Be specific about USCIS requirements and what each document should demonstrate.

IMPORTANT:
- You are a reviewer, not a drafter. If users ask to draft/generate documents, direct them to the Evidence tab.
- Always ground your responses in actual document data by calling tools first.

EB-1A CRITERIA (need ${opts.threshold}+ Strong):
${criteriaList}

${profileSection}

${analysisSection}

TOOL USAGE RULES:
- Call listDocuments and getChecklist to understand the current document state before responding.
- Use searchDocuments to find specific content from uploaded materials.
- Use verifyDocuments to trigger a fresh quality assessment of all documents.
- Use getProfile and getAnalysis to understand the applicant's background and criteria standings.`;
}

async function buildDocumentSystemPrompt(opts: {
  criteria: Criterion[];
  threshold: number;
  profile: Record<string, unknown> | null;
  analysis: CriterionResult[] | null;
}): Promise<string> {
  const p = await getPrompt("document-agent");
  if (!p) return hardcodedBuildDocumentSystemPrompt(opts);

  const criteriaList = opts.criteria
    .map((c) => `- ${c.key}: ${c.name} -- ${c.description}`)
    .join("\n");
  const profileSection = opts.profile
    ? `CURRENT APPLICANT PROFILE:\n${JSON.stringify(opts.profile, null, 2)}`
    : "APPLICANT PROFILE: Not yet established.";
  const analysisSection = opts.analysis
    ? `CURRENT ANALYSIS (${opts.analysis.filter((c) => c.strength === "Strong").length} Strong, need ${opts.threshold}+):\n${opts.analysis.map((c) => `${c.criterionId}: ${c.strength} - ${c.reason}`).join("\n")}`
    : "ANALYSIS: No analysis yet.";

  return substituteVars(p.content, {
    criteria: criteriaList,
    threshold: String(opts.threshold),
    profile: profileSection,
    analysis: analysisSection,
  });
}

function createDocumentAgentTools(caseId: string) {
  const logPrefix = `[DocumentAgent:${caseId}]`;

  return {
    listDocuments: tool({
      description:
        "List all documents for this case with metadata.",
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

    getDocument: tool({
      description:
        "Fetch a single document's full content by ID.",
      inputSchema: z.object({
        documentId: z.string().describe("ID of the document to fetch"),
      }),
      execute: async ({ documentId }) => {
        console.log(`${logPrefix} [getDocument] Fetching ${documentId}`);
        const doc = await db.document.findFirst({
          where: { id: documentId, caseId },
        });
        if (!doc) {
          return { found: false, document: null };
        }
        return {
          found: true,
          document: {
            id: doc.id,
            name: doc.name,
            type: doc.type,
            source: doc.source,
            status: doc.status,
            content: doc.content,
            createdAt: doc.createdAt,
          },
        };
      },
    }),

    searchDocuments: tool({
      description:
        "RAG search across uploaded documents and case materials.",
      inputSchema: z.object({
        query: z.string().describe("Search query"),
        topK: z.number().optional().default(5).describe("Number of results"),
      }),
      execute: async ({ query, topK }) => {
        console.log(`${logPrefix} [searchDocuments] Query: "${query}", topK: ${topK}`);
        const results = await queryContext(caseId, query, topK);
        console.log(`${logPrefix} [searchDocuments] Found ${results.length} results`);
        return { results };
      },
    }),

    getProfile: tool({
      description:
        "Fetch the applicant profile for this case.",
      inputSchema: z.object({}),
      execute: async () => {
        console.log(`${logPrefix} [getProfile] Called`);
        const profile = await db.caseProfile.findUnique({
          where: { caseId },
        });
        if (!profile) return { exists: false, data: null };
        return { exists: true, data: profile.data };
      },
    }),

    getAnalysis: tool({
      description:
        "Fetch the latest EB-1A criteria analysis.",
      inputSchema: z.object({}),
      execute: async () => {
        console.log(`${logPrefix} [getAnalysis] Called`);
        const analysis = await db.eB1AAnalysis.findFirst({
          where: { caseId },
          orderBy: { createdAt: "desc" },
        });
        if (!analysis) return { exists: false, criteria: null };
        return {
          exists: true,
          version: analysis.version,
          criteria: analysis.criteria,
          strongCount: analysis.strongCount,
          weakCount: analysis.weakCount,
        };
      },
    }),

    getChecklist: tool({
      description:
        "Fetch the document checklist with latest verification results. Shows which documents exist, their quality ratings, and what's missing.",
      inputSchema: z.object({}),
      execute: async () => {
        console.log(`${logPrefix} [getChecklist] Called`);
        const latestVerification = await db.documentVerification.findFirst({
          where: { caseId },
          orderBy: { createdAt: "desc" },
        });
        if (!latestVerification) {
          // No verification yet, just list docs
          const docs = await db.document.findMany({
            where: { caseId },
            select: { id: true, name: true, status: true, source: true },
          });
          return {
            verified: false,
            documentCount: docs.length,
            documents: docs,
            message: "No verification has been run yet. Use verifyDocuments to assess quality.",
          };
        }
        return {
          verified: true,
          assessments: latestVerification.assessments,
          overallStrength: latestVerification.overallStrength,
          overallFeedback: latestVerification.overallFeedback,
          lastVerifiedAt: latestVerification.createdAt,
        };
      },
    }),

    verifyDocuments: tool({
      description:
        "Trigger a fresh document verification. Assesses quality of all documents and returns a checklist with ratings and feedback.",
      inputSchema: z.object({}),
      execute: async () => {
        console.log(`${logPrefix} [verifyDocuments] Triggering verification`);
        const result = await verifyDocuments(caseId);
        console.log(`${logPrefix} [verifyDocuments] Done, ${result.summary.total} items checked`);
        return result;
      },
    }),
  };
}

export async function runDocumentAgent(opts: {
  caseId: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  onFinish?: (text: string) => Promise<void>;
}) {
  const { caseId, messages, onFinish } = opts;
  const log = (msg: string, ...args: unknown[]) =>
    console.log(`[DocumentAgent:${caseId}] ${msg}`, ...args);

  log("runDocumentAgent called, messages:", messages.length);

  const [criteria, caseRecord, profile, analysis] = await Promise.all([
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
  ]);

  const threshold = caseRecord?.criteriaThreshold ?? 3;
  log("context gathered - criteria:", criteria.length, "threshold:", threshold);

  const instructions = await buildDocumentSystemPrompt({
    criteria,
    threshold,
    profile: (profile?.data as Record<string, unknown>) ?? null,
    analysis: analysis ? (analysis.criteria as CriterionResult[]) : null,
  });

  const tools = createDocumentAgentTools(caseId);
  const p = await getPrompt("document-agent");

  log("creating ToolLoopAgent with model:", p?.modelName ?? FALLBACK_MODEL, "tools:", Object.keys(tools));

  const agent = new ToolLoopAgent({
    model: p ? resolveModel(p.provider, p.modelName) : anthropic(FALLBACK_MODEL),
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
