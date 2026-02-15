import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { runDraftingAgent } from "@/lib/drafting-agent";

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

  const body = await request.json();
  const {
    messages = [],
    documentId,
    documentName,
    category,
    recommenderId,
    templateInputs,
  } = body;

  let docId = documentId as string | undefined;
  let docName = documentName as string | undefined;
  let existingContent: string | null = null;

  // If no documentId, create a new document
  if (!docId) {
    const doc = await db.document.create({
      data: {
        caseId,
        name: docName || "Untitled Document",
        type: "MARKDOWN",
        source: "SYSTEM_GENERATED",
        content: "",
        status: "DRAFT",
        category: category || null,
        recommenderId: recommenderId || null,
      },
    });
    docId = doc.id;
    docName = doc.name;
  } else {
    // Load existing document
    const doc = await db.document.findFirst({
      where: { id: docId, caseId },
    });
    if (doc) {
      existingContent = doc.content;
      docName = docName || doc.name;
    }
  }

  // Save user message
  const lastUserMsg = messages.findLast(
    (m: { role: string }) => m.role === "user",
  );
  if (lastUserMsg) {
    await db.chatMessage.create({
      data: {
        caseId,
        role: "USER",
        content: lastUserMsg.content,
        phase: "DRAFTING",
        documentId: docId,
      },
    });
  }

  // Load drafting chat history for this document
  const dbMessages = await db.chatMessage.findMany({
    where: { caseId, phase: "DRAFTING", documentId: docId },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  const historyMessages = dbMessages.map(
    (m: { role: string; content: string }) => ({
      role: m.role.toLowerCase() as "user" | "assistant",
      content: m.content,
    }),
  );

  const agentMessages =
    historyMessages.length > 0 ? historyMessages : messages;

  const result = await runDraftingAgent({
    caseId,
    messages: agentMessages,
    documentId: docId,
    documentName: docName,
    existingContent,
    category: category as string | undefined,
    recommenderId: recommenderId as string | undefined,
    templateInputs: templateInputs as Record<string, string> | undefined,
    onFinish: async (text) => {
      if (text) {
        // Save assistant message
        await db.chatMessage.create({
          data: {
            caseId,
            role: "ASSISTANT",
            content: text,
            phase: "DRAFTING",
            documentId: docId,
          },
        });

        // Save generated content to document
        if (docId) {
          await db.document.update({
            where: { id: docId },
            data: { content: text },
          });
        }
      }
    },
  });

  const headers = new Headers();
  if (docId) {
    headers.set("X-Document-Id", docId);
  }

  const streamResponse = result.toTextStreamResponse();
  // Copy stream body into new response with custom headers
  return new Response(streamResponse.body, {
    status: streamResponse.status,
    headers: {
      ...Object.fromEntries(streamResponse.headers.entries()),
      "X-Document-Id": docId || "",
    },
  });
}

export async function GET(
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

  const url = new URL(request.url);
  const documentId = url.searchParams.get("documentId");

  if (!documentId) {
    return Response.json({ messages: [] });
  }

  const messages = await db.chatMessage.findMany({
    where: { caseId, phase: "DRAFTING", documentId },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  return Response.json({
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role.toLowerCase(),
      content: m.content,
      createdAt: m.createdAt,
    })),
  });
}
