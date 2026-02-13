import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { runDocumentAgent } from "@/lib/document-agent";
import { chunkText } from "@/lib/chunker";
import { upsertChunks } from "@/lib/pinecone";
import { parseDocx, parseTxt } from "@/lib/file-parser";
import { verifyDocuments } from "@/lib/document-verifier";
import { classifyDocument } from "@/lib/document-classifier";
import { isS3Configured, uploadToS3, buildDocumentKey } from "@/lib/s3";
import { generateText, Output } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

const GEMINI_MODEL = "gemini-2.5-flash";

const PdfTextSchema = z.object({
  extractedText: z.string().describe("Full text extracted from the PDF"),
});

async function extractPdfText(pdfBuffer: ArrayBuffer): Promise<string> {
  const { output } = await generateText({
    model: google(GEMINI_MODEL),
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

async function processUploadedFile(
  file: File,
  caseId: string,
): Promise<string> {
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
    throw new Error("Unsupported file type");
  }

  if (!text || text.length < 20) {
    throw new Error("Could not extract text from file");
  }

  // Chunk + embed
  const chunks = chunkText(text);
  const { vectorIds } = await upsertChunks(chunks, caseId);

  const docType = ext === "pdf" ? "PDF" : ext === "docx" ? "DOCX" : "MARKDOWN" as const;

  const [, doc] = await Promise.all([
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
        content: text,
      },
    }),
  ]);

  // Upload to S3 if configured
  if (isS3Configured()) {
    const key = buildDocumentKey(caseId, doc.id, file.name);
    const s3Buffer = Buffer.from(buffer);
    const { url } = await uploadToS3(key, s3Buffer, file.type);
    await db.document.update({
      where: { id: doc.id },
      data: { s3Key: key, s3Url: url },
    });
  }

  classifyDocument(doc.id, file.name, text).catch(() => {});

  // Run verification in background
  verifyDocuments(caseId).catch((err) =>
    console.error(`[document-chat] Background verification failed:`, err)
  );

  return text;
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

  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
  });

  if (!caseRecord || caseRecord.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  const contentType = request.headers.get("content-type") || "";

  let messages: Array<{ role: "user" | "assistant"; content: string }> = [];
  let fileText: string | null = null;
  let fileName: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const messagesJson = formData.get("messages") as string | null;

    if (messagesJson) {
      messages = JSON.parse(messagesJson);
    }

    if (file) {
      fileText = await processUploadedFile(file, caseId);
      fileName = file.name;

      const uploadMsg = `[Uploaded file: ${fileName}]\n\nExtracted content:\n${fileText.slice(0, 3000)}`;
      messages.push({ role: "user", content: uploadMsg });

      await db.chatMessage.create({
        data: {
          caseId,
          role: "USER",
          content: `[Uploaded file: ${fileName}]`,
          metadata: { type: "file_upload", fileName },
          phase: "DOCUMENTS",
        },
      });
    }
  } else {
    const body = await request.json();
    messages = body.messages || [];

    const lastUserMsg = messages.findLast((m: { role: string }) => m.role === "user");
    if (lastUserMsg) {
      await db.chatMessage.create({
        data: {
          caseId,
          role: "USER",
          content: lastUserMsg.content,
          phase: "DOCUMENTS",
        },
      });
    }
  }

  // Load full document-phase message history from DB
  const dbMessages = await db.chatMessage.findMany({
    where: { caseId, phase: "DOCUMENTS" },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  const historyMessages = dbMessages.map((m: { role: string; content: string }) => ({
    role: m.role.toLowerCase() as "user" | "assistant",
    content: m.content,
  }));

  const agentMessages = historyMessages.length > 0 ? historyMessages : messages;

  const result = await runDocumentAgent({
    caseId,
    messages: agentMessages,
    onFinish: async (text) => {
      if (text) {
        await db.chatMessage.create({
          data: {
            caseId,
            role: "ASSISTANT",
            content: text,
            phase: "DOCUMENTS",
          },
        });
      }
    },
  });

  return result.toTextStreamResponse();
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> },
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

  await db.chatMessage.deleteMany({
    where: {
      caseId,
      phase: "DOCUMENTS",
    },
  });

  return new Response(null, { status: 204 });
}
