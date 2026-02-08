'use client'

import { useRef, useEffect } from 'react'
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

interface ChatPanelProps {
  messages: Message[]
  isLoading: boolean
  onSend: (text: string) => void
  onFileSelect?: (file: File) => void
  onClear?: () => void
  showEvidenceAction?: boolean
  onStartEvidence?: () => void
  caseId?: string
}

export function ChatPanel({ messages, isLoading, onSend, onFileSelect, onClear, showEvidenceAction, onStartEvidence, caseId }: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const showTypingIndicator =
    isLoading &&
    (messages.length === 0 ||
      messages[messages.length - 1]?.role === 'user')

  return (
    <div className="flex flex-col h-full">
      {/* Header with clear button */}
      {messages.length > 0 && onClear && (
        <div className="shrink-0 flex justify-end px-4 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
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
                <p className="text-lg font-medium">Starting your case...</p>
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <MessageItem
                key={m.id}
                role={m.role}
                content={m.content}
                isFileUpload={m.metadata?.type === 'file_upload'}
                metadata={m.metadata}
                caseId={caseId}
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
          onSend={onSend}
          onFileSelect={onFileSelect}
          isLoading={isLoading}
          placeholder="Type a message or drop a file anywhere..."
          showEvidenceAction={showEvidenceAction}
          onStartEvidence={onStartEvidence}
        />
      </div>
    </div>
  )
}
