import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { runEvidenceAgent } from "@/lib/evidence-agent";
import { chunkText } from "@/lib/chunker";
import { upsertChunks } from "@/lib/pinecone";
import { parseDocx, parseTxt } from "@/lib/file-parser";
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

  await db.resumeUpload.create({
    data: {
      caseId,
      fileName: file.name,
      fileSize: file.size,
      pineconeVectorIds: vectorIds,
    },
  });

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
    // File upload path
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

      // Save user message with EVIDENCE phase
      await db.chatMessage.create({
        data: {
          caseId,
          role: "USER",
          content: `[Uploaded file: ${fileName}]`,
          metadata: { type: "file_upload", fileName },
          phase: "EVIDENCE",
        },
      });
    }
  } else {
    // JSON path
    const body = await request.json();
    messages = body.messages || [];

    // Save user message with EVIDENCE phase
    const lastUserMsg = messages.findLast((m: { role: string }) => m.role === "user");
    if (lastUserMsg) {
      await db.chatMessage.create({
        data: {
          caseId,
          role: "USER",
          content: lastUserMsg.content,
          phase: "EVIDENCE",
        },
      });
    }
  }

  // Load full evidence-phase message history from DB
  const dbMessages = await db.chatMessage.findMany({
    where: { caseId, phase: "EVIDENCE" },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  // Use DB history as the authoritative message list
  const historyMessages = dbMessages.map((m) => ({
    role: m.role.toLowerCase() as "user" | "assistant",
    content: m.content,
  }));

  // If no history yet (first message just saved), use what we have
  const agentMessages = historyMessages.length > 0 ? historyMessages : messages;

  const result = await runEvidenceAgent({
    caseId,
    messages: agentMessages,
    onFinish: async (text) => {
      if (text) {
        await db.chatMessage.create({
          data: {
            caseId,
            role: "ASSISTANT",
            content: text,
            phase: "EVIDENCE",
          },
        });
      }
    },
  });

  return result.toTextStreamResponse();
}
