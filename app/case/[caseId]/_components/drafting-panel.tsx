'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { TiptapEditor } from '@/components/ui/tiptap-editor'
import { ChatInput } from '@/components/ui/chat-input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Save, Loader2, ChevronDown, CircleCheck, CheckCircle2, PenTool, FileSignature } from 'lucide-react'
import { SignRequestDialog } from './sign-request-dialog'
import { SigningView } from './signing-view'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface DraftingDoc {
  id?: string
  name?: string
  content?: string
  recommenderId?: string
  category?: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface TemplateInputs {
  relationshipContext: string
  keyContributions: string
  specificAchievements: string
  expertiseArea: string
}

interface DraftingPanelProps {
  caseId: string
  document?: DraftingDoc
  onClose: () => void
  onSave?: (docId: string) => void
}

export function DraftingPanel({
  caseId,
  document,
  onClose,
  onSave,
}: DraftingPanelProps) {
  const { data: session } = useSession()
  const [docId, setDocId] = useState<string | undefined>(document?.id)
  const [docName, setDocName] = useState(document?.name || 'Untitled Document')
  const [editorContent, setEditorContent] = useState(document?.content || '')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [docStatus, setDocStatus] = useState<'DRAFT' | 'FINAL'>('DRAFT')
  const [docType, setDocType] = useState<string>('MARKDOWN')
  const [signDialogOpen, setSignDialogOpen] = useState(false)
  const [signingViewOpen, setSigningViewOpen] = useState(false)
  const [selfSigning, setSelfSigning] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const editorContentRef = useRef(editorContent)

  // Template inputs for recommendation letters
  const isRecLetter = document?.category === 'RECOMMENDATION_LETTER'
  const [templateInputsOpen, setTemplateInputsOpen] = useState(isRecLetter)
  const [templateInputs, setTemplateInputs] = useState<TemplateInputs>({
    relationshipContext: '',
    keyContributions: '',
    specificAchievements: '',
    expertiseArea: '',
  })
  const templateInputsRef = useRef(templateInputs)
  useEffect(() => { templateInputsRef.current = templateInputs }, [templateInputs])

  // Fetch recommender data to pre-fill template inputs
  const didFetchRecRef = useRef(false)
  useEffect(() => {
    if (!isRecLetter || !document?.recommenderId || didFetchRecRef.current) return
    didFetchRecRef.current = true
    fetch(`/api/case/${caseId}/recommenders/${document.recommenderId}`)
      .then((res) => res.ok ? res.json() : null)
      .then((rec) => {
        if (!rec) return
        setTemplateInputs((prev) => ({
          relationshipContext: rec.relationshipContext || prev.relationshipContext,
          keyContributions: prev.keyContributions,
          specificAchievements: prev.specificAchievements,
          expertiseArea: rec.bio || prev.expertiseArea,
        }))
      })
      .catch(console.error)
  }, [caseId, document?.recommenderId, isRecLetter])

  // Keep ref in sync
  useEffect(() => {
    editorContentRef.current = editorContent
  }, [editorContent])

  // Fetch doc status for existing documents
  useEffect(() => {
    if (!document?.id) return
    fetch(`/api/case/${caseId}/documents/${document.id}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data?.status) { setDocStatus(data.status); setDocType(data.type || 'MARKDOWN') } })
      .catch(console.error)
  }, [caseId, document?.id])

  // Load chat history for existing documents
  useEffect(() => {
    if (!document?.id) return
    setIsLoadingHistory(true)
    fetch(`/api/case/${caseId}/draft-chat?documentId=${document.id}`)
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
  }, [caseId, document?.id])

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const sendInstruction = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text.trim(),
      }

      const allMessages = [...chatMessages, userMsg]
      setChatMessages(allMessages)
      setIsStreaming(true)

      try {
        const res = await fetch(`/api/case/${caseId}/draft-chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: allMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            documentId: docId,
            documentName: docName,
            category: document?.category,
            recommenderId: document?.recommenderId,
            ...(isRecLetter && {
              templateInputs: templateInputsRef.current,
            }),
          }),
        })

        if (!res.ok) throw new Error('Draft chat failed')

        // Capture document ID from header (for new docs)
        const returnedDocId = res.headers.get('X-Document-Id')
        if (returnedDocId && !docId) {
          setDocId(returnedDocId)
        }

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

        // Add a status message to chat (not the full content)
        setChatMessages((prev) => [
          ...prev,
          {
            id: `status-${Date.now()}`,
            role: 'assistant',
            content: 'Document updated.',
          },
        ])
      } catch (err) {
        console.error('Draft chat error:', err)
        setChatMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: 'Something went wrong. Please try again.',
          },
        ])
      } finally {
        setIsStreaming(false)
      }
    },
    [caseId, chatMessages, docId, docName, document?.category, document?.recommenderId, isRecLetter, isStreaming]
  )

  // Auto-start drafting for new documents (no existing content)
  const didAutoDraftRef = useRef(false)
  useEffect(() => {
    if (didAutoDraftRef.current) return
    if (document?.id || document?.content) return // existing doc, don't auto-draft
    if (!document?.name && !document?.category) return // no context to draft from
    didAutoDraftRef.current = true
    const instruction = `Draft a ${document?.name || 'document'}`
    sendInstruction(instruction)
  }, [document?.id, document?.content, document?.name, document?.category, sendInstruction])

  const handleSave = useCallback(async (content?: string) => {
    const saveContent = content ?? editorContentRef.current
    if (!docId || !saveContent) return

    setIsSaving(true)
    try {
      // Save content
      await fetch(`/api/case/${caseId}/documents/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: saveContent, name: docName }),
      })
      onSave?.(docId)
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setIsSaving(false)
    }
  }, [caseId, docId, docName, onSave])

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
            onClick={onClose}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <input
            type="text"
            value={docName}
            onChange={(e) => setDocName(e.target.value)}
            className="text-sm font-medium bg-transparent border-none outline-none focus:ring-1 focus:ring-primary/30 rounded px-1.5 py-0.5 min-w-0 flex-1 max-w-[300px]"
          />
          {isStreaming && (
            <span className="text-[10px] text-primary flex items-center gap-1 shrink-0">
              <Loader2 className="w-3 h-3 animate-spin" />
              Drafting...
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {docId && docStatus === 'FINAL' && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                disabled={selfSigning}
                onClick={async () => {
                  if (!docId) return
                  setSelfSigning(true)
                  try {
                    const res = await fetch(`/api/case/${caseId}/documents/${docId}/sign`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ selfSign: true }),
                    })
                    if (res.ok) {
                      setSigningViewOpen(true)
                    }
                  } catch { /* ignore */ }
                  finally { setSelfSigning(false) }
                }}
              >
                {selfSigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSignature className="w-3.5 h-3.5" />}
                Sign Now
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setSignDialogOpen(true)}
              >
                <PenTool className="w-3.5 h-3.5" />
                E-Sign
              </Button>
            </>
          )}
          {docId && (
            <Button
              variant={docStatus === 'FINAL' ? 'outline' : 'ghost'}
              size="sm"
              className={cn(
                'h-7 text-xs gap-1',
                docStatus === 'FINAL'
                  ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : 'text-muted-foreground'
              )}
              onClick={async () => {
                const newStatus = docStatus === 'DRAFT' ? 'FINAL' : 'DRAFT'
                try {
                  const res = await fetch(`/api/case/${caseId}/documents/${docId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: newStatus }),
                  })
                  if (res.ok) setDocStatus(newStatus)
                } catch (err) {
                  console.error('Failed to update status:', err)
                }
              }}
            >
              {docStatus === 'DRAFT' ? (
                <><CircleCheck className="w-3.5 h-3.5" /> Mark Final</>
              ) : (
                <><CheckCircle2 className="w-3.5 h-3.5" /> Final</>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => handleSave()}
            disabled={isSaving || !docId}
          >
            {isSaving ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Save className="w-3 h-3" />
            )}
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Template Inputs for recommendation letters */}
      {isRecLetter && (
        <div className="shrink-0 border-b border-border">
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50"
            onClick={() => setTemplateInputsOpen((o) => !o)}
          >
            Template Inputs
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', templateInputsOpen && 'rotate-180')} />
          </button>
          {templateInputsOpen && (
            <div className="px-4 pb-3 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[10px] font-medium text-muted-foreground">Relationship Context</span>
                <textarea
                  rows={2}
                  value={templateInputs.relationshipContext}
                  onChange={(e) => setTemplateInputs((p) => ({ ...p, relationshipContext: e.target.value }))}
                  className="mt-0.5 w-full text-xs bg-muted/50 border border-border rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-primary/30"
                  placeholder="How do you know the recommender?"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-medium text-muted-foreground">Expertise Area</span>
                <textarea
                  rows={2}
                  value={templateInputs.expertiseArea}
                  onChange={(e) => setTemplateInputs((p) => ({ ...p, expertiseArea: e.target.value }))}
                  className="mt-0.5 w-full text-xs bg-muted/50 border border-border rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-primary/30"
                  placeholder="Recommender's area of expertise"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-medium text-muted-foreground">Key Contributions to Highlight</span>
                <textarea
                  rows={2}
                  value={templateInputs.keyContributions}
                  onChange={(e) => setTemplateInputs((p) => ({ ...p, keyContributions: e.target.value }))}
                  className="mt-0.5 w-full text-xs bg-muted/50 border border-border rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-primary/30"
                  placeholder="What contributions should the letter emphasize?"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-medium text-muted-foreground">Specific Achievements to Reference</span>
                <textarea
                  rows={2}
                  value={templateInputs.specificAchievements}
                  onChange={(e) => setTemplateInputs((p) => ({ ...p, specificAchievements: e.target.value }))}
                  className="mt-0.5 w-full text-xs bg-muted/50 border border-border rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-primary/30"
                  placeholder="Specific achievements or publications to reference"
                />
              </label>
            </div>
          )}
        </div>
      )}

      {/* Main content: chat left, editor right */}
      <div className="flex flex-1 min-h-0">
        {/* Chat panel - left 1/4 */}
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
                  Give instructions to start drafting.
                  {'\n'}E.g. &ldquo;Draft a recommendation letter for Dr. Smith&rdquo;
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
              placeholder={docStatus === 'FINAL' ? 'Document is finalized' : 'Give instructions...'}
              disabled={docStatus === 'FINAL'}
            />
          </div>
        </div>

        {/* Editor - right 3/4 */}
        <div className="flex-1 min-h-0">
          <TiptapEditor
            content={editorContent}
            onUpdate={handleEditorUpdate}
            editable={docStatus !== 'FINAL'}
            streaming={isStreaming}
            onSave={(md) => handleSave(md)}
            onClose={onClose}
            caseId={caseId}
            documentId={docId}
            documentName={docName}
            trackChangesDefault={false}
            userId={session?.user?.id}
            userNickname={session?.user?.name || undefined}
          />
        </div>
      </div>

      {docId && (
        <SignRequestDialog
          open={signDialogOpen}
          onOpenChange={setSignDialogOpen}
          caseId={caseId}
          docId={docId}
          docName={docName}
          currentUserEmail={session?.user?.email ?? undefined}
          currentUserName={session?.user?.name ?? undefined}
          onSuccess={() => {
            setSignDialogOpen(false)
            setSigningViewOpen(true)
          }}
        />
      )}

      {signingViewOpen && docId && (
        <Dialog open={signingViewOpen} onOpenChange={setSigningViewOpen}>
          <DialogContent className="sm:max-w-2xl h-[90vh] p-0 overflow-hidden flex flex-col">
            <SigningView
              caseId={caseId}
              docId={docId}
              docName={docName}
              currentUserEmail={session?.user?.email ?? undefined}
              onClose={() => setSigningViewOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
