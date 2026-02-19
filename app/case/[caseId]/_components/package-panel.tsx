'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TiptapEditor } from '@/components/ui/tiptap-editor'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  FileText,
  Download,
  Save,
  ChevronDown,
  ChevronRight,
  Check,
  CircleCheck,
  AlertCircle,
  Package,
  Eye,
  Clock,
  ArrowLeft,
  Loader2,
  PenLine,
  Lock,
  FileDown,
  FlaskConical,
  PenTool,
} from 'lucide-react'
import { SignRequestDialog } from './sign-request-dialog'
import { SigningView } from './signing-view'
import type {
  PackageStructure,
  PackageExhibit,
  PackageDocument,
} from '@/lib/package-assembly'

// --- Types ---

interface VersionSummary {
  id: string
  version: number
  label: string | null
  createdAt: string
}

interface DocumentDetail {
  id: string
  name: string
  type: 'MARKDOWN' | 'DOCX' | 'PDF' | 'IMAGE'
  source: 'SYSTEM_GENERATED' | 'USER_UPLOADED'
  content?: string | null
  signedUrl?: string | null
  status: 'DRAFT' | 'FINAL'
  category?: string | null
}

type SaveStatus = 'saved' | 'saving' | 'unsaved'

interface SelectedDoc {
  documentId: string
  exhibitLabel: string
  exhibitTitle: string
}

// --- Component ---

