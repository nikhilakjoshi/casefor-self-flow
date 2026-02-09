'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { ChatPanel } from './_components/chat-panel'
import { ReportPanel } from './_components/report-panel'
import { PhaseTabs } from './_components/phase-tabs'
import { EvidenceChatPanel } from './_components/evidence-chat-panel'
import { DocumentChatPanel } from './_components/document-chat-panel'
import { DocumentsPanel } from './_components/documents-panel'
import { IntakeSheet } from './_components/intake-sheet'
import { Upload, MessageSquare, X } from 'lucide-react'
import type { IntakeData } from './_lib/intake-schema'
import type { DetailedExtraction } from '@/lib/eb1a-extraction-schema'
import type { StrengthEvaluation } from '@/lib/strength-evaluation-schema'
import type { GapAnalysis } from '@/lib/gap-analysis-schema'

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
}: CasePageClientProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [analysisVersion, setAnalysisVersion] = useState(initialAnalysisVersion)
  const [threshold, setThreshold] = useState(initialThreshold)
  const [activeTab, setActiveTab] = useState<'analysis' | 'evidence' | 'documents'>('analysis')
  const [strongCount, setStrongCount] = useState(initialAnalysis?.strongCount ?? 0)
  const [badgeDismissed, setBadgeDismissed] = useState(false)
  const [isEvidenceLoading, setIsEvidenceLoading] = useState(false)
  const [isDocumentLoading, setIsDocumentLoading] = useState(false)
  const [intakeOpen, setIntakeOpen] = useState(initialIntakeStatus === 'PENDING')
  const [chatOpen, setChatOpen] = useState(true)
  const initiatedRef = useRef(false)

  const showEvidenceBadge = activeTab === 'analysis' && strongCount >= threshold && !badgeDismissed

  const handleStartEvidence = useCallback(async () => {
    try {
      await fetch(`/api/case/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'EVIDENCE' }),
      })
    } catch (err) {
      console.error('Failed to update case status:', err)
    }
    setActiveTab('evidence')
    setBadgeDismissed(true)
  }, [caseId])

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
        <PhaseTabs activeTab={activeTab} onTabChange={setActiveTab} />
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

      {/* Tab content */}
      {activeTab === 'analysis' ? (
        <div className="flex flex-1 overflow-hidden relative">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            className="hidden"
            onChange={handleFileInputChange}
          />

          {/* Report Panel - fills remaining space */}
          <div className="flex-1 bg-muted/50 overflow-hidden">
            <ReportPanel
              caseId={caseId}
              initialAnalysis={initialAnalysis}
              version={analysisVersion}
              threshold={threshold}
              onThresholdChange={setThreshold}
              onStrongCountChange={setStrongCount}
              initialStrengthEvaluation={initialStrengthEvaluation}
              initialGapAnalysis={initialGapAnalysis}
            />
          </div>

          {/* Chat Panel - right side, closable */}
          {chatOpen ? (
            <div className="w-[400px] flex flex-col overflow-hidden border-l border-stone-200 dark:border-stone-700 relative">
              <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border bg-background">
                <span className="text-sm font-medium">Chat</span>
                <button
                  onClick={() => setChatOpen(false)}
                  className="p-1 rounded hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
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
            </div>
          ) : (
            <button
              onClick={() => setChatOpen(true)}
              className="absolute bottom-4 right-4 z-10 flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="text-sm font-medium">Chat</span>
            </button>
          )}
        </div>
      ) : activeTab === 'evidence' ? (
        <div className="flex flex-1 overflow-hidden relative">
          {/* Documents Panel - fills remaining space */}
          <div className="flex-1 bg-muted/50 overflow-hidden">
            <DocumentsPanel caseId={caseId} isChatActive={isEvidenceLoading} />
          </div>

          {/* Evidence Chat - right side, closable */}
          {chatOpen ? (
            <div className="w-[400px] flex flex-col overflow-hidden border-l border-stone-200 dark:border-stone-700">
              <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border bg-background">
                <span className="text-sm font-medium">Evidence Chat</span>
                <button
                  onClick={() => setChatOpen(false)}
                  className="p-1 rounded hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <EvidenceChatPanel
                caseId={caseId}
                initialMessages={initialEvidenceMessages}
                onLoadingChange={setIsEvidenceLoading}
              />
            </div>
          ) : (
            <button
              onClick={() => setChatOpen(true)}
              className="absolute bottom-4 right-4 z-10 flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="text-sm font-medium">Chat</span>
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden relative">
          {/* Documents Panel */}
          <div className="flex-1 bg-muted/50 overflow-hidden">
            <DocumentsPanel caseId={caseId} isChatActive={isDocumentLoading} hideChecklists />
          </div>

          {/* Document Chat - right side, closable */}
          {chatOpen ? (
            <div className="w-[400px] flex flex-col overflow-hidden border-l border-stone-200 dark:border-stone-700">
              <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border bg-background">
                <span className="text-sm font-medium">Document Review</span>
                <button
                  onClick={() => setChatOpen(false)}
                  className="p-1 rounded hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <DocumentChatPanel
                caseId={caseId}
                initialMessages={initialDocumentMessages}
                onLoadingChange={setIsDocumentLoading}
              />
            </div>
          ) : (
            <button
              onClick={() => setChatOpen(true)}
              className="absolute bottom-4 right-4 z-10 flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="text-sm font-medium">Chat</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
