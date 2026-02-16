import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { getShareAccess } from '@/lib/share-access'
import { runDraftingAgent } from '@/lib/drafting-agent'

type Params = { params: Promise<{ shareId: string }> }

export async function POST(request: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { shareId } = await params
  const share = await getShareAccess(shareId, session.user.id, ['FULL'])
  if (!share) {
    return new Response('Forbidden', { status: 403 })
  }

  const body = await request.json()
  const { messages = [], templateInputs } = body
  const caseId = share.caseId
  const docId = share.documentId

  // Save user message
  const lastUserMsg = messages.findLast(
    (m: { role: string }) => m.role === 'user'
  )
  if (lastUserMsg) {
    await db.chatMessage.create({
      data: {
        caseId,
        role: 'USER',
        content: lastUserMsg.content,
        phase: 'DRAFTING',
        documentId: docId,
      },
    })
  }

  // Load chat history
  const dbMessages = await db.chatMessage.findMany({
    where: { caseId, phase: 'DRAFTING', documentId: docId },
    orderBy: { createdAt: 'asc' },
    take: 50,
  })

  const historyMessages = dbMessages.map((m) => ({
    role: m.role.toLowerCase() as 'user' | 'assistant',
    content: m.content,
  }))

  const agentMessages = historyMessages.length > 0 ? historyMessages : messages

  const result = await runDraftingAgent({
    caseId,
    messages: agentMessages,
    documentId: docId,
    documentName: share.document.name,
    existingContent: share.document.content,
    category: share.document.category ?? undefined,
    recommenderId: share.document.recommenderId ?? undefined,
    templateInputs,
    onFinish: async (text) => {
      if (text) {
        await db.chatMessage.create({
          data: {
            caseId,
            role: 'ASSISTANT',
            content: text,
            phase: 'DRAFTING',
            documentId: docId,
          },
        })
        await db.document.update({
          where: { id: docId },
          data: { content: text },
        })
      }
    },
  })

  const streamResponse = result.toTextStreamResponse()
  return new Response(streamResponse.body, {
    status: streamResponse.status,
    headers: Object.fromEntries(streamResponse.headers.entries()),
  })
}

// GET - chat history
export async function GET(request: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { shareId } = await params
  const share = await getShareAccess(shareId, session.user.id)
  if (!share) {
    return new Response('Forbidden', { status: 403 })
  }

  const messages = await db.chatMessage.findMany({
    where: { caseId: share.caseId, phase: 'DRAFTING', documentId: share.documentId },
    orderBy: { createdAt: 'asc' },
    take: 50,
  })

  return Response.json({
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role.toLowerCase(),
      content: m.content,
      createdAt: m.createdAt,
    })),
  })
}
