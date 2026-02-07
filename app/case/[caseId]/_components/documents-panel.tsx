'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TiptapEditor } from '@/components/ui/tiptap-editor'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  FileText,
  FileDown,
  Upload,
  X,
  RotateCw,
  ChevronDown,
  ChevronRight,
  Trash2,
  Clock,
  Sparkles,
  FolderUp,
  Loader2,
  CheckCircle2,
  Circle,
  AlertCircle,
  Shield,
  Users,
} from 'lucide-react'
import { RecommendersPanel } from './recommenders-panel'

// Types
interface DocumentItem {
  id: string
  name: string
  type: 'MARKDOWN' | 'DOCX' | 'PDF'
  source: 'SYSTEM_GENERATED' | 'USER_UPLOADED'
  status: 'DRAFT' | 'FINAL'
  createdAt: string
}

interface DocumentDetail extends DocumentItem {
  content?: string | null
  signedUrl?: string | null
}

interface DocumentsPanelProps {
  caseId: string
  isChatActive?: boolean
}

interface DocumentGroup {
  baseName: string
  documents: DocumentItem[]
  latestDoc: DocumentItem
}

type StrengthLevel = 'missing' | 'draft' | 'weak' | 'moderate' | 'strong'

interface ChecklistItem {
  id: string
  type: 'personal_statement' | 'recommendation_letter' | 'evidence_document'
  label: string
  description: string
  criterionKey?: string
  status: StrengthLevel
  documentId?: string
  documentName?: string
  feedback?: string
}

interface DocumentChecklist {
  items: ChecklistItem[]
  summary: {
    total: number
    completed: number
    strong: number
    moderate: number
    weak: number
    missing: number
  }
  lastVerifiedAt?: string
}

// Helper functions
function extractBaseName(name: string): string {
  const dashIndex = name.lastIndexOf(' - ')
  if (dashIndex > 0) {
    return name.substring(0, dashIndex)
  }
  return name
}

