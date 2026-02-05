'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChatInput } from '@/components/ui/chat-input'
import { MessageItem } from './message-item'
import { Upload } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  metadata?: Record<string, unknown> | null
}

interface EvidenceChatPanelProps {
  caseId: string
  initialMessages: Message[]
}

export function EvidenceChatPanel({ caseId, initialMessages }: EvidenceChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [isLoading, setIsLoading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const showTypingIndicator =
    isLoading &&
    (messages.length === 0 ||
      messages[messages.length - 1]?.role === 'user')

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
        const res = await fetch(`/api/case/${caseId}/evidence-chat`, {
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
      } catch (err) {
        console.error('Evidence chat error:', err)
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

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setIsDragOver(false)
      if (acceptedFiles.length === 0 || isLoading) return

      const file = acceptedFiles[0]
      setIsLoading(true)

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

        const res = await fetch(`/api/case/${caseId}/evidence-chat`, {
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
      } catch (err) {
        console.error('Evidence upload error:', err)
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
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
    noClick: true,
    noKeyboard: true,
  })

  return (
    <div {...getRootProps()} className="flex flex-col h-full relative">
      <input {...getInputProps()} />

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

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          {messages.length === 0 && !isLoading ? (
            <div className="h-full flex items-center justify-center text-stone-400 dark:text-stone-500">
              <div className="text-center">
                <p className="text-lg font-medium">Evidence gathering</p>
                <p className="text-sm mt-1">
                  Chat with the evidence agent to draft documents
                </p>
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <MessageItem
                key={m.id}
                role={m.role}
                content={m.content}
                isFileUpload={m.metadata?.type === 'file_upload'}
              />
            ))
          )}
          {showTypingIndicator && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" />
                  <span
                    className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="shrink-0 border-t border-border p-4">
        <ChatInput
          onSend={sendMessage}
          onFileSelect={onFileSelect}
          isLoading={isLoading}
          placeholder="Ask the evidence agent to draft documents..."
        />
      </div>
    </div>
  )
}
