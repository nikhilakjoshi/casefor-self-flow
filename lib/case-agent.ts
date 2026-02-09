import { ToolLoopAgent, tool, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { db } from "./db";
import { queryContext, type RAGResult } from "./rag";
import { getCriteriaForCase, type Criterion } from "./criteria";
import { countCriteriaStrengths, type CriterionResult } from "./eb1a-agent";

const MODEL = "claude-sonnet-4-20250514";
const MAX_HISTORY = 20;

function buildSystemPrompt(opts: {
  criteria: Criterion[];
  threshold: number;
  profile: Record<string, unknown> | null;
  analysis: CriterionResult[] | null;
  ragContext: string[];
  skippedSections: string[];
}): string {
  const criteriaListFull = opts.criteria
    .map((c) => `- ${c.key}: ${c.name} -- ${c.description}`)
    .join("\n");
  const profileSection = opts.profile
    ? `CURRENT APPLICANT PROFILE:\n${JSON.stringify(opts.profile, null, 2)}`
    : "APPLICANT PROFILE: Not yet established.";

  const analysisSection = opts.analysis
    ? `CURRENT ANALYSIS:\n${opts.analysis.map((c) => `${c.criterionId}: ${c.strength} - ${c.reason}`).join("\n")}`
    : "ANALYSIS: No analysis yet.";

  const ragSection =
    opts.ragContext.length > 0
      ? `RELEVANT DOCUMENT EXCERPTS:\n${opts.ragContext.join("\n---\n")}`
      : "";

  const skippedContext =
    opts.skippedSections.length > 0
      ? `\nSKIPPED INTAKE SECTIONS: ${opts.skippedSections.join(", ")}. The user skipped these during intake. When relevant information is needed from these sections, use the emitIntakeForm tool to ask the user to fill in the missing info.`
      : "";

  return `You are an expert EB-1A immigration paralegal assistant. You help applicants build strong Extraordinary Ability visa cases.

FORMATTING: Do not use emojis in any responses.

YOUR BEHAVIOR:
- You are proactive. After processing any information, immediately use your tools to update the profile and analysis.
- Always call updateProfile when you learn new facts about the applicant (name, role, achievements, publications, etc).
- Always call updateAnalysis when new evidence affects any criteria. Pass all affected criteria in a single call.
- After tool calls, respond conversationally: acknowledge what you learned, explain how it impacts the case, then ask for the next piece of evidence or suggest what would strengthen weak criteria.
- Be specific about USCIS requirements. Cite which criteria benefit from the evidence.
- When suggesting next steps, be concrete: "Do you have a letter from Dr. X confirming your contribution?" not just "get recommendation letters."
${skippedContext}

THE 10 EB-1A CRITERIA (need ${opts.threshold}+ Strong):
${criteriaListFull}

${profileSection}

${analysisSection}

${ragSection}

TOOL USAGE RULES:
- Call updateProfile with a merge object. Existing fields are preserved; new fields are added/overwritten.
- When the user provides new evidence, uploads a document, or shares information that could affect any criterion: first call getLatestAnalysis to see the current state, then call updateAnalysis with the criteria that should be upgraded based on the new evidence.
- Call updateAnalysis with an array of all criteria that changed. Only include criteria whose strength should increase. Include specific evidence quotes for each.
- For the initial greeting (no user messages yet), introduce yourself and summarize the current case state, then ask what the applicant wants to work on first.
- Use emitIntakeForm when you need information from a skipped intake section. The form will be rendered as an interactive card in the chat.`;
}

export function createCaseAgentTools(caseId: string, criteria: Criterion[]) {
  const logPrefix = `[CaseAgent:${caseId}]`;
  const criteriaKeys = criteria.map((c) => c.key) as [string, ...string[]];

  return {
    updateProfile: tool({
      description:
        "Update the applicant profile with new information. Pass a partial object; it will be merged with existing data. Use this whenever you learn new facts about the applicant.",
      inputSchema: z.object({
        updates: z
          .record(z.string(), z.unknown())
          .describe(
            'Key-value pairs to merge into the profile. E.g. {name: "Jane", currentRole: "Senior Researcher", institution: "MIT", publications: [{title: "...", journal: "...", year: 2023}]}',
          ),
      }),
      execute: async ({ updates }) => {
        console.log(
          `${logPrefix} [updateProfile] Called with updates:`,
          JSON.stringify(updates, null, 2),
        );

        const existing = await db.caseProfile.findUnique({
          where: { caseId },
        });
        console.log(
          `${logPrefix} [updateProfile] Existing profile:`,
          existing ? "found" : "not found",
        );

        const currentData = (existing?.data as Record<string, unknown>) ?? {};
        const merged = deepMerge(currentData, updates);
        console.log(
          `${logPrefix} [updateProfile] Merged profile keys:`,
          Object.keys(merged),
        );

        await db.caseProfile.upsert({
          where: { caseId },
          create: { caseId, data: merged as any },
          update: { data: merged as any },
        });
        console.log(
          `${logPrefix} [updateProfile] Profile upserted successfully`,
        );

        const result = { success: true, profile: merged };
        console.log(`${logPrefix} [updateProfile] Returning:`, {
          success: true,
          profileKeys: Object.keys(merged),
        });
        return result;
      },
    }),

    getLatestAnalysis: tool({
      description:
        "Fetch the latest EB-1A criteria analysis from the database. Call this before updateAnalysis so you know the current state of each criterion and can make informed updates.",
      inputSchema: z.object({}),
      execute: async () => {
        console.log(`${logPrefix} [getLatestAnalysis] Called`);

        const analysis = await db.eB1AAnalysis.findFirst({
          where: { caseId },
          orderBy: { createdAt: "desc" },
        });

        if (!analysis) {
          console.log(`${logPrefix} [getLatestAnalysis] No analysis found`);
          return { exists: false, version: 0, criteria: null };
        }

        console.log(
          `${logPrefix} [getLatestAnalysis] Found analysis v${analysis.version}, strong: ${analysis.strongCount}, weak: ${analysis.weakCount}`,
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

    updateThreshold: tool({
      description:
        "Update the criteria threshold for this case. The threshold is the number of Strong criteria needed for a viable case. Default is 3 per USCIS guidelines. Adjust if the applicant or attorney prefers a different target.",
      inputSchema: z.object({
        threshold: z
          .number()
          .int()
          .min(1)
          .max(10)
          .describe("New threshold value (1-10)"),
      }),
      execute: async ({ threshold }) => {
        console.log(
          `${logPrefix} [updateThreshold] Setting threshold to ${threshold}`,
        );
        await db.case.update({
          where: { id: caseId },
          data: { criteriaThreshold: threshold },
        });
        console.log(
          `${logPrefix} [updateThreshold] Threshold updated successfully`,
        );
        return { success: true, newThreshold: threshold };
      },
    }),

    updateAnalysis: tool({
      description:
        "Create a new version of the EB-1A criteria analysis. Always creates a new version with incremented version number. Pass only the criteria that changed -- unchanged criteria are preserved from the previous version. New evidence and reasons are merged with existing data.",
      inputSchema: z.object({
        updates: z
          .array(
            z.object({
              criterionId: z.enum(criteriaKeys).describe("Criterion ID"),
              strength: z.enum(["Strong", "Weak", "None"]),
              reason: z.string().describe("Explanation of the assessment"),
              evidence: z
                .array(z.string())
                .describe("Specific evidence quotes"),
            }),
          )
          .describe("Array of criteria to update"),
      }),
      execute: async ({ updates }) => {
        console.log(
          `${logPrefix} [updateAnalysis] Called with ${updates.length} updates:`,
          updates.map((u) => `${u.criterionId}: ${u.strength}`),
        );

        const current = await db.eB1AAnalysis.findFirst({
          where: { caseId },
          orderBy: { createdAt: "desc" },
        });
        console.log(
          `${logPrefix} [updateAnalysis] Current analysis:`,
          current ? `v${current.version}` : "none",
        );

        const strengthRank = { None: 0, Weak: 1, Strong: 2 } as const;
        const prevVersion = current?.version ?? 0;
        const updateMap = new Map(updates.map((u) => [u.criterionId, u]));

        // Build base criteria from previous version or defaults
        const baseCriteria: CriterionResult[] = current
          ? (current.criteria as CriterionResult[])
          : criteria.map((c) => ({
              criterionId: c.key,
              strength: "None" as const,
              reason: "Not yet evaluated",
              evidence: [],
            }));
        console.log(
          `${logPrefix} [updateAnalysis] Base criteria count: ${baseCriteria.length}`,
        );

        // Merge updates into base -- upgrade strength, append new evidence
        const mergedCriteria = baseCriteria.map((c) => {
          const upd = updateMap.get(c.criterionId);
          if (!upd) return c;

          const newStrength =
            strengthRank[upd.strength] > strengthRank[c.strength]
              ? upd.strength
              : c.strength;

          // Dedupe and merge evidence
          const existingEvidence = new Set(c.evidence);
          const combinedEvidence = [
            ...c.evidence,
            ...upd.evidence.filter((e) => !existingEvidence.has(e)),
          ];

          console.log(
            `${logPrefix} [updateAnalysis] Merging ${c.criterionId}: ${c.strength} -> ${newStrength}, evidence count: ${c.evidence.length} -> ${combinedEvidence.length}`,
          );

          return {
            criterionId: c.criterionId,
            strength: newStrength,
            reason: upd.reason,
            evidence: combinedEvidence,
          };
        });

        const counts = countCriteriaStrengths({ criteria: mergedCriteria });
        const newVersion = prevVersion + 1;
        console.log(
          `${logPrefix} [updateAnalysis] Creating v${newVersion}, strong: ${counts.strong}, weak: ${counts.weak}`,
        );

        await db.eB1AAnalysis.create({
          data: {
            caseId,
            version: newVersion,
            criteria: mergedCriteria as any,
            strongCount: counts.strong,
            weakCount: counts.weak,
          },
        });
        console.log(
          `${logPrefix} [updateAnalysis] Analysis v${newVersion} created successfully`,
        );

        const result = {
          success: true,
          version: newVersion,
          updated: updates.map((u) => u.criterionId),
          strongCount: counts.strong,
          weakCount: counts.weak,
        };
        console.log(`${logPrefix} [updateAnalysis] Returning:`, result);
        return result;
      },
    }),

    emitIntakeForm: tool({
      description:
        "Emit a structured form card in the chat for the user to fill in missing intake information. Use this when you need info from a skipped intake section. The form will be rendered as an interactive card.",
      inputSchema: z.object({
        section: z
          .enum(["background", "achievements", "immigration", "preferences"])
          .describe("The intake section to collect info for"),
        fields: z
          .array(
            z.object({
              key: z.string().describe("Field identifier"),
              label: z.string().describe("Display label for the field"),
              type: z
                .enum(["text", "number", "boolean", "textarea"])
                .describe("Input type"),
              placeholder: z.string().optional().describe("Placeholder text"),
            })
          )
          .describe("Fields to include in the form"),
        prompt: z.string().optional().describe("Optional message to show with the form"),
      }),
      execute: async ({ section, fields, prompt }) => {
        console.log(`${logPrefix} [emitIntakeForm] Emitting form for section:`, section);
        // Return the form spec - the frontend will render it as an interactive card
        return {
          type: "intake_form",
          section,
          fields,
          prompt: prompt ?? `Please fill in the following ${section} information:`,
        };
      },
    }),
  };
}

export async function runCaseAgent(opts: {
  caseId: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  onFinish?: (text: string) => Promise<void>;
}) {
  const { caseId, messages, onFinish } = opts;
  const log = (msg: string, ...args: unknown[]) =>
    console.log(`[CaseAgent:${caseId}] ${msg}`, ...args);

  log("runCaseAgent called, messages:", messages.length);

  // Gather context
  const [criteria, caseRecord, profile, analysis, ragResults] = await Promise.all([
    getCriteriaForCase(caseId),
    db.case.findUnique({
      where: { id: caseId },
      select: { criteriaThreshold: true, skippedSections: true },
    }),
    db.caseProfile.findUnique({ where: { caseId } }),
    db.eB1AAnalysis.findFirst({
      where: { caseId },
      orderBy: { createdAt: "desc" },
    }),
    messages.length > 0
      ? queryContext(caseId, messages[messages.length - 1].content, 5)
      : Promise.resolve([]),
  ]);

  const threshold = caseRecord?.criteriaThreshold ?? 3;
  const skippedSections = caseRecord?.skippedSections ?? [];
  log("context gathered - criteria:", criteria.length, "threshold:", threshold, "profile:", !!profile, "analysis:", !!analysis, "ragResults:", ragResults.length, "skippedSections:", skippedSections);

  const instructions = buildSystemPrompt({
    criteria,
    threshold,
    profile: (profile?.data as Record<string, unknown>) ?? null,
    analysis: analysis ? (analysis.criteria as CriterionResult[]) : null,
    ragContext: ragResults.map((r: RAGResult) => r.text),
    skippedSections,
  });

  const tools = createCaseAgentTools(caseId, criteria);

  log("creating ToolLoopAgent with model:", MODEL, "tools:", Object.keys(tools));

  const agent = new ToolLoopAgent({
    model: anthropic(MODEL),
    instructions,
    tools,
    stopWhen: stepCountIs(7),
    onStepFinish: ({ toolCalls, toolResults, text, finishReason }) => {
      log("step finished - finishReason:", finishReason);
      log("step text length:", text?.length ?? 0);
      log("step toolCalls:", toolCalls?.map((tc: any) => tc.toolName) ?? "none");
      log("step toolResults:", toolResults?.length ?? 0);
    },
    onFinish: async ({ text }) => {
      log("agent finished, text length:", text?.length ?? 0);
      if (onFinish) await onFinish(text);
    },
  });

  log("starting stream");
  return agent.stream({ messages: messages.slice(-MAX_HISTORY) });
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const tVal = target[key];
    const sVal = source[key];
    if (
      tVal &&
      sVal &&
      typeof tVal === "object" &&
      typeof sVal === "object" &&
      !Array.isArray(tVal) &&
      !Array.isArray(sVal)
    ) {
      result[key] = deepMerge(
        tVal as Record<string, unknown>,
        sVal as Record<string, unknown>,
      );
    } else {
      result[key] = sVal;
    }
  }
  return result;
}
