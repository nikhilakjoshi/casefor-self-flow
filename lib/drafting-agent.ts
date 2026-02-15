import { ToolLoopAgent, tool, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { db } from "./db";
import { getCriteriaForCase, type Criterion } from "./criteria";
import { type CriterionResult } from "./eb1a-agent";
import { queryContext } from "./rag";
import { getPrompt, substituteVars, resolveModel } from "./agent-prompt";
import { resolveVariation } from "./template-resolver";

const FALLBACK_MODEL = "claude-sonnet-4-20250514";
const MAX_HISTORY = 20;

function hardcodedBuildDraftingSystemPrompt(opts: {
  criteria: Criterion[];
  threshold: number;
  profile: Record<string, unknown> | null;
  analysis: CriterionResult[] | null;
  documentName?: string;
  existingContent?: string | null;
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

  const docSection = opts.documentName
    ? `CURRENT DOCUMENT: "${opts.documentName}"${opts.existingContent ? `\n\nEXISTING CONTENT:\n${opts.existingContent}` : ""}`
    : "";

  return `You are an expert document drafter for EB-1A extraordinary ability immigration petitions. You produce polished, complete document content.

FORMATTING: Do not use emojis in any responses or generated documents.

YOUR ROLE:
- Draft and revise documents: recommendation letters, personal statements, petition letters, cover letters, and other supporting documents.
- Your text output IS the document content. It will be placed directly into the editor.
- Output ONLY the document content in markdown format. No meta-commentary, no explanations, no conversational text.

YOUR BEHAVIOR:
1. When asked to draft a new document, first gather context using your tools (profile, analysis, recommender info, existing documents).
2. Then produce the full document as your response text.
3. When asked to revise, regenerate the ENTIRE document with the requested changes applied.
4. Use specific details from the applicant's profile -- never use placeholders like [NAME] or [FIELD].
5. Write in a professional, compelling tone appropriate for USCIS submissions.
6. Ground your writing in real evidence from the case materials.

IMPORTANT:
- Your entire text response becomes the document content in the editor.
- Do NOT include any conversational text, greetings, or explanations in your response.
- Just output the document markdown directly.

EB-1A CRITERIA (need ${opts.threshold}+ Strong):
${criteriaList}

${profileSection}

${analysisSection}

${docSection}

TOOL USAGE:
- Call getProfile and getAnalysis before drafting to use real applicant data.
- Call searchDocuments to find relevant content from uploaded materials.
- Call getRecommender when drafting recommendation letters.
- Call getCurrentDocument to see the current document content before revising.
- Call getDenialProbability to check for denial risk factors, red flags, and weak criteria -- then proactively address these weaknesses in the document.

DENIAL RISK AWARENESS:
- Before drafting cover letters, personal statements, or petition letters, always call getDenialProbability.
- If denial data exists, address identified red flags and weak criteria directly in the document.
- For recommendation letters, ensure the letter reinforces criteria flagged as weak or at risk of RFE.
- Reference specific evidence that counters the denial risk factors identified.`;
}

async function buildDraftingSystemPrompt(opts: {
  criteria: Criterion[];
  threshold: number;
  profile: Record<string, unknown> | null;
  analysis: CriterionResult[] | null;
  documentName?: string;
  existingContent?: string | null;
}): Promise<string> {
  const p = await getPrompt("drafting-agent");
  if (!p) return hardcodedBuildDraftingSystemPrompt(opts);

  const criteriaList = opts.criteria
    .map((c) => `- ${c.key}: ${c.name} -- ${c.description}`)
    .join("\n");
  const profileSection = opts.profile
    ? `CURRENT APPLICANT PROFILE:\n${JSON.stringify(opts.profile, null, 2)}`
    : "APPLICANT PROFILE: Not yet established.";
  const analysisSection = opts.analysis
    ? `CURRENT ANALYSIS (${opts.analysis.filter((c) => c.strength === "Strong").length} Strong, need ${opts.threshold}+):\n${opts.analysis.map((c) => `${c.criterionId}: ${c.strength} - ${c.reason}`).join("\n")}`
    : "ANALYSIS: No analysis yet.";
  const docSection = opts.documentName
    ? `CURRENT DOCUMENT: "${opts.documentName}"${opts.existingContent ? `\n\nEXISTING CONTENT:\n${opts.existingContent}` : ""}`
    : "";

  return substituteVars(p.content, {
    criteria: criteriaList,
    threshold: String(opts.threshold),
    profile: profileSection,
    analysis: analysisSection,
    documentName: docSection,
    existingContent: "",
  });
}

function createDraftingAgentTools(caseId: string, documentId?: string) {
  const logPrefix = `[DraftingAgent:${caseId}]`;

  return {
    getProfile: tool({
      description: "Fetch the applicant profile for this case.",
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
      description: "Fetch the latest EB-1A criteria analysis.",
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

    getRecommender: tool({
      description:
        "Get full details of a recommender by ID. Use when drafting recommendation letters.",
      inputSchema: z.object({
        recommenderId: z.string().describe("ID of the recommender"),
      }),
      execute: async ({ recommenderId }) => {
        console.log(`${logPrefix} [getRecommender] Fetching ${recommenderId}`);
        const recommender = await db.recommender.findFirst({
          where: { id: recommenderId, caseId },
          include: {
            documents: {
              select: { id: true, name: true, type: true, status: true },
            },
          },
        });
        if (!recommender) return { found: false, recommender: null };
        return { found: true, recommender };
      },
    }),

    searchDocuments: tool({
      description:
        "RAG search across uploaded documents and case materials for relevant content.",
      inputSchema: z.object({
        query: z.string().describe("Search query"),
        topK: z.number().optional().default(5).describe("Number of results"),
      }),
      execute: async ({ query, topK }) => {
        console.log(`${logPrefix} [searchDocuments] Query: "${query}", topK: ${topK}`);
        const results = await queryContext(caseId, query, topK);
        return { results };
      },
    }),

    getCurrentDocument: tool({
      description:
        "Fetch the current document content being edited. Use before revisions.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!documentId) return { found: false, content: null };
        console.log(`${logPrefix} [getCurrentDocument] Fetching ${documentId}`);
        const doc = await db.document.findFirst({
          where: { id: documentId, caseId },
        });
        if (!doc) return { found: false, content: null };
        return {
          found: true,
          id: doc.id,
          name: doc.name,
          content: doc.content,
        };
      },
    }),

    getDenialProbability: tool({
      description:
        "Fetch the latest denial probability assessment for this case. Returns risk factors, weak criteria, red flags, recommendations, and probability breakdown. Use before drafting to proactively address weaknesses.",
      inputSchema: z.object({}),
      execute: async () => {
        console.log(`${logPrefix} [getDenialProbability] Called`);
        const latest = await db.denialProbability.findFirst({
          where: { caseId },
          orderBy: { createdAt: "desc" },
        });
        if (!latest) return { exists: false, data: null };
        return { exists: true, data: latest.data };
      },
    }),
  };
}

/** Map DocumentCategory to category-specific prompt slug */
function getCategoryPromptSlug(category?: string): string | null {
  switch (category) {
    case "COVER_LETTER":
      return "cover-letter-drafter";
    case "USCIS_ADVISORY_LETTER":
      return "uscis-letter-drafter";
    case "RESUME_CV":
      return "resume-drafter";
    default:
      return null;
  }
}

export async function runDraftingAgent(opts: {
  caseId: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  documentId?: string;
  documentName?: string;
  existingContent?: string | null;
  category?: string;
  recommenderId?: string;
  templateInputs?: Record<string, string>;
  onFinish?: (text: string) => Promise<void>;
}) {
  const { caseId, messages, documentId, documentName, existingContent, category, recommenderId, templateInputs, onFinish } = opts;
  const log = (msg: string, ...args: unknown[]) =>
    console.log(`[DraftingAgent:${caseId}] ${msg}`, ...args);

  log("runDraftingAgent called, messages:", messages.length, "category:", category);

  const [criteria, caseRecord, profile, analysis] = await Promise.all([
    getCriteriaForCase(caseId),
    db.case.findUnique({
      where: { id: caseId },
      select: { criteriaThreshold: true, applicationTypeId: true },
    }),
    db.caseProfile.findUnique({ where: { caseId } }),
    db.eB1AAnalysis.findFirst({
      where: { caseId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const threshold = caseRecord?.criteriaThreshold ?? 3;
  log("context gathered - criteria:", criteria.length, "threshold:", threshold);

  const promptOpts = {
    criteria,
    threshold,
    profile: (profile?.data as Record<string, unknown>) ?? null,
    analysis: analysis ? (analysis.criteria as CriterionResult[]) : null,
    documentName,
    existingContent,
  };

  // Try category-specific prompt first, fall back to generic drafting-agent prompt
  const categorySlug = getCategoryPromptSlug(category);
  let instructions: string;
  let p = categorySlug ? await getPrompt(categorySlug) : null;
  if (p) {
    log("using category-specific prompt:", categorySlug);
    const criteriaList = criteria
      .map((c) => `- ${c.key}: ${c.name} -- ${c.description}`)
      .join("\n");
    const profileSection = promptOpts.profile
      ? `CURRENT APPLICANT PROFILE:\n${JSON.stringify(promptOpts.profile, null, 2)}`
      : "APPLICANT PROFILE: Not yet established.";
    const analysisSection = promptOpts.analysis
      ? `CURRENT ANALYSIS (${promptOpts.analysis.filter((c) => c.strength === "Strong").length} Strong, need ${threshold}+):\n${promptOpts.analysis.map((c) => `${c.criterionId}: ${c.strength} - ${c.reason}`).join("\n")}`
      : "ANALYSIS: No analysis yet.";
    const docSection = documentName
      ? `CURRENT DOCUMENT: "${documentName}"${existingContent ? `\n\nEXISTING CONTENT:\n${existingContent}` : ""}`
      : "";

    instructions = substituteVars(p.content, {
      criteria: criteriaList,
      threshold: String(threshold),
      profile: profileSection,
      analysis: analysisSection,
      documentName: docSection,
      existingContent: "",
    });
  } else {
    instructions = await buildDraftingSystemPrompt(promptOpts);
    p = await getPrompt("drafting-agent");
  }

  // Resolve template variation for recommendation letters
  if (category === "RECOMMENDATION_LETTER" && recommenderId) {
    const recommender = await db.recommender.findFirst({
      where: { id: recommenderId, caseId },
    });
    if (recommender) {
      const appTypeId = caseRecord?.applicationTypeId;
      if (appTypeId) {
        const templateId = `${appTypeId}-RECOMMENDATION_LETTER`;
        const variation = await resolveVariation(templateId, {
          relationshipType: recommender.relationshipType,
        });
        if (variation) {
          log("resolved template variation:", variation.label);
          instructions += `\n\nTEMPLATE VARIATION (${variation.label}):\n${variation.content}`;
        }
      }
    }
  }

  // Append user-provided template inputs for recommendation letters
  if (templateInputs) {
    const filled = Object.entries(templateInputs)
      .filter(([, v]) => v && v.trim())
      .map(([k, v]) => `- ${k}: ${v.trim()}`)
      .join("\n");
    if (filled) {
      instructions += `\n\nUSER-PROVIDED TEMPLATE INPUTS:\n${filled}\nUse these inputs to personalize and ground the document.`;
    }
  }

  const tools = createDraftingAgentTools(caseId, documentId);

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
