import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { runDraftingAgent } from "@/lib/drafting-agent"

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
  })

  if (!caseRecord || caseRecord.userId !== session.user.id) {
    return new Response("Not found", { status: 404 })
  }

  // Create a new document for the generated resume
  const doc = await db.document.create({
    data: {
      caseId,
      name: "Generated Resume",
      type: "MARKDOWN",
      source: "SYSTEM_GENERATED",
      content: "",
      status: "DRAFT",
      category: "RESUME_CV",
    },
  })

  const result = await runDraftingAgent({
    caseId,
    messages: [
      {
        role: "user",
        content:
          "Generate a comprehensive resume/CV for this EB-1A applicant. Use the applicant profile, analysis, and any uploaded documents to create a polished, professional resume that highlights extraordinary ability achievements, publications, awards, memberships, and other relevant qualifications. Format as a clean, well-structured markdown resume.",
      },
    ],
    documentId: doc.id,
    documentName: doc.name,
    category: "RESUME_CV",
    onFinish: async (text) => {
      if (text) {
        await db.document.update({
          where: { id: doc.id },
          data: { content: text },
        })
      }
    },
  })

  const streamResponse = result.toTextStreamResponse()
  return new Response(streamResponse.body, {
    status: streamResponse.status,
    headers: {
      ...Object.fromEntries(streamResponse.headers.entries()),
      "X-Document-Id": doc.id,
    },
  })
}
