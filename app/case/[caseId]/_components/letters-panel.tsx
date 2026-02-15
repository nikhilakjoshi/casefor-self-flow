'use client'

import { useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
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
  },
  {
    key: 'personal_statement',
    title: 'Personal Statement',
    description: 'Your narrative of extraordinary ability',
    category: 'PERSONAL_STATEMENT',
    icon: PenLine,
    gradient: 'from-violet-500/15 to-fuchsia-500/15',
    iconColor: 'text-violet-600 dark:text-violet-400',
  },
  {
    key: 'petition',
    title: 'Petition Letter',
    description: 'Legal argument for your case',
    category: 'PETITION_LETTER',
    icon: Scale,
    gradient: 'from-amber-500/15 to-orange-500/15',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  {
    key: 'uscis_form',
    title: 'USCIS Form',
    description: 'Required application forms',
    category: null,
    icon: ClipboardList,
    gradient: 'from-emerald-500/15 to-teal-500/15',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
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
      if (!category) {
        return documents.filter(
          (d) =>
            d.source === 'SYSTEM_GENERATED' &&
            d.name.toLowerCase().includes('uscis')
        )
      }
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

          // Standard letter type card
          const docs = getDocsForCategory(letterType.category)

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
