import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { CasePageClient } from './client'
import type { DetailedExtraction } from '@/lib/eb1a-extraction-schema'

interface Props {
  params: Promise<{ caseId: string }>
}

type ChatMsg = { id: string; role: string; content: string; metadata: unknown }

export default async function CasePage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }

  const { caseId } = await params

  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      userId: true,
      intakeStatus: true,
      skippedSections: true,
      criteriaThreshold: true,
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

  const initialEvidenceMessages = evidenceMessages.map((m: ChatMsg) => ({
    id: m.id,
    role: m.role.toLowerCase() as 'user' | 'assistant',
    content: m.content,
    metadata: m.metadata as Record<string, unknown> | null,
  }))

  // Fetch document-phase messages
  const documentMessages = await db.chatMessage.findMany({
    where: { caseId, phase: 'DOCUMENTS' },
    orderBy: { createdAt: 'asc' },
    take: 50,
  })

  const initialDocumentMessages = documentMessages.map((m: ChatMsg) => ({
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

  const [latestStrengthEval, latestGapAnalysis, latestCaseStrategy] = await Promise.all([
    db.strengthEvaluation.findFirst({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
      select: { data: true },
    }),
    db.gapAnalysis.findFirst({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
      select: { data: true },
    }),
    db.caseStrategy.findFirst({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
      select: { data: true },
    }),
  ])

  const latestAnalysis = caseRecord.eb1aAnalyses[0] ?? null

  const initialMessages = caseRecord.chatMessages.map((m: ChatMsg) => ({
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
        extraction: latestAnalysis.extraction as DetailedExtraction | null,
      }
    : null

  const profileData = (caseRecord.profile?.data ?? {}) as Record<string, unknown>

  return (
    <CasePageClient
      caseId={caseId}
      initialMessages={initialMessages}
      initialAnalysis={analysisData}
      hasExistingMessages={caseRecord.chatMessages.length > 0}
      initialAnalysisVersion={latestAnalysis?.version ?? 0}
      initialThreshold={criteriaThreshold}
      initialEvidenceMessages={initialEvidenceMessages}
      initialDocumentMessages={initialDocumentMessages}
      initialIntakeStatus={caseRecord.intakeStatus}
      initialProfileData={profileData}
      initialStrengthEvaluation={latestStrengthEval?.data as import('@/lib/strength-evaluation-schema').StrengthEvaluation | null ?? null}
      initialGapAnalysis={latestGapAnalysis?.data as import('@/lib/gap-analysis-schema').GapAnalysis | null ?? null}
      initialCaseStrategy={latestCaseStrategy?.data as import('@/lib/case-strategy-schema').CaseStrategy | null ?? null}
    />
  )
}