export function PackagePanel({ caseId }: { caseId: string }) {
  const [structure, setStructure] = useState<PackageStructure | null>(null)
  const [versions, setVersions] = useState<VersionSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Selected document
  const [selected, setSelected] = useState<SelectedDoc | null>(null)
  const [docDetail, setDocDetail] = useState<DocumentDetail | null>(null)
  const [isLoadingDoc, setIsLoadingDoc] = useState(false)

  // Version viewing
  const [viewingVersion, setViewingVersion] = useState<{
    id: string
    version: number
    label: string | null
    structure: PackageStructure
  } | null>(null)

  // Save version dialog
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveLabel, setSaveLabel] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Export
  const [isExporting, setIsExporting] = useState(false)

  // Load sample
  const [isLoadingSample, setIsLoadingSample] = useState(false)

  // Signing
  const [signDialogOpen, setSignDialogOpen] = useState(false)
  const [signingViewOpen, setSigningViewOpen] = useState(false)

  // Autosave
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Active structure (live or frozen version)
  const activeStructure = viewingVersion?.structure ?? structure
  const isViewingVersion = viewingVersion !== null

  const totalDocs = useMemo(
    () => activeStructure?.exhibits.reduce((sum, e) => sum + e.documents.length, 0) ?? 0,
    [activeStructure]
  )

  // --- Data fetching ---

  const fetchPackage = useCallback(async () => {
    try {
      const res = await fetch(`/api/case/${caseId}/package`)
      if (!res.ok) throw new Error('Failed to load package')
      const data = await res.json()
      setStructure(data.structure)
      setVersions(data.versions)
    } catch (err) {
      setError('Failed to load package structure')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [caseId])

  useEffect(() => {
    fetchPackage()
  }, [fetchPackage])

  const fetchDocument = useCallback(
    async (docId: string) => {
      setIsLoadingDoc(true)
      try {
        const res = await fetch(`/api/case/${caseId}/documents/${docId}`)
        if (!res.ok) throw new Error('Failed to load document')
        const data = await res.json()
        setDocDetail(data)
        setSaveStatus('saved')
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoadingDoc(false)
      }
    },
    [caseId]
  )

  const handleSelectDoc = useCallback(
    (doc: PackageDocument, exhibit: PackageExhibit) => {
      setSelected({
        documentId: doc.documentId,
        exhibitLabel: exhibit.label,
        exhibitTitle: exhibit.title,
      })
      // If viewing frozen version and doc has snapshot, use that
      if (isViewingVersion && viewingVersion?.structure.letterSnapshots?.[doc.documentId]) {
        setDocDetail({
          id: doc.documentId,
          name: doc.name,
          type: 'MARKDOWN',
          source: doc.source,
          content: viewingVersion.structure.letterSnapshots[doc.documentId],
          status: 'FINAL',
          category: doc.category,
        })
        setIsLoadingDoc(false)
      } else {
        fetchDocument(doc.documentId)
      }
    },
    [fetchDocument, isViewingVersion, viewingVersion]
  )

  // --- Autosave ---

  const handleEditorUpdate = useCallback(
    (markdown: string) => {
      if (!docDetail || isViewingVersion) return
      setSaveStatus('unsaved')
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        setSaveStatus('saving')
        try {
          const res = await fetch(`/api/case/${caseId}/documents/${docDetail.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: markdown }),
          })
          setSaveStatus(res.ok ? 'saved' : 'unsaved')
        } catch {
          setSaveStatus('unsaved')
        }
      }, 2000)
    },
    [caseId, docDetail, isViewingVersion]
  )

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  // --- Save version ---

  const handleSaveVersion = useCallback(async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/case/${caseId}/package/save-version`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: saveLabel.trim() || null }),
      })
      if (!res.ok) throw new Error('Failed to save version')
      const saved = await res.json()
      setVersions((prev) => [saved, ...prev])
      setSaveDialogOpen(false)
      setSaveLabel('')
    } catch (err) {
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }, [caseId, saveLabel])

  // --- View version ---

  const handleViewVersion = useCallback(
    async (versionId: string) => {
      try {
        const res = await fetch(`/api/case/${caseId}/package/versions/${versionId}`)
        if (!res.ok) throw new Error('Failed to load version')
        const data = await res.json()
        setViewingVersion({
          id: data.id,
          version: data.version,
          label: data.label,
          structure: data.structure,
        })
        setSelected(null)
        setDocDetail(null)
      } catch (err) {
        console.error(err)
      }
    },
    [caseId]
  )

  const handleBackToLive = useCallback(() => {
    setViewingVersion(null)
    setSelected(null)
    setDocDetail(null)
  }, [])

  // --- Export PDF ---

  const handleExport = useCallback(async () => {
    setIsExporting(true)
    try {
      const body: Record<string, string> = {}
      if (viewingVersion) body.versionId = viewingVersion.id
      const res = await fetch(`/api/case/${caseId}/package/export-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'package.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
    } finally {
      setIsExporting(false)
    }
  }, [caseId, viewingVersion])

  // --- Load sample ---

  const handleLoadSample = useCallback(async () => {
    setIsLoadingSample(true)
    try {
      const res = await fetch(`/api/case/${caseId}/package/load-sample`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to load sample')
      const data = await res.json()
      if (!data.skipped) {
        await fetchPackage()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoadingSample(false)
    }
  }, [caseId, fetchPackage])

  // --- Loading state ---

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !activeStructure) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        {error || 'No package data available'}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Version banner */}
      {isViewingVersion && (
        <div className="shrink-0 px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800/50 flex items-center gap-3">
          <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
            Viewing Version {viewingVersion.version}
            {viewingVersion.label && ` -- ${viewingVersion.label}`}
          </span>
          <button
            onClick={handleBackToLive}
            className="text-xs font-medium text-amber-700 dark:text-amber-400 underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-200 transition-colors ml-auto"
          >
            Back to live
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="shrink-0 px-4 py-2.5 border-b border-border flex items-center gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Package className="w-4 h-4 text-muted-foreground shrink-0" />
          <h2 className="text-sm font-semibold truncate">Petition Package</h2>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground tabular-nums">
            {totalDocs} docs
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Version dropdown */}
          {versions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Versions
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {!isViewingVersion ? null : (
                  <DropdownMenuItem onClick={handleBackToLive} className="gap-2">
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to live
                  </DropdownMenuItem>
                )}
                {versions.map((v) => (
                  <DropdownMenuItem
                    key={v.id}
                    onClick={() => handleViewVersion(v.id)}
                    className="flex items-center gap-2 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium">
                        Version {v.version}
                        {v.label && <span className="text-muted-foreground ml-1">-- {v.label}</span>}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(v.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                    {viewingVersion?.id === v.id && (
                      <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {totalDocs === 0 && !isViewingVersion && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={handleLoadSample}
              disabled={isLoadingSample}
            >
              {isLoadingSample ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FlaskConical className="w-3.5 h-3.5" />
              )}
              Load Sample
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => setSaveDialogOpen(true)}
            disabled={isViewingVersion}
          >
            <Save className="w-3.5 h-3.5" />
            Save Version
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Export PDF
          </Button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Exhibit navigator */}
        <div className="w-[280px] shrink-0 border-r border-border flex flex-col bg-muted/20">
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-1">
              {activeStructure.exhibits.map((exhibit) => (
                <ExhibitAccordion
                  key={exhibit.label}
                  exhibit={exhibit}
                  selected={selected}
                  isViewingVersion={isViewingVersion}
                  onSelectDoc={handleSelectDoc}
                />
              ))}

              {activeStructure.exhibits.length === 0 && (
                <div className="text-center py-8">
                  <Package className="w-6 h-6 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">No exhibits yet</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    Upload documents and draft letters to build your package
                  </p>
                  {!isViewingVersion && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 h-8 text-xs gap-1.5"
                      onClick={handleLoadSample}
                      disabled={isLoadingSample}
                    >
                      {isLoadingSample ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <FlaskConical className="w-3.5 h-3.5" />
                      )}
                      Load Sample Package
                    </Button>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right: Document preview */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                  <Eye className="w-5 h-5 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Select a document</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Choose a document from the left panel to preview
                </p>
              </div>
            </div>
          ) : isLoadingDoc ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : docDetail ? (
            <>
              {/* Doc header */}
              <div className="shrink-0 px-4 py-2.5 border-b border-border flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-foreground/8 text-foreground/70 uppercase shrink-0">
                  Exhibit {selected.exhibitLabel}
                </span>
                <h3 className="text-sm font-medium truncate flex-1">{docDetail.name}</h3>
                <div className="flex items-center gap-2 shrink-0">
                  {!isViewingVersion && (
                    <Button
                      variant={docDetail.status === 'FINAL' ? 'outline' : 'ghost'}
                      size="sm"
                      className={cn(
                        'h-7 text-[11px] gap-1',
                        docDetail.status === 'FINAL'
                          ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                          : 'text-muted-foreground'
                      )}
                      onClick={async () => {
                        const newStatus = docDetail.status === 'DRAFT' ? 'FINAL' : 'DRAFT'
                        try {
                          const res = await fetch(`/api/case/${caseId}/documents/${docDetail.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: newStatus }),
                          })
                          if (res.ok) {
                            setDocDetail({ ...docDetail, status: newStatus })
                          }
                        } catch (err) {
                          console.error('Failed to update status:', err)
                        }
                      }}
                    >
                      {docDetail.status === 'DRAFT' ? (
                        <><CircleCheck className="w-3.5 h-3.5" /> Mark Final</>
                      ) : (
                        <><Check className="w-3.5 h-3.5" /> Final</>
                      )}
                    </Button>
                  )}
                  {docDetail.status === 'FINAL' && !isViewingVersion && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] gap-1"
                      onClick={() => setSignDialogOpen(true)}
                    >
                      <PenTool className="w-3.5 h-3.5" />
                      E-Sign
                    </Button>
                  )}
                  {docDetail.source === 'SYSTEM_GENERATED' ? (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-violet-600 dark:text-violet-400">
                      <PenLine className="w-3 h-3" />
                      Editable
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                      <Lock className="w-3 h-3" />
                      Read-only
                    </span>
                  )}
                  {docDetail.source === 'SYSTEM_GENERATED' && !isViewingVersion && (
                    <span
                      className={cn(
                        'text-[10px] font-medium',
                        saveStatus === 'saved' && 'text-muted-foreground',
                        saveStatus === 'saving' && 'text-amber-600 dark:text-amber-400',
                        saveStatus === 'unsaved' && 'text-orange-600 dark:text-orange-400'
                      )}
                    >
                      {saveStatus === 'saving' && 'Saving...'}
                      {saveStatus === 'unsaved' && 'Unsaved'}
                    </span>
                  )}
                  {docDetail.signedUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => window.open(docDetail.signedUrl!, '_blank')}
                      title="Download"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Doc content */}
              <div className="flex-1 min-h-0">
                {docDetail.content != null ? (
                  <TiptapEditor
                    content={docDetail.content}
                    onUpdate={handleEditorUpdate}
                    editable={docDetail.source === 'SYSTEM_GENERATED' && !isViewingVersion}
                    caseId={caseId}
                    documentName={docDetail.name}
                  />
                ) : docDetail.signedUrl ? (
                  <iframe
                    src={docDetail.signedUrl}
                    className="w-full h-full border-0"
                    title={docDetail.name}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">No preview available</p>
                      {docDetail.signedUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 text-xs gap-1.5"
                          onClick={() => window.open(docDetail.signedUrl!, '_blank')}
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          Download to view
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Save version dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Package Version</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              This will snapshot the current package structure and freeze all letter content.
            </p>
            <input
              type="text"
              value={saveLabel}
              onChange={(e) => setSaveLabel(e.target.value)}
              placeholder="Optional label (e.g. &quot;Final draft&quot;)"
              className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isSaving) handleSaveVersion()
              }}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSaveVersion} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Saving...
                </>
              ) : (
                'Save Version'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* E-Sign dialog */}
      {docDetail && (
        <SignRequestDialog
          open={signDialogOpen}
          onOpenChange={setSignDialogOpen}
          caseId={caseId}
          docId={docDetail.id}
          docName={docDetail.name}
          onSuccess={() => {
            setSignDialogOpen(false)
            setSigningViewOpen(true)
          }}
        />
      )}

      {/* Signing status view */}
      {signingViewOpen && docDetail && (
        <Dialog open={signingViewOpen} onOpenChange={setSigningViewOpen}>
          <DialogContent className="sm:max-w-lg max-h-[80vh] p-0 overflow-hidden">
            <SigningView
              caseId={caseId}
              docId={docDetail.id}
              docName={docDetail.name}
              onClose={() => setSigningViewOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

// --- ExhibitAccordion ---

function ExhibitAccordion({
  exhibit,
  selected,
  isViewingVersion,
  onSelectDoc,
}: {
  exhibit: PackageExhibit
  selected: SelectedDoc | null
  isViewingVersion: boolean
  onSelectDoc: (doc: PackageDocument, exhibit: PackageExhibit) => void
}) {
  const [isOpen, setIsOpen] = useState(true)
  const hasSelection = selected?.exhibitLabel === exhibit.label

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full group">
        <div
          className={cn(
            'flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors',
            'hover:bg-muted/60',
            hasSelection && 'bg-muted/40'
          )}
        >
          <span className="w-6 h-6 rounded-md bg-foreground/8 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-foreground/70">{exhibit.label}</span>
          </span>

          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-medium truncate">{exhibit.title}</p>
          </div>

          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
            {exhibit.documents.length}
          </span>

          {exhibit.documents.length > 0 ? (
            <Check className="w-3 h-3 text-emerald-500 shrink-0" />
          ) : (
            <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
          )}

          {isOpen ? (
            <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0 transition-transform" />
          ) : (
            <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0 transition-transform" />
          )}
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="ml-3 pl-4 border-l border-border/50 space-y-0.5 py-1 overflow-hidden">
          {exhibit.documents.map((doc) => {
            const isActive = selected?.documentId === doc.documentId
            const isEditable = doc.source === 'SYSTEM_GENERATED'

            return (
              <button
                key={doc.documentId}
                onClick={() => onSelectDoc(doc, exhibit)}
                title={doc.name}
                className={cn(
                  'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors min-w-0',
                  isActive
                    ? 'bg-primary/8 text-foreground'
                    : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                )}
              >
                <FileText className={cn('w-3.5 h-3.5 shrink-0', isActive && 'text-primary')} />
                <span className="text-[11px] truncate flex-1 min-w-0">{doc.name}</span>
                {isEditable ? (
                  <PenLine className="w-2.5 h-2.5 text-violet-500/60 shrink-0" />
                ) : (
                  <Lock className="w-2.5 h-2.5 text-muted-foreground/40 shrink-0" />
                )}
              </button>
            )
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
