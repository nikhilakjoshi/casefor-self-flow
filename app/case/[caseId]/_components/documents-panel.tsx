'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileText, FileDown, Trash2, Upload, X } from 'lucide-react'
import { Markdown } from 'markdown-to-jsx'

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
}

function TypeIcon({ type }: { type: string }) {
  const label = type === 'MARKDOWN' ? 'MD' : type
  return (
    <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
      <span className="text-[10px] font-bold text-muted-foreground">{label}</span>
    </div>
  )
}

function SourceBadge({ source }: { source: string }) {
  const isSystem = source === 'SYSTEM_GENERATED'
  return (
    <span
      className={cn(
        'text-[10px] font-medium px-1.5 py-0.5 rounded',
        isSystem
          ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300'
          : 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
      )}
    >
      {isSystem ? 'System' : 'Uploaded'}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const isDraft = status === 'DRAFT'
  return (
    <span
      className={cn(
        'text-[10px] font-medium px-1.5 py-0.5 rounded',
        isDraft
          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
          : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
      )}
    >
      {isDraft ? 'Draft' : 'Final'}
    </span>
  )
}

export function DocumentsPanel({ caseId }: DocumentsPanelProps) {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [selectedDoc, setSelectedDoc] = useState<DocumentDetail | null>(null)
  const [isLoadingList, setIsLoadingList] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch(`/api/case/${caseId}/documents`)
      if (res.ok) {
        const data = await res.json()
        setDocuments(data)
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err)
    } finally {
      setIsLoadingList(false)
    }
  }, [caseId])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  async function viewDocument(docId: string) {
    try {
      const res = await fetch(`/api/case/${caseId}/documents/${docId}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedDoc(data)
      }
    } catch (err) {
      console.error('Failed to fetch document:', err)
    }
  }

  async function deleteDocument(docId: string) {
    try {
      const res = await fetch(`/api/case/${caseId}/documents/${docId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== docId))
        if (selectedDoc?.id === docId) setSelectedDoc(null)
      }
    } catch (err) {
      console.error('Failed to delete document:', err)
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
      }
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setIsUploading(false)
    }
  }

  // Detail/preview view
  if (selectedDoc) {
    return (
      <div className="h-full flex flex-col p-4 overflow-hidden">
        <div className="shrink-0 mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setSelectedDoc(null)}
              className="p-1 rounded hover:bg-muted"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-semibold truncate">{selectedDoc.name}</h3>
          </div>
          <div className="flex items-center gap-1">
            {selectedDoc.signedUrl && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => downloadDocument(selectedDoc)}
              >
                <FileDown className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          {selectedDoc.content ? (
            <div className="prose prose-sm dark:prose-invert max-w-none px-1">
              <Markdown>{selectedDoc.content}</Markdown>
            </div>
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
        </ScrollArea>
      </div>
    )
  }

  // List view
  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      <div className="shrink-0 mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
          Documents
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-3.5 h-3.5 mr-1" />
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
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center text-stone-400 dark:text-stone-500 py-8">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No documents yet</p>
            <p className="text-xs mt-1">
              Documents will appear here as the evidence agent drafts them
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/80 cursor-pointer group transition-colors"
                onClick={() => viewDocument(doc.id)}
              >
                <TypeIcon type={doc.type} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{doc.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <SourceBadge source={doc.source} />
                    <StatusBadge status={doc.status} />
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteDocument(doc.id)
                  }}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
