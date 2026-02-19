'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { ChatPanel } from './_components/chat-panel'
import { ReportPanel } from './_components/report-panel'
import { PhaseTabs } from './_components/phase-tabs'
import { EvidenceChatPanel } from './_components/evidence-chat-panel'
import { DocumentChatPanel } from './_components/document-chat-panel'
import { DocumentsPanel } from './_components/documents-panel'
import { DraftingPanel } from './_components/drafting-panel'
import { IntakeSheet } from './_components/intake-sheet'
import { Upload, MessageSquare, X, ShieldAlert } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { IntakeData } from './_lib/intake-schema'
import type { DetailedExtraction } from '@/lib/eb1a-extraction-schema'
import type { StrengthEvaluation } from '@/lib/strength-evaluation-schema'
import type { GapAnalysis } from '@/lib/gap-analysis-schema'
import type { CaseStrategy } from '@/lib/case-strategy-schema'
import type { CaseConsolidation } from '@/lib/case-consolidation-schema'
import type { DenialProbability } from '@/lib/denial-probability-schema'
import type { SurveyIntent } from '@/app/onboard/_lib/survey-schema'

function getRiskBadgeStyle(level: string) {
  switch (level) {
    case 'LOW': return 'bg-emerald-600 text-white'
    case 'MEDIUM': return 'bg-amber-500 text-white'
    case 'HIGH': return 'bg-orange-500 text-white'
    case 'VERY_HIGH': return 'bg-red-600 text-white'
    default: return 'bg-muted text-muted-foreground'
  }
}

function getRiskLabel(level: string) {
  switch (level) {
    case 'LOW': return 'Low Risk'
    case 'MEDIUM': return 'Medium Risk'
    case 'HIGH': return 'High Risk'
    case 'VERY_HIGH': return 'Very High Risk'
    default: return level
  }
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  metadata?: Record<string, unknown> | null
}

interface CasePageClientProps {
  caseId: string
  initialMessages: Message[]
  initialAnalysis: {
    criteria: Array<{
      criterionId: string
      strength: 'Strong' | 'Weak' | 'None'
      reason: string
      evidence: string[]
    }>
    strongCount: number
    weakCount: number
    extraction?: DetailedExtraction | null
  } | null
  hasExistingMessages: boolean
  initialAnalysisVersion: number
  initialThreshold?: number
  initialEvidenceMessages?: Message[]
  initialDocumentMessages?: Message[]
  initialIntakeStatus?: 'PENDING' | 'PARTIAL' | 'COMPLETED' | 'SKIPPED'
  initialProfileData?: Record<string, unknown>
  initialStrengthEvaluation?: StrengthEvaluation | null
  initialGapAnalysis?: GapAnalysis | null
  initialCaseStrategy?: CaseStrategy | null
  initialCaseConsolidation?: CaseConsolidation | null
  initialDenialProbability?: DenialProbability | null
}

