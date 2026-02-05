import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseFile, parseDocx, parseTxt } from "@/lib/file-parser";
import { chunkText } from "@/lib/chunker";
import { upsertChunks } from "@/lib/pinecone";
import { runIncrementalAnalysis } from "@/lib/incremental-analysis";
import { generateText, Output } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

const MODEL = "gemini-2.5-flash";

const PdfTextSchema = z.object({
  extractedText: z.string().describe("Full text extracted from the PDF"),
});

async function extractPdfText(pdfBuffer: ArrayBuffer): Promise<string> {
  const { output } = await generateText({
    model: google(MODEL),
    output: Output.object({ schema: PdfTextSchema }),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Extract all text from this PDF document." },
          {
            type: "file",
            data: Buffer.from(pdfBuffer),
            mediaType: "application/pdf",
          },
        ],
      },
    ],
  });
  return output?.extractedText ?? "";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { caseId } = await params;

  // Verify user owns this case
  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
  });

  if (!caseRecord || caseRecord.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const ext = file.name.toLowerCase().split(".").pop();

    let text: string;

    if (ext === "pdf") {
      text = await extractPdfText(buffer);
    } else if (ext === "docx") {
      text = await parseDocx(buffer);
    } else if (ext === "txt") {
      text = await parseTxt(buffer);
    } else {
      return NextResponse.json(
        { error: "Unsupported file type" },
        { status: 400 },
      );
    }

    if (!text || text.length < 50) {
      return NextResponse.json(
        { error: "Could not extract text from file" },
        { status: 400 },
      );
    }

    // Chunk and upsert to Pinecone
    const chunks = chunkText(text);
    const { vectorIds } = await upsertChunks(chunks, caseId);

    // Create upload record
    await db.resumeUpload.create({
      data: {
        caseId,
        fileName: file.name,
        fileSize: file.size,
        pineconeVectorIds: vectorIds,
      },
    });

    // Run incremental analysis in background
    runIncrementalAnalysis(caseId, text).catch((err) => {
      console.error("Incremental analysis failed:", err);
    });

    return NextResponse.json({
      success: true,
      chunksCreated: chunks.length,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 },
    );
  }
}
