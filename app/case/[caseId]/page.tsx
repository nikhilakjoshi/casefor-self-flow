import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { CasePageClient } from './client'

interface Props {
  params: Promise<{ caseId: string }>
}

export default async function CasePage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }

  const { caseId } = await params

  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
    include: {
      profile: true,
      eb1aAnalyses: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      chatMessages: {
        where: { phase: 'ANALYSIS' },
        orderBy: { createdAt: 'asc' },
        take: 50,
      },
    },
  })

  if (!caseRecord || caseRecord.userId !== session.user.id) {
    redirect('/dashboard')
  }

  const criteriaThreshold = caseRecord.criteriaThreshold ?? 3

  // Fetch evidence-phase messages separately
  const evidenceMessages = await db.chatMessage.findMany({
    where: { caseId, phase: 'EVIDENCE' },
    orderBy: { createdAt: 'asc' },
    take: 50,
  })

  const initialEvidenceMessages = evidenceMessages.map((m) => ({
    id: m.id,
    role: m.role.toLowerCase() as 'user' | 'assistant',
    content: m.content,
    metadata: m.metadata as Record<string, unknown> | null,
  }))

  // Ensure profile exists
  if (!caseRecord.profile) {
    await db.caseProfile.create({
      data: { caseId, data: {} },
    })
  }

  const latestAnalysis = caseRecord.eb1aAnalyses[0] ?? null

  const initialMessages = caseRecord.chatMessages.map((m) => ({
    id: m.id,
    role: m.role.toLowerCase() as 'user' | 'assistant',
    content: m.content,
    metadata: m.metadata as Record<string, unknown> | null,
  }))

  const analysisData = latestAnalysis
    ? {
        criteria: latestAnalysis.criteria as Array<{
          criterionId: string
          strength: 'Strong' | 'Weak' | 'None'
          reason: string
          evidence: string[]
        }>,
        strongCount: latestAnalysis.strongCount,
        weakCount: latestAnalysis.weakCount,
      }
    : null

  return (
    <CasePageClient
      caseId={caseId}
      initialMessages={initialMessages}
      initialAnalysis={analysisData}
      hasExistingMessages={caseRecord.chatMessages.length > 0}
      initialAnalysisVersion={latestAnalysis?.version ?? 0}
      initialThreshold={criteriaThreshold}
      initialEvidenceMessages={initialEvidenceMessages}
    />
  )
}
