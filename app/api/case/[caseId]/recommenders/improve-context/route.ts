import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

const RequestSchema = z.object({
  draft: z.string().min(1),
  recommenderName: z.string().optional(),
  recommenderTitle: z.string().optional(),
  relationshipType: z.string().optional(),
  organization: z.string().optional(),
  bio: z.string().optional(),
  credentials: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { caseId } = await params;

  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
  });

  if (!caseRecord || caseRecord.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = RequestSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { draft, recommenderName, recommenderTitle, relationshipType, organization, bio, credentials } = result.data;

  const context = [
    recommenderName && `Name: ${recommenderName}`,
    recommenderTitle && `Title: ${recommenderTitle}`,
    relationshipType && `Relationship: ${relationshipType}`,
    organization && `Organization: ${organization}`,
    bio && `Bio: ${bio}`,
    credentials && `Credentials: ${credentials}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      system: `You improve relationship context descriptions for EB-1A immigration recommendation letters. Do not use emojis.

Given a rough draft and recommender details, rewrite the relationship context to be:
- Professional and specific
- Clear about how the applicant knows the recommender
- Highlighting why this person is qualified to speak to the applicant's abilities
- Concise (2-4 sentences)

Output ONLY the improved text. No preamble, no explanation.`,
      prompt: `Recommender details:\n${context || "No additional details provided."}\n\nDraft relationship context:\n${draft}`,
    });

    return NextResponse.json({ improved: text.trim() });
  } catch (err) {
    console.error("Context improvement failed:", err);
    return NextResponse.json(
      { error: "Failed to improve context" },
      { status: 500 }
    );
  }
}
