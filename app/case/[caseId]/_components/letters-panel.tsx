'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  FileText,
  Users,
  PenLine,
  Plus,
  Loader2,
  Clock,
  Scale,
  ClipboardList,
  FileSpreadsheet,
  Upload,
  Shield,
  FileCheck,
  BookOpen,
} from 'lucide-react'
import { CRITERIA_LABELS } from '@/lib/evidence-verification-schema'
import { RecommenderForm } from './recommender-form'
import type { RecommenderData } from './recommender-form'
import { CsvImportModal } from './csv-import-modal'

interface DocumentItem {
  id: string
  name: string
  type: string
  source: string
  status: 'DRAFT' | 'FINAL'
  category?: string | null
  recommenderId?: string | null
  createdAt: string
}

interface Recommender {
  id: string
  name: string
  title: string
  relationshipType: string
  organization?: string | null
  criteriaKeys?: string[]
}

interface LettersPanelProps {
  caseId: string
  onOpenDraft: (doc?: {
    id?: string
    name?: string
    content?: string
    recommenderId?: string
    category?: string
  }) => void
}

interface LetterType {
  key: string
  title: string
  description: string
  category: string | null
  icon: typeof Users
  gradient: string
  iconColor: string
  isPerRecommender?: boolean
  isDraftable?: boolean
}

const LETTER_TYPES: LetterType[] = [
  {
    key: 'recommendation',
    title: 'Recommendation Letters',
    description: 'Letters from experts supporting your case',
    category: 'RECOMMENDATION_LETTER',
    icon: Users,
    gradient: 'from-blue-500/15 to-indigo-500/15',
    iconColor: 'text-blue-600 dark:text-blue-400',
    isPerRecommender: true,
    isDraftable: true,
  },
  {
    key: 'cover_letter',
    title: 'Cover Letter',
    description: 'Introduction letter for your petition package',
    category: 'COVER_LETTER',
    icon: BookOpen,
    gradient: 'from-cyan-500/15 to-sky-500/15',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    isDraftable: true,
  },
  {
    key: 'personal_statement',
    title: 'Personal Statement',
    description: 'Your narrative of extraordinary ability',
    category: 'PERSONAL_STATEMENT',
    icon: PenLine,
    gradient: 'from-violet-500/15 to-fuchsia-500/15',
    iconColor: 'text-violet-600 dark:text-violet-400',
    isDraftable: true,
  },
  {
    key: 'petition',
    title: 'Petition Letter',
    description: 'Legal argument for your case',
    category: 'PETITION_LETTER',
    icon: Scale,
    gradient: 'from-amber-500/15 to-orange-500/15',
    iconColor: 'text-amber-600 dark:text-amber-400',
    isDraftable: true,
  },
  {
    key: 'uscis_advisory',
    title: 'USCIS Advisory Letter',
    description: 'Expert opinion letter for USCIS review',
    category: 'USCIS_ADVISORY_LETTER',
    icon: Shield,
    gradient: 'from-rose-500/15 to-pink-500/15',
    iconColor: 'text-rose-600 dark:text-rose-400',
    isDraftable: true,
  },
  {
    key: 'i140',
    title: 'I-140 Petition',
    description: 'Immigrant Petition for Alien Workers',
    category: 'I140',
    icon: ClipboardList,
    gradient: 'from-emerald-500/15 to-teal-500/15',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    isDraftable: false,
  },
  {
    key: 'i907',
    title: 'I-907 Premium Processing',
    description: 'Request for Premium Processing Service',
    category: 'I907',
    icon: FileCheck,
    gradient: 'from-emerald-500/15 to-teal-500/15',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    isDraftable: false,
  },
  {
    key: 'g28',
    title: 'G-28 Attorney Representation',
    description: 'Notice of Entry of Appearance as Attorney',
    category: 'G28',
    icon: ClipboardList,
    gradient: 'from-emerald-500/15 to-teal-500/15',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    isDraftable: false,
  },
  {
    key: 'g1450ppu',
    title: 'G-1450 (Premium Processing)',
    description: 'Authorization for Credit Card - Premium Processing',
    category: 'G1450PPU',
    icon: FileSpreadsheet,
    gradient: 'from-stone-500/15 to-zinc-500/15',
    iconColor: 'text-stone-600 dark:text-stone-400',
    isDraftable: false,
  },
  {
    key: 'g1450300',
    title: 'G-1450 (I-140 Fee)',
    description: 'Authorization for Credit Card - I-140 Filing Fee',
    category: 'G1450300',
    icon: FileSpreadsheet,
    gradient: 'from-stone-500/15 to-zinc-500/15',
    iconColor: 'text-stone-600 dark:text-stone-400',
    isDraftable: false,
  },
  {
    key: 'g1450i40',
    title: 'G-1450 (I-40)',
    description: 'Authorization for Credit Card - I-40',
    category: 'G1450I40',
    icon: FileSpreadsheet,
    gradient: 'from-stone-500/15 to-zinc-500/15',
    iconColor: 'text-stone-600 dark:text-stone-400',
    isDraftable: false,
  },
]

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

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'w-1.5 h-1.5 rounded-full shrink-0',
        status === 'DRAFT' ? 'bg-amber-500' : 'bg-emerald-500'
      )}
      title={status === 'DRAFT' ? 'Draft' : 'Final'}
    />
  )
}

