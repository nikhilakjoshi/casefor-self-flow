import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { parseDocx, parseTxt, parseMarkdown } from "@/lib/file-parser";
import {
  extractRecommenderFromText,
  extractRecommenderFromPdf,
  enrichRecommender,
  type ExtractedRecommender,
} from "@/lib/recommender-extractor";

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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

  const contentType = request.headers.get("content-type") ?? "";

  let extracted: ExtractedRecommender;
  let rawText: string | null = null;

  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400 }
        );
      }

      const ext = file.name.toLowerCase().split(".").pop();
      const buffer = await file.arrayBuffer();

      if (ext === "pdf") {
        extracted = await extractRecommenderFromPdf(buffer);
      } else if (ext === "docx") {
        rawText = await parseDocx(buffer);
        extracted = await extractRecommenderFromText(rawText);
      } else if (ext === "txt") {
        rawText = await parseTxt(buffer);
        extracted = await extractRecommenderFromText(rawText);
      } else if (ext === "md" || ext === "markdown") {
        rawText = await parseMarkdown(buffer);
        extracted = await extractRecommenderFromText(rawText);
      } else {
        return NextResponse.json(
          { error: "Unsupported file type. Use PDF, DOCX, TXT, or MD." },
          { status: 400 }
        );
      }
    } else if (contentType.includes("application/json")) {
      const body = await request.json();
      const url = body?.url;

      if (!url || typeof url !== "string") {
        return NextResponse.json(
          { error: "URL is required" },
          { status: 400 }
        );
      }

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        return NextResponse.json(
          { error: "Invalid URL" },
          { status: 400 }
        );
      }

      const res = await fetch(parsedUrl.toString(), {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; CaseForAI/1.0; +https://casefor.ai)",
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        return NextResponse.json(
          { error: `Failed to fetch URL: ${res.status}` },
          { status: 422 }
        );
      }

      const html = await res.text();
      rawText = stripHtml(html).slice(0, 30_000);

      if (rawText.length < 50) {
        return NextResponse.json(
          { error: "Page content too short or empty" },
          { status: 422 }
        );
      }

      extracted = await extractRecommenderFromText(rawText);
    } else {
      return NextResponse.json(
        { error: "Content-Type must be multipart/form-data or application/json" },
        { status: 400 }
      );
    }

    // Enrich gaps via search grounding (non-fatal)
    try {
      extracted = await enrichRecommender(extracted);
    } catch {
      // enrichment is best-effort
    }

    return NextResponse.json({
      extracted,
      contextNotes: {
        rawText: rawText?.slice(0, 5_000) ?? null,
        extractedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("Recommender extraction failed:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Extraction failed",
      },
      { status: 500 }
    );
  }
}