export function CasePageClient({
  caseId,
  initialMessages,
  initialAnalysis,
  hasExistingMessages,
  initialAnalysisVersion,
  initialThreshold = 3,
  initialEvidenceMessages = [],
  initialDocumentMessages = [],
  initialIntakeStatus = 'PENDING',
  initialProfileData = {},
  initialStrengthEvaluation,
  initialGapAnalysis,
  initialCaseStrategy,
  initialCaseConsolidation,
  initialDenialProbability,
}: CasePageClientProps) {
  const initialIntentData = (initialProfileData as Record<string, unknown>)?.intent as SurveyIntent | undefined
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const validTabs = useMemo(() => new Set(['analysis', 'evidence', 'documents'] as const), [])
  const tabParam = searchParams.get('tab')
  const initialTab = tabParam && validTabs.has(tabParam as 'analysis' | 'evidence' | 'documents')
    ? (tabParam as 'analysis' | 'evidence' | 'documents')
    : 'analysis'

  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [analysisVersion, setAnalysisVersion] = useState(initialAnalysisVersion)
  const [threshold, setThreshold] = useState(initialThreshold)
  const [activeTab, setActiveTab] = useState<'analysis' | 'evidence' | 'documents'>(initialTab)

  // Redirect old ?tab=package URLs to ?tab=analysis&subtab=package
  useEffect(() => {
    if (tabParam === 'package') {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', 'analysis')
      params.set('subtab', 'package')
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }
  }, [tabParam, searchParams, router, pathname])

  const handleTabChange = useCallback((tab: 'analysis' | 'evidence' | 'documents') => {
    setActiveTab(tab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    if (tab !== 'analysis') params.delete('subtab')
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [searchParams, router, pathname])
  const [strongCount, setStrongCount] = useState(initialAnalysis?.strongCount ?? 0)
  const [badgeDismissed, setBadgeDismissed] = useState(false)
  const [isEvidenceLoading, setIsEvidenceLoading] = useState(false)
  const [isDocumentLoading, setIsDocumentLoading] = useState(false)
  const [draftingDoc, setDraftingDoc] = useState<{
    id?: string
    name?: string
    content?: string
    recommenderId?: string
    category?: string
  } | null>(null)
  const [intakeOpen, setIntakeOpen] = useState(initialIntakeStatus === 'PENDING')
  const [chatOpen, setChatOpen] = useState(false)
  const initiatedRef = useRef(false)

  const [reAnalysisPhase, setReAnalysisPhase] = useState<'idle' | 'strength-eval' | 'gap-analysis' | 'done'>('idle')

  const triggerReAnalysis = useCallback(async () => {
    if (reAnalysisPhase !== 'idle') return
    try {
      setReAnalysisPhase('strength-eval')
      const seRes = await fetch(`/api/case/${caseId}/strength-evaluation`, { method: 'POST' })
      if (seRes.ok && seRes.body) {
        const reader = seRes.body.getReader()
        while (true) {
          const { done } = await reader.read()
          if (done) break
        }
      }

      setReAnalysisPhase('gap-analysis')
      const gaRes = await fetch(`/api/case/${caseId}/gap-analysis`, { method: 'POST' })
      if (gaRes.ok && gaRes.body) {
        const reader = gaRes.body.getReader()
        while (true) {
          const { done } = await reader.read()
          if (done) break
        }
      }

      setAnalysisVersion((v) => v + 1)
      setReAnalysisPhase('done')
      setTimeout(() => setReAnalysisPhase('idle'), 2000)
    } catch (err) {
      console.error('Re-analysis failed:', err)
      setReAnalysisPhase('idle')
    }
  }, [caseId, reAnalysisPhase])

  const onOpenDraft = useCallback((doc?: { id?: string; name?: string; content?: string; recommenderId?: string; category?: string }) => {
    setDraftingDoc(doc || {})
  }, [])

  const showEvidenceBadge = activeTab === 'analysis' && strongCount >= threshold && !badgeDismissed

  const handleStartEvidence = useCallback(() => {
    handleTabChange('analysis')
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', 'analysis')
    params.set('subtab', 'evidence')
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    setBadgeDismissed(true)
  }, [handleTabChange, searchParams, router, pathname])

  // AI-initiated conversation on first load
  useEffect(() => {
    if (initiatedRef.current) return
    if (hasExistingMessages) return
    initiatedRef.current = true

    async function initiate() {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/case/${caseId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'initiate', messages: [] }),
        })

        if (!res.ok) return

        const reader = res.body?.getReader()
        if (!reader) return

        const decoder = new TextDecoder()
        let content = ''
        const msgId = `init-${Date.now()}`

        setMessages((prev) => [
          ...prev,
          { id: msgId, role: 'assistant', content: '' },
        ])

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          content += decoder.decode(value, { stream: true })
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msgId ? { ...m, content } : m
            )
          )
        }

        setAnalysisVersion((v) => v + 1)
      } catch (err) {
        console.error('Initiate error:', err)
      } finally {
        setIsLoading(false)
      }
    }

    initiate()
  }, [caseId, hasExistingMessages])

  // Send text message
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return

      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text.trim(),
      }

      const allMessages = [...messages, userMsg]
      setMessages(allMessages)
      setIsLoading(true)

      try {
        const res = await fetch(`/api/case/${caseId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: allMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        })

        if (!res.ok) throw new Error('Chat failed')

        const reader = res.body?.getReader()
        if (!reader) throw new Error('No reader')

        const decoder = new TextDecoder()
        let content = ''
        const asstId = `asst-${Date.now()}`

        setMessages((prev) => [
          ...prev,
          { id: asstId, role: 'assistant', content: '' },
        ])

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          content += decoder.decode(value, { stream: true })
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstId ? { ...m, content } : m
            )
          )
        }

        // Refresh analysis after agent might have updated it
        setAnalysisVersion((v) => v + 1)
      } catch (err) {
        console.error('Chat error:', err)
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: 'Something went wrong. Please try again.',
          },
        ])
      } finally {
        setIsLoading(false)
      }
    },
    [caseId, isLoading, messages]
  )

  // Handle file drop
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0 || isLoading) return

      const file = acceptedFiles[0]
      setIsLoading(true)

      // Add a file upload message
      const uploadMsg: Message = {
        id: `upload-${Date.now()}`,
        role: 'user',
        content: `Uploaded: ${file.name}`,
        metadata: { type: 'file_upload', fileName: file.name },
      }
      setMessages((prev) => [...prev, uploadMsg])

      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append(
          'messages',
          JSON.stringify(
            messages.map((m) => ({ role: m.role, content: m.content }))
          )
        )

        const res = await fetch(`/api/case/${caseId}/chat`, {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) throw new Error('Upload failed')

        const reader = res.body?.getReader()
        if (!reader) throw new Error('No reader')

        const decoder = new TextDecoder()
        let content = ''
        const asstId = `asst-upload-${Date.now()}`

        setMessages((prev) => [
          ...prev,
          { id: asstId, role: 'assistant', content: '' },
        ])

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          content += decoder.decode(value, { stream: true })
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstId ? { ...m, content } : m
            )
          )
        }

        setAnalysisVersion((v) => v + 1)
      } catch (err) {
        console.error('Upload error:', err)
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: 'Failed to process the file. Please try again.',
          },
        ])
      } finally {
        setIsLoading(false)
      }
    },
    [caseId, isLoading, messages]
  )

  // Handle single file from attach button
  const onFileSelect = useCallback(
    (file: File) => {
      onDrop([file])
    },
    [onDrop]
  )

  // Clear chat history
  const clearHistory = useCallback(async () => {
    if (isLoading) return
    try {
      const res = await fetch(`/api/case/${caseId}/chat`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setMessages([])
        initiatedRef.current = false
      }
    } catch (err) {
      console.error('Clear history error:', err)
    }
  }, [caseId, isLoading])

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) onDrop([file])
      e.target.value = ''
    },
    [onDrop]
  )

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Intake Sheet */}
      <IntakeSheet
        open={intakeOpen}
        onOpenChange={setIntakeOpen}
        caseId={caseId}
        initialData={initialProfileData as IntakeData}
        onComplete={() => setIntakeOpen(false)}
      />

      {/* Phase tabs */}
      <div className="shrink-0 px-4 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PhaseTabs activeTab={activeTab} onTabChange={handleTabChange} />
          {initialDenialProbability?.overall_assessment && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-default ${getRiskBadgeStyle(initialDenialProbability.overall_assessment.risk_level)}`}>
                    <ShieldAlert className="w-3 h-3" />
                    {getRiskLabel(initialDenialProbability.overall_assessment.risk_level)}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Denial probability: {initialDenialProbability.overall_assessment.denial_probability_pct}%</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {activeTab === 'analysis' && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload
          </button>
        )}
      </div>

      {/* Drafting panel overlay */}
      {draftingDoc !== null ? (
        <DraftingPanel
          caseId={caseId}
          document={draftingDoc}
          onClose={() => setDraftingDoc(null)}
          onSave={() => setDraftingDoc(null)}
        />
      ) : /* Tab content */
      activeTab === 'analysis' ? (
        <div className="flex flex-1 overflow-hidden">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            className="hidden"
            onChange={handleFileInputChange}
          />
          <div className="flex-1 bg-muted/50 overflow-hidden">
            <ReportPanel
              caseId={caseId}
              initialAnalysis={initialAnalysis}
              version={analysisVersion}
              threshold={threshold}
              onThresholdChange={setThreshold}
              onStrongCountChange={setStrongCount}
              onDocumentsRouted={() => setAnalysisVersion((v) => v + 1)}
              initialStrengthEvaluation={initialStrengthEvaluation}
              initialGapAnalysis={initialGapAnalysis}
              initialCaseStrategy={initialCaseStrategy}
              initialCaseConsolidation={initialCaseConsolidation}
              initialDenialProbability={initialDenialProbability}
              initialIntentData={initialIntentData}
              onOpenDraft={onOpenDraft}
              onEvidenceChanged={triggerReAnalysis}
              reAnalysisPhase={reAnalysisPhase}
            />
          </div>
        </div>
      ) : activeTab === 'evidence' ? (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 bg-muted/50 overflow-hidden">
            <DocumentsPanel caseId={caseId} isChatActive={isEvidenceLoading} onOpenDraft={onOpenDraft} onDocumentsRouted={() => setAnalysisVersion((v) => v + 1)} onEvidenceChanged={triggerReAnalysis} />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 bg-muted/50 overflow-hidden">
            <DocumentsPanel caseId={caseId} isChatActive={isDocumentLoading} hideChecklists onOpenDraft={onOpenDraft} onDocumentsRouted={() => setAnalysisVersion((v) => v + 1)} onEvidenceChanged={triggerReAnalysis} />
          </div>
        </div>
      )}

      {/* Floating chat popup */}
      {chatOpen ? (
        <div className="fixed bottom-5 right-5 z-50 w-[420px] h-[70vh] max-h-[700px] rounded-xl border border-border bg-background shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex flex-col overflow-hidden animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200">
          <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-border">
            <span className="text-sm font-medium">
              {activeTab === 'analysis' ? 'Chat' : activeTab === 'evidence' ? 'Evidence Chat' : 'Document Review'}
            </span>
            <button
              onClick={() => setChatOpen(false)}
              className="p-1 rounded hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden flex flex-col">
            {activeTab === 'analysis' ? (
              <ChatPanel
                messages={messages}
                isLoading={isLoading}
                onSend={sendMessage}
                onFileSelect={onFileSelect}
                onClear={clearHistory}
                showEvidenceAction={showEvidenceBadge}
                onStartEvidence={handleStartEvidence}
                caseId={caseId}
              />
            ) : activeTab === 'evidence' ? (
              <EvidenceChatPanel
                caseId={caseId}
                initialMessages={initialEvidenceMessages}
                onLoadingChange={setIsEvidenceLoading}
              />
            ) : (
              <DocumentChatPanel
                caseId={caseId}
                initialMessages={initialDocumentMessages}
                onLoadingChange={setIsDocumentLoading}
              />
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-border bg-background shadow-lg hover:shadow-xl text-sm font-medium text-foreground transition-all hover:bg-muted/50"
        >
          <MessageSquare className="w-4 h-4" />
          {activeTab === 'analysis' ? 'Chat' : activeTab === 'evidence' ? 'Evidence Chat' : 'Document Review'}
        </button>
      )}
    </div>
  )
}