function DraftRow({
  doc,
  caseId,
  onOpenDraft,
}: {
  doc: DocumentItem
  caseId: string
  onOpenDraft: LettersPanelProps['onOpenDraft']
}) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/case/${caseId}/documents/${doc.id}`)
      if (res.ok) {
        const data = await res.json()
        onOpenDraft({
          id: data.id,
          name: data.name,
          content: data.content,
          category: data.category,
        })
      }
    } catch (err) {
      console.error('Failed to load draft:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border/40 bg-background/50 hover:bg-muted/50 transition-colors text-left group"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />
      ) : (
        <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      )}
      <span className="flex-1 min-w-0 text-xs font-medium truncate">
        {doc.name}
      </span>
      <StatusDot status={doc.status} />
      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 shrink-0">
        <Clock className="w-2.5 h-2.5" />
        {formatDate(doc.createdAt)}
      </span>
    </button>
  )
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  ACADEMIC_ADVISOR: 'Academic Advisor',
  RESEARCH_COLLABORATOR: 'Research Collaborator',
  INDUSTRY_COLLEAGUE: 'Industry Colleague',
  SUPERVISOR: 'Supervisor',
  MENTEE: 'Mentee',
  CLIENT: 'Client',
  PEER_EXPERT: 'Peer Expert',
  OTHER: 'Other',
}

function UploadOnlyCard({
  letterType,
  docs,
  caseId,
  onUploaded,
}: {
  letterType: LetterType
  docs: DocumentItem[]
  caseId: string
  onUploaded: () => void
}) {
  const Icon = letterType.icon
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (letterType.category) {
        formData.append('category', letterType.category)
      }
      const res = await fetch(`/api/case/${caseId}/documents`, {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        toast.success(`Uploaded ${file.name}`)
        onUploaded()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Upload failed')
      }
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-border/50 bg-card/50 overflow-hidden transition-colors',
        dragOver && 'border-primary/50 bg-primary/5'
      )}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-gradient-to-br',
            letterType.gradient
          )}
        >
          <Icon className={cn('w-4 h-4', letterType.iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold">{letterType.title}</h3>
          <p className="text-[11px] text-muted-foreground">
            {letterType.description}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {docs.length > 0 && (
            <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5">
              {docs.length} file{docs.length !== 1 ? 's' : ''}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Upload className="w-3 h-3" />
            )}
            Upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.docx,.doc,.md,.txt"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleUpload(file)
              e.target.value = ''
            }}
          />
        </div>
      </div>

      {docs.length > 0 && (
        <div className="px-3 pb-3 space-y-1">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border/40 bg-background/50"
            >
              <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1 min-w-0 text-xs font-medium truncate">
                {doc.name}
              </span>
              <StatusDot status={doc.status} />
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 shrink-0">
                <Clock className="w-2.5 h-2.5" />
                {formatDate(doc.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function LettersPanel({ caseId, onOpenDraft }: LettersPanelProps) {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [recommenders, setRecommenders] = useState<Recommender[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddRecommender, setShowAddRecommender] = useState(false)
  const [showCsvImport, setShowCsvImport] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [docsRes, recRes] = await Promise.all([
        fetch(`/api/case/${caseId}/documents`),
        fetch(`/api/case/${caseId}/recommenders`),
      ])

      if (docsRes.ok) {
        const docs = await docsRes.json()
        setDocuments(docs)
      }
      if (recRes.ok) {
        const recs = await recRes.json()
        setRecommenders(recs)
      }
    } catch (err) {
      console.error('Failed to fetch letters data:', err)
    } finally {
      setIsLoading(false)
    }
  }, [caseId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRecommenderSaved = useCallback((_rec: RecommenderData) => {
    setShowAddRecommender(false)
    fetchData()
  }, [fetchData])

  const getDocsForCategory = useCallback(
    (category: string | null) => {
      if (!category) return []
      return documents.filter((d) => d.category === category)
    },
    [documents]
  )

  const getDocsForRecommender = useCallback(
    (recommenderId: string) => {
      return documents.filter(
        (d) =>
          d.category === 'RECOMMENDATION_LETTER' &&
          d.recommenderId === recommenderId
      )
    },
    [documents]
  )

  if (isLoading) {
    return (
      <div className="h-full p-4">
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-32 rounded-xl bg-muted/50 animate-pulse"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
    <ScrollArea className="h-full">
      <div className="p-4 space-y-3">
        {LETTER_TYPES.map((letterType) => {
          const Icon = letterType.icon

          if (letterType.isPerRecommender) {
            const allRecDocs = getDocsForCategory('RECOMMENDATION_LETTER')

            return (
              <div
                key={letterType.key}
                className="rounded-xl border border-border/50 bg-card/50 overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-gradient-to-br',
                      letterType.gradient
                    )}
                  >
                    <Icon className={cn('w-4 h-4', letterType.iconColor)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold">{letterType.title}</h3>
                    <p className="text-[11px] text-muted-foreground">
                      {letterType.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {allRecDocs.length > 0 && (
                      <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                        {allRecDocs.length} draft{allRecDocs.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] gap-1"
                      onClick={() => setShowCsvImport(true)}
                    >
                      <FileSpreadsheet className="w-3 h-3" />
                      Import CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] gap-1"
                      onClick={() => setShowAddRecommender(true)}
                    >
                      <Plus className="w-3 h-3" />
                      Add
                    </Button>
                  </div>
                </div>

                {/* Recommender sub-cards */}
                <div className="p-3 space-y-2">
                  {recommenders.length === 0 ? (
                    <div className="text-center py-6">
                      <Users className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground mb-3">
                        No recommenders added yet
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1.5"
                        onClick={() => setShowAddRecommender(true)}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Recommender
                      </Button>
                    </div>
                  ) : (
                    recommenders.map((rec) => {
                      const recDocs = getDocsForRecommender(rec.id)

                      return (
                        <div
                          key={rec.id}
                          className="rounded-lg border border-border/40 bg-background/50 p-3"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className="w-6 h-6 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0">
                                <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400">
                                  {rec.name
                                    .split(' ')
                                    .slice(0, 2)
                                    .map((n) => n[0])
                                    .join('')
                                    .toUpperCase()}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium truncate">
                                  {rec.name}
                                </p>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {rec.title}
                                  {rec.organization && `, ${rec.organization}`}
                                </p>
                                {rec.criteriaKeys && rec.criteriaKeys.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {rec.criteriaKeys.slice(0, 3).map((key) => (
                                      <span
                                        key={key}
                                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                        title={CRITERIA_LABELS[key] ?? key}
                                      >
                                        {key}
                                      </span>
                                    ))}
                                    {rec.criteriaKeys.length > 3 && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-muted text-muted-foreground">
                                        +{rec.criteriaKeys.length - 3} more
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px] gap-1 shrink-0 ml-2"
                              onClick={() =>
                                onOpenDraft({
                                  name: `Recommendation Letter - ${rec.name}`,
                                  category: 'RECOMMENDATION_LETTER',
                                  recommenderId: rec.id,
                                })
                              }
                            >
                              <PenLine className="w-3 h-3" />
                              Draft
                            </Button>
                          </div>

                          {recDocs.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {recDocs.map((doc) => (
                                <DraftRow
                                  key={doc.id}
                                  doc={doc}
                                  caseId={caseId}
                                  onOpenDraft={onOpenDraft}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          }

          const docs = getDocsForCategory(letterType.category)

          // Upload-only card (not draftable)
          if (letterType.isDraftable === false) {
            return (
              <UploadOnlyCard
                key={letterType.key}
                letterType={letterType}
                docs={docs}
                caseId={caseId}
                onUploaded={fetchData}
              />
            )
          }

          // Standard draftable card
          return (
            <div
              key={letterType.key}
              className="rounded-xl border border-border/50 bg-card/50 overflow-hidden"
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-gradient-to-br',
                    letterType.gradient
                  )}
                >
                  <Icon className={cn('w-4 h-4', letterType.iconColor)} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold">{letterType.title}</h3>
                  <p className="text-[11px] text-muted-foreground">
                    {letterType.description}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px] gap-1 shrink-0"
                  onClick={() =>
                    onOpenDraft({
                      name: letterType.title,
                      category: letterType.category || undefined,
                    })
                  }
                >
                  <PenLine className="w-3 h-3" />
                  Draft
                </Button>
              </div>

              {docs.length > 0 && (
                <div className="px-3 pb-3 space-y-1">
                  {docs.map((doc) => (
                    <DraftRow
                      key={doc.id}
                      doc={doc}
                      caseId={caseId}
                      onOpenDraft={onOpenDraft}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </ScrollArea>

    <CsvImportModal
      caseId={caseId}
      open={showCsvImport}
      onOpenChange={setShowCsvImport}
      onImported={fetchData}
    />

    <Dialog open={showAddRecommender} onOpenChange={setShowAddRecommender}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 max-h-[85vh] overflow-hidden" showCloseButton={false}>
        <RecommenderForm
          caseId={caseId}
          onSave={handleRecommenderSaved}
          onCancel={() => setShowAddRecommender(false)}
        />
      </DialogContent>
    </Dialog>
    </>
  )
}
