import { streamText } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getCriteriaForCase, type Criterion } from "@/lib/criteria"
import { queryContext } from "@/lib/rag"
import {
  commandIdsForCategory,
  DEFAULT_OUTLINE,
  OUTLINE_TEMPLATES,
  PROFILE_FIELDS,
  type SlashCommand,
  type SlashCommandId,
} from "@/lib/slash-commands"

const MODEL = "claude-sonnet-4-20250514"

// ---------------------------------------------------------------------------
// GET — list the slash commands available for the given case + category.
// ---------------------------------------------------------------------------

export async function GET(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

  const { caseId } = await params
  const caseRecord = await db.case.findUnique({ where: { id: caseId } })
  if (!caseRecord || caseRecord.userId !== session.user.id) {
    return new Response("Not found", { status: 404 })
  }

  const url = new URL(request.url)
  const category = url.searchParams.get("category")
  const ids = commandIdsForCategory(category)

  const [criteria, recommenders, latestGap, latestDenial, documents] = await Promise.all([
    ids.some((id) => id === "evidence" || id === "argue")
      ? getCriteriaForCase(caseId)
      : Promise.resolve<Criterion[]>([]),
    ids.includes("recommender")
      ? db.recommender.findMany({
          where: { caseId },
          select: {
            id: true,
            name: true,
            title: true,
            organization: true,
            relationshipType: true,
          },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    ids.includes("address-weakness")
      ? db.gapAnalysis.findFirst({
          where: { caseId },
          orderBy: { createdAt: "desc" },
          select: { data: true },
        })
      : Promise.resolve(null),
    ids.includes("address-weakness")
      ? db.denialProbability.findFirst({
          where: { caseId },
          orderBy: { createdAt: "desc" },
          select: { data: true },
        })
      : Promise.resolve(null),
    ids.includes("exhibit")
      ? db.document.findMany({
          where: { caseId },
          select: { id: true, name: true, category: true },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ])

  const commands: SlashCommand[] = ids
    .map((id) => buildCommand(id, { criteria, recommenders, latestGap, latestDenial, documents }))
    .filter((c): c is SlashCommand => c !== null)

  return Response.json({ commands })
}

interface BuildContext {
  criteria: Criterion[]
  recommenders: Array<{
    id: string
    name: string
    title: string
    organization: string | null
    relationshipType: string
  }>
  latestGap: { data: unknown } | null
  latestDenial: { data: unknown } | null
  documents: Array<{ id: string; name: string; category: string | null }>
}

function buildCommand(id: SlashCommandId, ctx: BuildContext): SlashCommand | null {
  switch (id) {
    case "outline":
      return {
        id,
        label: "Outline",
        description: "Insert a structured skeleton for this document type",
        icon: "list-ordered",
        needsLLM: false,
        argKind: "none",
        args: [],
      }
    case "profile":
      return {
        id,
        label: "Insert profile fact",
        description: "Pull a fact from the applicant profile",
        icon: "user",
        needsLLM: false,
        argKind: "profile-field",
        args: PROFILE_FIELDS.map((f) => ({
          value: f.value,
          label: f.label,
          description: f.description,
        })),
      }
    case "recommender":
      if (ctx.recommenders.length === 0) return null
      return {
        id,
        label: "Insert recommender",
        description: "Insert recommender credentials and relationship context",
        icon: "user-check",
        needsLLM: false,
        argKind: "recommender",
        args: ctx.recommenders.map((r) => ({
          value: r.id,
          label: r.name,
          description: [r.title, r.organization].filter(Boolean).join(", ") || r.relationshipType,
        })),
      }
    case "exhibit":
      if (ctx.documents.length === 0) return null
      return {
        id,
        label: "Cite exhibit",
        description: "Insert a formatted reference to a document in the package",
        icon: "paperclip",
        needsLLM: false,
        argKind: "free-text",
        args: ctx.documents.slice(0, 30).map((d) => ({
          value: d.id,
          label: d.name,
          description: d.category ?? undefined,
        })),
        placeholder: "Search exhibits...",
      }
    case "evidence":
      if (ctx.criteria.length === 0) return null
      return {
        id,
        label: "Cite evidence",
        description: "Draft a paragraph citing evidence for a criterion",
        icon: "file-search",
        needsLLM: true,
        argKind: "criterion",
        args: ctx.criteria.map((c) => ({
          value: c.key,
          label: c.name,
          description: c.description.slice(0, 80),
        })),
      }
    case "argue":
      if (ctx.criteria.length === 0) return null
      return {
        id,
        label: "Draft legal argument",
        description: "Write a legal argument paragraph for a criterion",
        icon: "scale",
        needsLLM: true,
        argKind: "criterion",
        args: ctx.criteria.map((c) => ({
          value: c.key,
          label: c.name,
          description: c.description.slice(0, 80),
        })),
      }
    case "address-weakness": {
      const weaknesses = extractWeaknesses(ctx.latestGap?.data, ctx.latestDenial?.data)
      if (weaknesses.length === 0) return null
      return {
        id,
        label: "Address weakness",
        description: "Preemptively counter a gap or denial risk",
        icon: "shield-alert",
        needsLLM: true,
        argKind: "weakness",
        args: weaknesses,
      }
    }
  }
}

interface WeaknessRecord {
  value: string // `gap:<idx>` or `redflag:<idx>`
  label: string
  description?: string
}

function extractWeaknesses(gapData: unknown, denialData: unknown): WeaknessRecord[] {
  const out: WeaknessRecord[] = []
  const gap = gapData as { gap_analysis?: { critical_gaps?: Array<{ priority?: string; criterion?: string; issue?: string; impact?: string }> } } | null
  const gaps = gap?.gap_analysis?.critical_gaps ?? []
  gaps.forEach((g, i) => {
    if (!g.issue) return
    out.push({
      value: `gap:${i}`,
      label: g.issue.slice(0, 80),
      description: `${g.priority ?? "MEDIUM"} priority — ${g.criterion ?? "general"}`,
    })
  })
  const denial = denialData as { red_flags?: Array<{ level?: string; description?: string }> } | null
  const flags = denial?.red_flags ?? []
  flags.forEach((f, i) => {
    if (!f.description) return
    out.push({
      value: `redflag:${i}`,
      label: f.description.slice(0, 80),
      description: `${f.level ?? "MEDIUM"} risk flag`,
    })
  })
  return out
}

// ---------------------------------------------------------------------------
// POST — execute a slash command, return a plain-text markdown response.
// Deterministic commands return a one-shot Response; AI commands stream.
// ---------------------------------------------------------------------------

interface ExecuteBody {
  commandId: SlashCommandId
  argValue?: string
  category?: string | null
  documentId?: string
  documentName?: string
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

  const { caseId } = await params
  const caseRecord = await db.case.findUnique({ where: { id: caseId } })
  if (!caseRecord || caseRecord.userId !== session.user.id) {
    return new Response("Not found", { status: 404 })
  }

  const body = (await request.json()) as ExecuteBody
  const { commandId, argValue, category } = body

  try {
    switch (commandId) {
      case "outline":
        return textResponse(OUTLINE_TEMPLATES[category ?? ""] ?? DEFAULT_OUTLINE)

      case "profile":
        return textResponse(await executeProfile(caseId, argValue))

      case "recommender":
        return textResponse(await executeRecommender(caseId, argValue))

      case "exhibit":
        return textResponse(await executeExhibit(caseId, argValue))

      case "evidence":
        return streamEvidence(caseId, argValue)

      case "argue":
        return streamArgue(caseId, argValue, category)

      case "address-weakness":
        return streamAddressWeakness(caseId, argValue)

      default:
        return new Response("Unknown command", { status: 400 })
    }
  } catch (err) {
    console.error(`[slash/${commandId}] error:`, err)
    return new Response("Command failed", { status: 500 })
  }
}

function textResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}

// ---------- deterministic handlers ----------

async function executeProfile(caseId: string, fieldValue?: string): Promise<string> {
  if (!fieldValue) return ""
  const field = PROFILE_FIELDS.find((f) => f.value === fieldValue)
  if (!field) return ""
  const profile = await db.caseProfile.findUnique({ where: { caseId } })
  const data = (profile?.data ?? {}) as Record<string, unknown>
  const value = data[field.jsonPath]
  if (value === undefined || value === null || value === "") {
    return `[${field.label}: not set]`
  }
  return String(value)
}

async function executeRecommender(caseId: string, recommenderId?: string): Promise<string> {
  if (!recommenderId) return ""
  const r = await db.recommender.findFirst({ where: { id: recommenderId, caseId } })
  if (!r) return ""
  const header = [r.title, r.organization].filter(Boolean).join(", ")
  const parts: string[] = []
  parts.push(`**${r.name}**${header ? `, ${header}` : ""}`)
  if (r.credentials) parts.push(r.credentials)
  if (r.bio) parts.push(r.bio)
  if (r.relationshipContext) parts.push(`Relationship with the applicant: ${r.relationshipContext}`)
  return parts.join("\n\n") + "\n\n"
}

async function executeExhibit(caseId: string, documentId?: string): Promise<string> {
  if (!documentId) return ""
  const doc = await db.document.findFirst({
    where: { id: documentId, caseId },
    select: { name: true, category: true },
  })
  if (!doc) return ""
  const catLabel = doc.category ? ` (${doc.category.replace(/_/g, " ").toLowerCase()})` : ""
  return `See Exhibit: ${doc.name}${catLabel}.\n\n`
}

// ---------- streaming handlers ----------

async function streamEvidence(caseId: string, criterionKey?: string): Promise<Response> {
  if (!criterionKey) return textResponse("")
  const [criteria, ragResults, analysis] = await Promise.all([
    getCriteriaForCase(caseId),
    queryContext(caseId, criterionKey, 6),
    db.caseAnalysis.findFirst({ where: { caseId }, orderBy: { createdAt: "desc" } }),
  ])
  const criterion = criteria.find((c) => c.key === criterionKey)
  if (!criterion) return textResponse("")

  const analysisEvidence = extractAnalysisEvidence(analysis, criterionKey)
  const ragSnippets = ragResults.map((r, i) => `[${i + 1}] ${r.text.slice(0, 500)}`).join("\n\n")

  const prompt = `You are drafting a paragraph for an EB-1A petition that cites evidence for the following regulatory criterion:

CRITERION: ${criterion.key} — ${criterion.name}
${criterion.description}

EVIDENCE FROM CASE RECORD:
${analysisEvidence || "(none on file)"}

RELEVANT MATERIAL FROM CASE DOCUMENTS (RAG):
${ragSnippets || "(no RAG results)"}

TASK: Write a single paragraph (3-6 sentences) that cites specific, concrete evidence supporting this criterion. Reference exhibits inline using the format "(see Exhibit: <short description>)". Do not invent evidence that is not in the context above. Do not include any preamble, explanation, or headings — output only the paragraph. End with a blank line.`

  return streamMarkdown(prompt)
}

async function streamArgue(
  caseId: string,
  criterionKey?: string,
  category?: string | null,
): Promise<Response> {
  if (!criterionKey) return textResponse("")
  const [criteria, profile, analysis, ragResults] = await Promise.all([
    getCriteriaForCase(caseId),
    db.caseProfile.findUnique({ where: { caseId } }),
    db.caseAnalysis.findFirst({ where: { caseId }, orderBy: { createdAt: "desc" } }),
    queryContext(caseId, criterionKey, 6),
  ])
  const criterion = criteria.find((c) => c.key === criterionKey)
  if (!criterion) return textResponse("")

  const profileData = profile?.data ? JSON.stringify(profile.data, null, 2).slice(0, 2000) : "(none)"
  const analysisEvidence = extractAnalysisEvidence(analysis, criterionKey)
  const ragSnippets = ragResults.map((r, i) => `[${i + 1}] ${r.text.slice(0, 500)}`).join("\n\n")

  const categoryHint = category
    ? `This section will be inserted into a ${category.replace(/_/g, " ").toLowerCase()}.`
    : ""

  const prompt = `You are drafting a legal section for an EB-1A petition arguing that the applicant satisfies a specific regulatory criterion.

CRITERION: ${criterion.key} — ${criterion.name}
${criterion.description}

APPLICANT PROFILE:
${profileData}

EVIDENCE ON RECORD:
${analysisEvidence || "(none on file)"}

RELEVANT EXCERPTS FROM CASE MATERIALS (RAG):
${ragSnippets || "(no RAG results)"}

${categoryHint}

TASK: Write a formal legal argument section (2-4 paragraphs) asserting that the applicant satisfies ${criterion.key}. Begin with a "### ${criterion.name}" heading. Use a persuasive, petitioner-voice tone suitable for USCIS. Cite specific evidence inline (do not fabricate). Do not include meta-commentary, explanation, or bullet lists. Output only the markdown section. End with a blank line.`

  return streamMarkdown(prompt)
}

async function streamAddressWeakness(caseId: string, argValue?: string): Promise<Response> {
  if (!argValue) return textResponse("")
  const [gap, denial, profile] = await Promise.all([
    db.gapAnalysis.findFirst({ where: { caseId }, orderBy: { createdAt: "desc" } }),
    db.denialProbability.findFirst({ where: { caseId }, orderBy: { createdAt: "desc" } }),
    db.caseProfile.findUnique({ where: { caseId } }),
  ])

  let weaknessDesc = ""
  let weaknessContext = ""

  if (argValue.startsWith("gap:")) {
    const idx = parseInt(argValue.slice(4), 10)
    const gaps = ((gap?.data as { gap_analysis?: { critical_gaps?: Array<Record<string, unknown>> } })?.gap_analysis?.critical_gaps) ?? []
    const g = gaps[idx]
    if (g) {
      weaknessDesc = String(g.issue ?? "")
      weaknessContext = `Priority: ${String(g.priority ?? "MEDIUM")}\nCriterion: ${String(g.criterion ?? "unspecified")}\nCurrent state: ${String(g.current_state ?? "")}\nRequired state: ${String(g.required_state ?? "")}\nImpact: ${String(g.impact ?? "")}`
    }
  } else if (argValue.startsWith("redflag:")) {
    const idx = parseInt(argValue.slice(8), 10)
    const flags = ((denial?.data as { red_flags?: Array<Record<string, unknown>> })?.red_flags) ?? []
    const f = flags[idx]
    if (f) {
      weaknessDesc = String(f.description ?? "")
      weaknessContext = `Flag level: ${String(f.level ?? "MEDIUM")}`
    }
  }

  if (!weaknessDesc) return textResponse("")

  const profileData = profile?.data ? JSON.stringify(profile.data, null, 2).slice(0, 1500) : "(none)"

  const prompt = `You are drafting a preemptive section for an EB-1A petition that acknowledges and refutes a specific weakness or risk in the record.

WEAKNESS TO ADDRESS:
${weaknessDesc}

CONTEXT:
${weaknessContext}

APPLICANT PROFILE:
${profileData}

TASK: Write a single paragraph (4-6 sentences) that briefly acknowledges the apparent weakness, then pivots to explain why the record nonetheless satisfies the regulatory standard. Use concrete evidence from the profile where possible. Do not admit fault. Do not fabricate facts. Do not include a heading, preamble, or bullet list — output only the paragraph. End with a blank line.`

  return streamMarkdown(prompt)
}

function streamMarkdown(prompt: string): Response {
  const result = streamText({
    model: anthropic(MODEL),
    prompt,
  })
  return result.toTextStreamResponse()
}

// ---------- helpers ----------

function extractAnalysisEvidence(
  analysis: { criteria: unknown } | null,
  criterionKey: string,
): string {
  if (!analysis) return ""
  const criteria = analysis.criteria as Array<{
    criterionId?: string
    strength?: string
    evidence?: string[]
    reason?: string
  }>
  const match = criteria.find((c) => c.criterionId === criterionKey)
  if (!match) return ""
  const ev = (match.evidence ?? []).map((e) => `- ${e}`).join("\n")
  return `Strength: ${match.strength ?? "unknown"}\nReason: ${match.reason ?? ""}\nListed evidence:\n${ev}`
}