function groupDocuments(documents: DocumentItem[]): DocumentGroup[] {
  const groups: Map<string, DocumentItem[]> = new Map()

  for (const doc of documents) {
    const baseName = extractBaseName(doc.name)
    const existing = groups.get(baseName) || []
    existing.push(doc)
    groups.set(baseName, existing)
  }

  return Array.from(groups.entries())
    .map(([baseName, docs]) => {
      const sorted = docs.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      return {
        baseName,
        documents: sorted,
        latestDoc: sorted[0],
      }
    })
    .sort(
      (a, b) =>
        new Date(b.latestDoc.createdAt).getTime() -
        new Date(a.latestDoc.createdAt).getTime()
    )
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// UI Components
function TypeBadge({ type }: { type: string }) {
  const label = type === 'MARKDOWN' ? 'MD' : type
  const colors = {
    MARKDOWN: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    PDF: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    DOCX: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
  }
  return (
    <span
      className={cn(
        'text-[9px] font-semibold tracking-wider px-1.5 py-0.5 rounded border uppercase',
        colors[type as keyof typeof colors] || 'bg-muted text-muted-foreground border-border'
      )}
    >
      {label}
    </span>
  )
}

function StrengthBadge({ strength }: { strength: StrengthLevel }) {
  const config = {
    missing: {
      label: 'Missing',
      className: 'bg-stone-500/10 text-stone-500 border-stone-500/20',
    },
    draft: {
      label: 'Draft',
      className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    },
    weak: {
      label: 'Weak',
      className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    },
    moderate: {
      label: 'Moderate',
      className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    },
    strong: {
      label: 'Strong',
      className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    },
  }

  const { label, className } = config[strength]

  return (
    <span
      className={cn(
        'text-[9px] font-semibold tracking-wide px-1.5 py-0.5 rounded border uppercase',
        className
      )}
    >
      {label}
    </span>
  )
}

function SourceIcon({ source }: { source: string }) {
  const isSystem = source === 'SYSTEM_GENERATED'
  return (
    <div
      className={cn(
        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
        isSystem
          ? 'bg-gradient-to-br from-violet-500/15 to-fuchsia-500/15 text-violet-600 dark:text-violet-400'
          : 'bg-gradient-to-br from-sky-500/15 to-cyan-500/15 text-sky-600 dark:text-sky-400'
      )}
    >
      {isSystem ? <Sparkles className="w-4 h-4" /> : <FolderUp className="w-4 h-4" />}
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const isDraft = status === 'DRAFT'
  return (
    <span
      className={cn(
        'w-1.5 h-1.5 rounded-full shrink-0',
        isDraft ? 'bg-amber-500' : 'bg-emerald-500'
      )}
      title={isDraft ? 'Draft' : 'Final'}
    />
  )
}

function ChecklistStatusIcon({ status }: { status: StrengthLevel }) {
  switch (status) {
    case 'missing':
      return <Circle className="w-4 h-4 text-stone-400" />
    case 'draft':
      return <AlertCircle className="w-4 h-4 text-amber-500" />
    case 'weak':
      return <AlertCircle className="w-4 h-4 text-rose-500" />
    case 'moderate':
      return <CheckCircle2 className="w-4 h-4 text-amber-500" />
    case 'strong':
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
  }
}

function ProgressRing({
  completed,
  total,
  size = 48,
}: {
  completed: number
  total: number
  size?: number
}) {
  const strokeWidth = 4
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const progress = total > 0 ? completed / total : 0
  const offset = circumference - progress * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-primary transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-semibold">
          {completed}/{total}
        </span>
      </div>
    </div>
  )
}

function DocumentChecklist({
  caseId,
  checklist,
  isLoading,
  isVerifying,
  onVerify,
  onViewDocument,
}: {
  caseId: string
  checklist: DocumentChecklist | null
  isLoading: boolean
  isVerifying: boolean
  onVerify: () => void
  onViewDocument: (docId: string) => void
}) {
  const [isOpen, setIsOpen] = useState(true)

  if (isLoading) {
    return (
      <div className="border-b border-border pb-4 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-muted/50 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 bg-muted/50 rounded animate-pulse" />
            <div className="h-3 w-48 bg-muted/50 rounded animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  if (!checklist) return null

  const { summary, items, lastVerifiedAt } = checklist

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-b border-border pb-4 mb-4">
      <div className="flex items-center gap-3">
        <ProgressRing completed={summary.completed} total={summary.total} />

        <div className="flex-1 min-w-0">
          <CollapsibleTrigger className="flex items-center gap-1.5 group">
            <h4 className="text-sm font-semibold">Evidence Checklist</h4>
            <ChevronDown
              className={cn(
                'w-4 h-4 text-muted-foreground transition-transform duration-200',
                !isOpen && '-rotate-90'
              )}
            />
          </CollapsibleTrigger>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">{summary.strong} strong</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-muted-foreground">{summary.moderate + summary.weak} needs work</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="w-2 h-2 rounded-full bg-stone-400" />
              <span className="text-muted-foreground">{summary.missing} missing</span>
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5 shrink-0"
          onClick={onVerify}
          disabled={isVerifying}
        >
          {isVerifying ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              <Shield className="w-3.5 h-3.5" />
              Verify
            </>
          )}
        </Button>
      </div>

      {lastVerifiedAt && (
        <p className="text-[10px] text-muted-foreground mt-2 ml-[60px]">
          Last verified {formatDate(lastVerifiedAt)}
        </p>
      )}

      <CollapsibleContent>
        <div className="mt-4 ml-[60px] space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                'flex items-start gap-3 p-2.5 rounded-lg border transition-colors',
                item.documentId
                  ? 'cursor-pointer hover:bg-muted/50 border-border/50'
                  : 'border-dashed border-border/30 bg-muted/20'
              )}
              onClick={() => item.documentId && onViewDocument(item.documentId)}
            >
              <ChecklistStatusIcon status={item.status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{item.label}</span>
                  <StrengthBadge strength={item.status} />
                </div>
                {item.documentName && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    {item.documentName}
                  </p>
                )}
                {item.feedback && (
                  <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                    {item.feedback}
                  </p>
                )}
              </div>
              {item.documentId && (
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

type SaveStatus = 'saved' | 'saving' | 'unsaved'
type PanelTab = 'documents' | 'recommenders'

// Tab selector component
function PanelTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: PanelTab
  onTabChange: (tab: PanelTab) => void
}) {
  return (
    <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
      <button
        onClick={() => onTabChange('documents')}
        className={cn(
          'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
          activeTab === 'documents'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <FileText className="w-3.5 h-3.5" />
        Documents
      </button>
      <button
        onClick={() => onTabChange('recommenders')}
        className={cn(
          'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
          activeTab === 'recommenders'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Users className="w-3.5 h-3.5" />
        Recommenders
      </button>
    </div>
  )
}

export function DocumentsPanel({ caseId, isChatActive }: DocumentsPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('documents')
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [selectedDoc, setSelectedDoc] = useState<DocumentDetail | null>(null)
  const [isLoadingList, setIsLoadingList] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [isStreaming, setIsStreaming] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DocumentItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Checklist state
  const [checklist, setChecklist] = useState<DocumentChecklist | null>(null)
  const [isLoadingChecklist, setIsLoadingChecklist] = useState(true)
  const [isVerifying, setIsVerifying] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const knownDocIdsRef = useRef<Set<string>>(new Set())

  const documentGroups = useMemo(() => groupDocuments(documents), [documents])

  // Fetch document checklist
  const fetchChecklist = useCallback(async () => {
    try {
      const res = await fetch(`/api/case/${caseId}/document-checklist`)
      if (res.ok) {
        const data = await res.json()
        setChecklist(data)
      }
    } catch (err) {
      console.error('Failed to fetch checklist:', err)
    } finally {
      setIsLoadingChecklist(false)
    }
  }, [caseId])

  // Verify documents
  const verifyDocuments = async () => {
    setIsVerifying(true)
    try {
      const res = await fetch(`/api/case/${caseId}/documents/verify`, {
        method: 'POST',
      })
      if (res.ok) {
        const data = await res.json()
        setChecklist(data)
      }
    } catch (err) {
      console.error('Failed to verify documents:', err)
    } finally {
      setIsVerifying(false)
    }
  }

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch(`/api/case/${caseId}/documents`)
      if (res.ok) {
        const data: DocumentItem[] = await res.json()
        setDocuments(data)
        return data
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err)
    } finally {
      setIsLoadingList(false)
    }
    return null
  }, [caseId])

  useEffect(() => {
    fetchDocuments().then((docs) => {
      if (docs) {
        knownDocIdsRef.current = new Set(docs.map((d) => d.id))
      }
    })
    fetchChecklist()
  }, [fetchDocuments, fetchChecklist])

  useEffect(() => {
    if (!isChatActive) return

    const interval = setInterval(async () => {
      const docs = await fetchDocuments()
      if (!docs) return

      const newDoc = docs.find((d) => !knownDocIdsRef.current.has(d.id))
      knownDocIdsRef.current = new Set(docs.map((d) => d.id))

      if (newDoc) {
        viewDocument(newDoc.id)
        // Refresh checklist when new doc appears
        fetchChecklist()
      }
    }, 3000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isChatActive, caseId])

  // Poll selected document content while chat is active (for streaming updates)
  const selectedDocIdRef = useRef<string | null>(null)
  const lastContentLengthRef = useRef<number>(0)
  const stableContentRef = useRef<number>(0)

  useEffect(() => {
    selectedDocIdRef.current = selectedDoc?.id ?? null
    lastContentLengthRef.current = selectedDoc?.content?.length ?? 0
  }, [selectedDoc?.id, selectedDoc?.content?.length])

  useEffect(() => {
    if (!isChatActive || !selectedDoc?.id) {
      setIsStreaming(false)
      return
    }

    const pollContent = async () => {
      const docId = selectedDocIdRef.current
      if (!docId) return

      try {
        const res = await fetch(`/api/case/${caseId}/documents/${docId}`)
        if (res.ok) {
          const data = await res.json()
          const newLength = data.content?.length ?? 0
          const oldLength = lastContentLengthRef.current

          if (newLength > oldLength) {
            setIsStreaming(true)
            stableContentRef.current = 0
            setSelectedDoc((prev) =>
              prev && prev.id === docId ? { ...prev, content: data.content } : prev
            )
          } else if (newLength === oldLength && newLength > 0) {
            stableContentRef.current++
            if (stableContentRef.current >= 3) {
              setIsStreaming(false)
            }
          }
        }
      } catch (err) {
        console.error('Failed to poll document content:', err)
      }
    }

    const interval = setInterval(pollContent, 500)
    return () => {
      clearInterval(interval)
      stableContentRef.current = 0
    }
  }, [isChatActive, selectedDoc?.id, caseId])

  async function viewDocument(docId: string) {
    try {
      const res = await fetch(`/api/case/${caseId}/documents/${docId}`)
      if (res.ok) {
        const data = await res.json()
        setSaveStatus('saved')
        setSelectedDoc(data)
      }
    } catch (err) {
      console.error('Failed to fetch document:', err)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/case/${caseId}/documents/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== deleteTarget.id))
        if (selectedDoc?.id === deleteTarget.id) setSelectedDoc(null)
        fetchChecklist()
      }
    } catch (err) {
      console.error('Failed to delete document:', err)
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  async function downloadDocument(doc: DocumentDetail) {
    if (doc.signedUrl) {
      window.open(doc.signedUrl, '_blank')
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`/api/case/${caseId}/documents`, {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        await fetchDocuments()
        fetchChecklist()
      }
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setIsUploading(false)
    }
  }

  const handleEditorUpdate = useCallback(
    (markdown: string) => {
      if (!selectedDoc) return

      setSaveStatus('unsaved')

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)

      saveTimerRef.current = setTimeout(async () => {
        setSaveStatus('saving')
        try {
          const res = await fetch(
            `/api/case/${caseId}/documents/${selectedDoc.id}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: markdown }),
            }
          )
          setSaveStatus(res.ok ? 'saved' : 'unsaved')
        } catch {
          setSaveStatus('unsaved')
        }
      }, 2000)
    },
    [caseId, selectedDoc]
  )

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  // Find strength for a document from checklist
  const getDocumentStrength = (docName: string): StrengthLevel | null => {
    if (!checklist) return null
    const baseName = extractBaseName(docName)
    const item = checklist.items.find(
      (i) => i.documentName && extractBaseName(i.documentName) === baseName
    )
    return item?.status ?? null
  }

  // Detail/editor view
  if (selectedDoc) {
    const strength = getDocumentStrength(selectedDoc.name)

    return (
      <div className="h-full flex flex-col overflow-hidden bg-background">
        <div className="shrink-0 px-4 py-3 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-sm font-medium truncate">{selectedDoc.name}</h3>
            <TypeBadge type={selectedDoc.type} />
            {strength && <StrengthBadge strength={strength} />}
            {isStreaming ? (
              <span className="text-[10px] ml-1 text-primary flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Generating...
              </span>
            ) : (
              <span
                className={cn(
                  'text-[10px] ml-1',
                  saveStatus === 'saved' && 'text-muted-foreground',
                  saveStatus === 'saving' && 'text-amber-600 dark:text-amber-400',
                  saveStatus === 'unsaved' && 'text-orange-600 dark:text-orange-400'
                )}
              >
                {saveStatus === 'saving' && 'Saving...'}
                {saveStatus === 'unsaved' && 'Unsaved'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {selectedDoc.signedUrl && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => downloadDocument(selectedDoc)}
                title="Download"
              >
                <FileDown className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => viewDocument(selectedDoc.id)}
              title="Refresh"
            >
              <RotateCw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSelectedDoc(null)}
              title="Close"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          {selectedDoc.content != null ? (
            <TiptapEditor
              content={selectedDoc.content}
              onUpdate={handleEditorUpdate}
              editable={selectedDoc.type === 'MARKDOWN'}
            />
          ) : selectedDoc.signedUrl ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>Binary file -- use download to view</p>
            </div>
          ) : (
            <div className="text-center text-sm text-muted-foreground py-8">
              <p>No preview available</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Recommenders tab
  if (activeTab === 'recommenders') {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        {/* Tab selector */}
        <div className="shrink-0 px-4 pt-4 pb-2">
          <PanelTabs activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
        {/* Recommenders panel content */}
        <div className="flex-1 min-h-0">
          <RecommendersPanel caseId={caseId} />
        </div>
      </div>
    )
  }

  // List view (documents tab)
  return (
    <>
      <div className="h-full flex flex-col p-4 overflow-hidden">
        {/* Tab selector */}
        <div className="shrink-0 mb-4">
          <PanelTabs activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        {/* Checklist section */}
        <DocumentChecklist
          caseId={caseId}
          checklist={checklist}
          isLoading={isLoadingChecklist}
          isVerifying={isVerifying}
          onVerify={verifyDocuments}
          onViewDocument={viewDocument}
        />

        {/* Header */}
        <div className="shrink-0 mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">All Documents</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {documents.length} file{documents.length !== 1 ? 's' : ''} across{' '}
              {documentGroups.length} document{documentGroups.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-3.5 h-3.5" />
            {isUploading ? 'Uploading...' : 'Upload'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.docx,.md,.markdown"
            onChange={handleUpload}
          />
        </div>

        <ScrollArea className="flex-1 min-h-0">
          {isLoadingList ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 rounded-xl bg-muted/50 animate-pulse"
                  style={{ animationDelay: `${i * 100}ms` }}
                />
              ))}
            </div>
          ) : documentGroups.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                No documents yet
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1 max-w-[200px] mx-auto">
                Documents will appear here as the evidence agent drafts them
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {documentGroups.map((group) => {
                const strength = getDocumentStrength(group.latestDoc.name)

                return (
                  <div
                    key={group.baseName}
                    className="group rounded-xl border border-border/50 bg-card/50 hover:bg-card hover:border-border transition-all duration-200"
                  >
                    <div className="flex items-center gap-3 p-3">
                      <SourceIcon source={group.latestDoc.source} />

                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => viewDocument(group.latestDoc.id)}
                      >
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">
                            {group.baseName}
                          </p>
                          <StatusDot status={group.latestDoc.status} />
                          {strength && <StrengthBadge strength={strength} />}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <TypeBadge type={group.latestDoc.type} />
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(group.latestDoc.createdAt)}
                          </span>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                          >
                            v{group.documents.length}
                            <ChevronDown className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          {group.documents.map((doc, idx) => (
                            <DropdownMenuItem
                              key={doc.id}
                              onClick={() => viewDocument(doc.id)}
                              className="flex items-center gap-2 py-2"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium">
                                    Version {group.documents.length - idx}
                                  </span>
                                  {idx === 0 && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                                      Latest
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-muted-foreground">
                                  {formatFullDate(doc.createdAt)}
                                </span>
                              </div>
                              <StatusDot status={doc.status} />
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={(e) => {
                              e.preventDefault()
                              setDeleteTarget(group.latestDoc)
                            }}
                            className="gap-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete latest version
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.name}&rdquo;? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
