import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { getShareAccess } from '@/lib/share-access'
import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { getPrompt, resolveModel } from '@/lib/agent-prompt'

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
  const { selectedText, instruction, fullDocument, documentName } = body

  if (!selectedText || !instruction) {
    return new Response('Missing selectedText or instruction', { status: 400 })
  }

  const caseId = share.caseId

  const [profile, analysis, denialProb] = await Promise.all([
    db.caseProfile.findUnique({ where: { caseId } }),
    db.eB1AAnalysis.findFirst({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
    }),
    db.denialProbability.findFirst({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const profileSection = profile?.data
    ? JSON.stringify(profile.data, null, 2)
    : 'No profile data available.'

  const analysisSection = analysis?.criteria
    ? (analysis.criteria as Array<{ criterionId: string; strength: string; reason: string }>)
        .map((c) => `${c.criterionId}: ${c.strength} - ${c.reason}`)
        .join('\n')
    : 'No analysis available.'

  const denialSection = denialProb?.data
    ? JSON.stringify(denialProb.data, null, 2)
    : ''

  const systemPrompt = `You are an expert editor for EB-1A extraordinary ability immigration petition documents.

TASK: Rewrite ONLY the selected text according to the user's instruction. Output ONLY the replacement text.

RULES:
- Output ONLY the rewritten text. Nothing else.
- No explanations, no meta-commentary, no conversational text, no markdown code fences.
- The rewritten text must seamlessly integrate with the surrounding document.
- Maintain the same tone, style, and formatting conventions as the rest of the document.
- Use specific, real data from the applicant's profile. Never use placeholders like [NAME] or [FIELD].
- Do not use emojis.
- Match the approximate length of the selected text unless the instruction implies otherwise.

APPLICANT PROFILE:
${profileSection}

CRITERIA ANALYSIS:
${analysisSection}
${denialSection ? `\nDENIAL RISK ASSESSMENT:\n${denialSection}` : ''}
FULL DOCUMENT (for context -- do NOT regenerate the full document):
${fullDocument || 'No document content available.'}
${documentName ? `\nDOCUMENT NAME: ${documentName}` : ''}
SELECTED TEXT TO REWRITE:
---
${selectedText}
---

Rewrite the selected text above according to the user's instruction. Output ONLY the replacement text.`

  const p = await getPrompt('drafting-agent')
  const result = streamText({
    model: p
      ? resolveModel(p.provider, p.modelName)
      : anthropic('claude-sonnet-4-20250514'),
    system: systemPrompt,
    messages: [{ role: 'user', content: instruction }],
  })

  return result.toTextStreamResponse()
}
