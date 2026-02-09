import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseDocx, parseTxt, parseMarkdown, parseCsv, parseExcel } from "@/lib/file-parser";
import { chunkText } from "@/lib/chunker";
import { upsertChunks } from "@/lib/pinecone";
import { runIncrementalAnalysis } from "@/lib/incremental-analysis";
import { extractPdfText } from "@/lib/pdf-extractor";

const MAX_FILES = 10;

interface FileResult {
  fileName: string;
  success: boolean;
  chunksCreated?: number;
  analysisStatus?: "queued" | "completed" | "failed";
  error?: string;
}

interface BatchUploadResponse {
  results: FileResult[];
  totalSuccess: number;
  totalFailed: number;
}

async function processFile(
  file: File,
  caseId: string
): Promise<FileResult> {
  try {
    const buffer = await file.arrayBuffer();
    const ext = file.name.toLowerCase().split(".").pop();

    let text: string;

    if (ext === "pdf") {
      text = await extractPdfText(buffer);
    } else if (ext === "docx") {
      text = await parseDocx(buffer);
    } else if (ext === "txt") {
      text = await parseTxt(buffer);
    } else if (ext === "md" || ext === "markdown") {
      text = await parseMarkdown(buffer);
    } else if (ext === "csv") {
      text = await parseCsv(buffer);
    } else if (ext === "xlsx" || ext === "xls") {
      text = await parseExcel(buffer);
    } else {
      return {
        fileName: file.name,
        success: false,
        error: "Unsupported file type",
      };
    }

    if (!text || text.length < 50) {
      return {
        fileName: file.name,
        success: false,
        error: "Could not extract text from file",
      };
    }

    // Chunk and upsert to Pinecone
    const chunks = chunkText(text);
    const { vectorIds } = await upsertChunks(chunks, caseId);

    // Create upload + document records
    const docType = ext === "pdf" ? "PDF" : ext === "docx" ? "DOCX" : "MARKDOWN" as const;
    await Promise.all([
      db.resumeUpload.create({
        data: {
          caseId,
          fileName: file.name,
          fileSize: file.size,
          pineconeVectorIds: vectorIds,
        },
      }),
      db.document.create({
        data: {
          caseId,
          name: file.name,
          type: docType,
          source: "USER_UPLOADED",
          status: "DRAFT",
        },
      }),
    ]);

    // Run incremental analysis
    let analysisStatus: "queued" | "completed" | "failed" = "queued";
    try {
      await runIncrementalAnalysis(caseId, text);
      analysisStatus = "completed";
    } catch (err) {
      console.error(`Incremental analysis failed for ${file.name}:`, err);
      analysisStatus = "failed";
    }

    return {
      fileName: file.name,
      success: true,
      chunksCreated: chunks.length,
      analysisStatus,
    };
  } catch (err) {
    return {
      fileName: file.name,
      success: false,
      error: err instanceof Error ? err.message : "Processing failed",
    };
  }
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
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_FILES} files allowed` },
        { status: 400 },
      );
    }

    // Process all files in parallel with error isolation
    const settledResults = await Promise.allSettled(
      files.map((file) => processFile(file, caseId))
    );

    // Map settled results to FileResult format
    const results: FileResult[] = settledResults.map((result, index) => {
      if (result.status === "fulfilled") {
        return result.value;
      }
      return {
        fileName: files[index].name,
        success: false,
        error: result.reason instanceof Error ? result.reason.message : "Processing failed",
      };
    });

    const totalSuccess = results.filter((r) => r.success).length;
    const totalFailed = results.filter((r) => !r.success).length;

    const batchResponse: BatchUploadResponse = {
      results,
      totalSuccess,
      totalFailed,
    };

    // Determine HTTP status: 207 for partial, 200 for all success, 400 for all fail
    let status = 200;
    if (totalFailed > 0 && totalSuccess > 0) {
      status = 207; // Multi-Status
    } else if (totalFailed === results.length) {
      status = 400;
    }

    return NextResponse.json(batchResponse, { status });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 },
    );
  }
}
