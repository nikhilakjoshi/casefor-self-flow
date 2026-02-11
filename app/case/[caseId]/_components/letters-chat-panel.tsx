'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChatInput } from '@/components/ui/chat-input'
import { MessageItem } from './message-item'
import { Button } from '@/components/ui/button'
import { RotateCcw } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  metadata?: Record<string, unknown> | null
}

interface LettersChatPanelProps {
  caseId: string
  initialMessages: Message[]
  onLoadingChange?: (loading: boolean) => void
}

export function LettersChatPanel({ caseId, initialMessages, onLoadingChange }: LettersChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [isLoading, setIsLoadingState] = useState(false)

  const setIsLoading = useCallback((v: boolean) => {
    setIsLoadingState(v)
    onLoadingChange?.(v)
  }, [onLoadingChange])

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
        const res = await fetch(`/api/case/${caseId}/document-chat`, {
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
        console.error('Letters chat error:', err)
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

  const clearHistory = useCallback(async () => {
    if (isLoading) return
    try {
      const res = await fetch(`/api/case/${caseId}/document-chat`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setMessages([])
      }
    } catch (err) {
      console.error('Clear history error:', err)
    }
  }, [caseId, isLoading])

  return (
    <div className="flex flex-col h-full">
      {/* Header with clear button */}
      {messages.length > 0 && (
        <div className="shrink-0 flex justify-end px-4 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={clearHistory}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground text-xs gap-1.5"
          >
            <RotateCcw className="h-3 w-3" />
            Clear history
          </Button>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          {messages.length === 0 && !isLoading ? (
            <div className="h-full flex items-center justify-center text-stone-400 dark:text-stone-500">
              <div className="text-center">
                <p className="text-lg font-medium">Letter strategy</p>
                <p className="text-sm mt-1">
                  Discuss letter drafting strategy and get guidance
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
          isLoading={isLoading}
          placeholder="Ask about letter strategy..."
        />
      </div>
    </div>
  )
}
