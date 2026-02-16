import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { generateText } from "ai"
import { google } from "@ai-sdk/google"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { caseId } = await params

  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
    select: { userId: true, name: true },
  })
  if (!caseRecord || caseRecord.userId !== session.user.id) {
    return new Response("Not found", { status: 404 })
  }

  let body: { strengthEvaluation: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const se = body.strengthEvaluation
  if (!se) {
    return NextResponse.json({ error: "strengthEvaluation required" }, { status: 400 })
  }

  try {
    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      system: `You are an EB-1A immigration attorney summarizing a Kazarian two-step analysis for an applicant. Do not use emojis.

Write a concise executive summary (3-5 sentences) that synthesizes:
- Step 1 result: how many criteria are satisfied, which ones, and whether the threshold is met
- Step 2 result: the final merits determination, sustained acclaim, geographic reach, independence
- Overall petition strength, approval probability, and top-level recommendation

The tone should be direct and actionable -- like an attorney briefing a client. Use plain language, not legal jargon. State the bottom line first, then supporting details.

Output ONLY the summary paragraph. No headings, no bullet points, no preamble.`,
      prompt: JSON.stringify({
        applicant: (se as Record<string, unknown>).applicant_name,
        field: (se as Record<string, unknown>).detected_field,
        step1: (se as Record<string, unknown>).step1_assessment,
        step2: (se as Record<string, unknown>).step2_assessment,
        overall: (se as Record<string, unknown>).overall_assessment,
        red_flags_count: ((se as Record<string, unknown>).red_flags as Record<string, unknown>)?.total_red_flags,
      }),
    })

    return NextResponse.json({ summary: text.trim() })
  } catch (err) {
    console.error("Kazarian summary failed:", err)
    return NextResponse.json({ error: "Failed to generate summary" }, { status: 500 })
  }
}
