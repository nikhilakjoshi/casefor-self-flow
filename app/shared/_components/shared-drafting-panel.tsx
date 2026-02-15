'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { TiptapEditor } from '@/components/ui/tiptap-editor'
import { ChatInput } from '@/components/ui/chat-input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

type Permission = 'VIEW' | 'EDIT' | 'FULL'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface SharedDraftingPanelProps {
  shareId: string
  permission: Permission
  document: {
    id: string
    name: string
    content: string | null
    category: string | null
  }
  caseName: string
}

export function SharedDraftingPanel({
  shareId,
  permission,
  document,
  caseName,
}: SharedDraftingPanelProps) {
  const router = useRouter()
  const canEdit = permission === 'EDIT' || permission === 'FULL'
  const canAI = permission === 'FULL'

  const [editorContent, setEditorContent] = useState(document.content || '')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const editorContentRef = useRef(editorContent)

  useEffect(() => {
    editorContentRef.current = editorContent
  }, [editorContent])

  // Load chat history
  useEffect(() => {
    if (!canAI) return
    setIsLoadingHistory(true)
    fetch(`/api/shared/${shareId}/draft-chat`)
      .then((res) => res.json())
      .then((data) => {
        if (data.messages?.length > 0) {
          setChatMessages(
            data.messages.map((m: { id: string; role: string; content: string }) => ({
              id: m.id,
              role: m.role as 'user' | 'assistant',
              content: m.content,
            }))
          )
        }
      })
      .catch(console.error)
      .finally(() => setIsLoadingHistory(false))
  }, [shareId, canAI])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const sendInstruction = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming || !canAI) return

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text.trim(),
      }

      const allMessages = [...chatMessages, userMsg]
      setChatMessages(allMessages)
      setIsStreaming(true)

      try {
        const res = await fetch(`/api/shared/${shareId}/draft-chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
          }),
        })

        if (!res.ok) throw new Error('Draft chat failed')

        const reader = res.body?.getReader()
        if (!reader) throw new Error('No reader')

        const decoder = new TextDecoder()
        let accumulated = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          accumulated += decoder.decode(value, { stream: true })
          setEditorContent(accumulated)
        }

        setChatMessages((prev) => [
          ...prev,
          { id: `status-${Date.now()}`, role: 'assistant', content: 'Document updated.' },
        ])
      } catch (err) {
        console.error('Draft chat error:', err)
        setChatMessages((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, role: 'assistant', content: 'Something went wrong.' },
        ])
      } finally {
        setIsStreaming(false)
      }
    },
    [shareId, chatMessages, isStreaming, canAI]
  )

  const handleSave = useCallback(async (content?: string) => {
    const saveContent = content ?? editorContentRef.current
    if (!saveContent || !canEdit) return

    setIsSaving(true)
    try {
      await fetch(`/api/shared/${shareId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: saveContent }),
      })
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setIsSaving(false)
    }
  }, [shareId, canEdit])

  const handleEditorUpdate = useCallback((markdown: string) => {
    setEditorContent(markdown)
  }, [])

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => router.push('/shared')}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{document.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{caseName}</p>
          </div>
          {isStreaming && (
            <span className="text-[10px] text-primary flex items-center gap-1 shrink-0">
              <Loader2 className="w-3 h-3 animate-spin" />
              Drafting...
            </span>
          )}
        </div>
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => handleSave()}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Save className="w-3 h-3" />
            )}
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        )}
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Chat panel - only for FULL permission */}
        {canAI && (
          <div className="w-1/4 min-w-[280px] max-w-[360px] flex flex-col border-r border-border">
            <div className="shrink-0 px-3 py-2 border-b border-border">
              <h4 className="text-xs font-medium text-muted-foreground">Instructions</h4>
            </div>
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-3 space-y-3">
                {isLoadingHistory ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                ) : chatMessages.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    Give instructions to edit the document.
                  </p>
                ) : (
                  chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        'text-xs rounded-lg px-3 py-2',
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground ml-4'
                          : 'bg-muted text-muted-foreground mr-4'
                      )}
                    >
                      {msg.content}
                    </div>
                  ))
                )}
                {isStreaming && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Drafting...
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>
            <div className="shrink-0 p-3 border-t border-border">
              <ChatInput
                onSend={sendInstruction}
                isLoading={isStreaming}
                placeholder="Give instructions..."
              />
            </div>
          </div>
        )}

        {/* Editor */}
        <div className="flex-1 min-h-0">
          <TiptapEditor
            content={editorContent}
            onUpdate={canEdit ? handleEditorUpdate : undefined}
            editable={canEdit}
            streaming={isStreaming}
            onSave={canEdit ? (md) => handleSave(md) : undefined}
            inlineEditUrl={canAI ? `/api/shared/${shareId}/inline-edit` : undefined}
            caseId={undefined}
            documentName={document.name}
          />
        </div>
      </div>
    </div>
  )
}
