'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { cn } from '@/lib/utils'
import { ChatPanel } from './_components/chat-panel'
import { ReportPanel } from './_components/report-panel'
import { Upload } from 'lucide-react'

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
  } | null
  hasExistingMessages: boolean
  initialAnalysisVersion: number
  initialThreshold?: number
}

export function CasePageClient({
  caseId,
  initialMessages,
  initialAnalysis,
  hasExistingMessages,
  initialAnalysisVersion,
  initialThreshold = 3,
}: CasePageClientProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [isLoading, setIsLoading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [analysisVersion, setAnalysisVersion] = useState(initialAnalysisVersion)
  const [threshold, setThreshold] = useState(initialThreshold)
  const initiatedRef = useRef(false)

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
      setIsDragOver(false)
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

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    onDragEnter: () => setIsDragOver(true),
    onDragLeave: () => setIsDragOver(false),
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
        '.docx',
      ],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
    noClick: true,
    noKeyboard: true,
  })

  return (
    <div
      {...getRootProps()}
      className="flex flex-1 overflow-hidden relative"
    >
      <input {...getInputProps()} />

      {/* Full-page drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-foreground/60 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-background">
            <div className="w-16 h-16 rounded-2xl bg-background/20 flex items-center justify-center">
              <Upload className="w-8 h-8" />
            </div>
            <p className="text-lg font-medium">Drop file to upload</p>
            <p className="text-sm text-white/70">PDF, DOC, DOCX, or TXT</p>
          </div>
        </div>
      )}

      {/* Chat Panel - 60% */}
      <div className="w-[60%] flex flex-col overflow-hidden border-r border-stone-200 dark:border-stone-700">
        <ChatPanel
          messages={messages}
          isLoading={isLoading}
          onSend={sendMessage}
          onFileSelect={onFileSelect}
        />
      </div>

      {/* Report Panel - 40% */}
      <div className="w-[40%] bg-muted/50">
        <ReportPanel
          caseId={caseId}
          initialAnalysis={initialAnalysis}
          version={analysisVersion}
          threshold={threshold}
          onThresholdChange={setThreshold}
        />
      </div>
    </div>
  )
}
