'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
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
  UserPlus,
  MoreVertical,
  Pencil,
  Trash2,
  FileText,
  Mail,
  Building2,
  Loader2,
  Upload,
  Check,
  X,
  Plus,
  ArrowRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { RecommenderForm, RecommenderData } from './recommender-form'

interface RecommenderItem {
  id: string
  name: string
  title: string
  relationshipType: string
  organization?: string | null
  email?: string | null
  _count?: { documents: number }
  createdAt: string
}

interface RecommendersPanelProps {
  caseId: string
}

const SIMPLE_FIELDS = ['name', 'title', 'organization', 'email', 'phone', 'linkedIn', 'countryRegion'] as const
const RICH_FIELDS = ['bio', 'credentials'] as const

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  title: 'Title',
  organization: 'Organization',
  email: 'Email',
  phone: 'Phone',
  linkedIn: 'LinkedIn',
  countryRegion: 'Region',
  bio: 'Bio',
  credentials: 'Credentials',
}

interface PendingEnrichment {
  recommenderId: string
  recName: string
  merged: Record<string, string>
  fieldTypes: Record<string, 'new' | 'append'>
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

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

function getRelationshipColor(type: string): string {
  const colors: Record<string, string> = {
    ACADEMIC_ADVISOR: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    RESEARCH_COLLABORATOR: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    INDUSTRY_COLLEAGUE: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    SUPERVISOR: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    MENTEE: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
    CLIENT: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    PEER_EXPERT: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    OTHER: 'bg-stone-500/10 text-stone-600 dark:text-stone-400 border-stone-500/20',
  }
  return colors[type] || colors.OTHER
}

export function RecommendersPanel({ caseId }: RecommendersPanelProps) {
  const [recommenders, setRecommenders] = useState<RecommenderItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingRecommender, setEditingRecommender] = useState<RecommenderData | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RecommenderItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [enrichingId, setEnrichingId] = useState<string | null>(null)
  const [pendingEnrichment, setPendingEnrichment] = useState<PendingEnrichment | null>(null)
  const [isSavingEnrichment, setIsSavingEnrichment] = useState(false)
  const didFetchRef = useRef(false)

  const fetchRecommenders = useCallback(async () => {
    try {
      const res = await fetch(`/api/case/${caseId}/recommenders`)
      if (res.ok) {
        const data = await res.json()
        setRecommenders(data)
      }
    } catch (err) {
      console.error('Failed to fetch recommenders:', err)
    } finally {
      setIsLoading(false)
    }
  }, [caseId])

  useEffect(() => {
    if (didFetchRef.current) return
    didFetchRef.current = true
    fetchRecommenders()
  }, [fetchRecommenders])

  const handleSave = useCallback(
    (saved: RecommenderData) => {
      if (editingRecommender) {
        setRecommenders((prev) =>
          prev.map((r) =>
            r.id === saved.id
              ? { ...r, ...saved }
              : r
          )
        )
      } else {
        fetchRecommenders()
      }
      setShowForm(false)
      setEditingRecommender(null)
    },
    [editingRecommender, fetchRecommenders]
  )

  const handleEdit = useCallback(async (recommender: RecommenderItem) => {
    try {
      const res = await fetch(`/api/case/${caseId}/recommenders/${recommender.id}`)
      if (res.ok) {
        const data = await res.json()
        setEditingRecommender(data)
        setShowForm(true)
      }
    } catch (err) {
      console.error('Failed to fetch recommender:', err)
    }
  }, [caseId])

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const res = await fetch(
        `/api/case/${caseId}/recommenders/${deleteTarget.id}`,
        { method: 'DELETE' }
      )
      if (res.ok) {
        setRecommenders((prev) => prev.filter((r) => r.id !== deleteTarget.id))
      }
    } catch (err) {
      console.error('Failed to delete recommender:', err)
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }, [caseId, deleteTarget])

  const handleFileDrop = useCallback(async (recommenderId: string, files: File[]) => {
    setEnrichingId(recommenderId)
    const allMerged: Record<string, string> = {}
    const allFieldTypes: Record<string, 'new' | 'append'> = {}
    let recName = ''

    try {
      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)
        const extractRes = await fetch(`/api/case/${caseId}/recommenders/extract`, {
          method: 'POST',
          body: formData,
        })
        if (!extractRes.ok) {
          const err = await extractRes.json()
          toast.error(`Extract failed: ${err.error || file.name}`)
          continue
        }
        const { extracted } = await extractRes.json()

        const currentRes = await fetch(`/api/case/${caseId}/recommenders/${recommenderId}`)
        if (!currentRes.ok) break
        const current = await currentRes.json()
        recName = current.name

        for (const field of SIMPLE_FIELDS) {
          if (!current[field] && extracted[field]) {
            allMerged[field] = extracted[field]
            allFieldTypes[field] = 'new'
          }
        }
        for (const field of RICH_FIELDS) {
          if (extracted[field]) {
            if (current[field]) {
              allMerged[field] = current[field] + '\n\n' + extracted[field]
              allFieldTypes[field] = 'append'
            } else {
              allMerged[field] = extracted[field]
              allFieldTypes[field] = 'new'
            }
          }
        }
      }

      if (Object.keys(allMerged).length > 0) {
        setPendingEnrichment({
          recommenderId,
          recName,
          merged: allMerged,
          fieldTypes: allFieldTypes,
        })
      } else {
        toast('No new fields found to update')
      }
    } catch (err) {
      console.error('Enrichment failed:', err)
      toast.error('Extraction failed')
    } finally {
      setEnrichingId(null)
    }
  }, [caseId])

  const confirmEnrichment = useCallback(async () => {
    if (!pendingEnrichment) return
    setIsSavingEnrichment(true)
    try {
      const res = await fetch(
        `/api/case/${caseId}/recommenders/${pendingEnrichment.recommenderId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pendingEnrichment.merged),
        }
      )
      if (res.ok) {
        const count = Object.keys(pendingEnrichment.merged).length
        toast.success(`Updated ${count} field${count !== 1 ? 's' : ''} for ${pendingEnrichment.recName}`)
        await fetchRecommenders()
      } else {
        toast.error('Failed to save changes')
      }
    } catch {
      toast.error('Failed to save changes')
    } finally {
      setIsSavingEnrichment(false)
      setPendingEnrichment(null)
    }
  }, [caseId, pendingEnrichment, fetchRecommenders])

  const dismissEnrichment = useCallback(() => {
    setPendingEnrichment(null)
  }, [])

  if (showForm) {
    return (
      <div className="h-full overflow-hidden">
        <RecommenderForm
          caseId={caseId}
          recommender={editingRecommender ?? undefined}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false)
            setEditingRecommender(null)
          }}
        />
      </div>
    )
  }

  return (
    <>
      <div className="h-full flex flex-col p-4 overflow-hidden">
        {/* Header */}
        <div className="shrink-0 mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Recommenders
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {recommenders.length} recommender{recommenders.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => setShowForm(true)}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Add
          </Button>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 rounded-xl bg-muted/50 animate-pulse"
                  style={{ animationDelay: `${i * 100}ms` }}
                />
              ))}
            </div>
          ) : recommenders.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <UserPlus className="w-6 h-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                No recommenders yet
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1 max-w-[200px] mx-auto">
                Add recommenders to generate personalized recommendation letters
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 h-8 text-xs gap-1.5"
                onClick={() => setShowForm(true)}
              >
                <UserPlus className="w-3.5 h-3.5" />
                Add Recommender
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {recommenders.map((rec) => {
                const isPending = pendingEnrichment?.recommenderId === rec.id
                const isEnriching = enrichingId === rec.id
                const isDragOver = dragOverId === rec.id

                return (
                  <div
                    key={rec.id}
                    className={cn(
                      'group relative rounded-xl border overflow-hidden transition-all duration-200',
                      isDragOver
                        ? 'border-primary ring-2 ring-primary/20 bg-primary/[0.03]'
                        : isPending
                          ? 'border-primary/40 bg-card'
                          : 'border-border/50 bg-card/50 hover:bg-card hover:border-border'
                    )}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (!isEnriching && !isPending) setDragOverId(rec.id)
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        setDragOverId(null)
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setDragOverId(null)
                      const files = Array.from(e.dataTransfer.files)
                      if (files.length > 0 && !enrichingId && !isPending) {
                        handleFileDrop(rec.id, files)
                      }
                    }}
                  >
                    {/* Drag overlay */}
                    {isDragOver && !isEnriching && (
                      <div className="absolute inset-0 z-10 bg-primary/10 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/15 border border-primary/25">
                          <Upload className="w-3.5 h-3.5 text-primary" />
                          <span className="text-xs font-medium text-primary">Drop to enrich profile</span>
                        </div>
                      </div>
                    )}

                    {/* Extracting overlay */}
                    {isEnriching && (
                      <div className="absolute inset-0 z-10 bg-background/60 backdrop-blur-[2px] flex items-center justify-center">
                        <div className="flex items-center gap-2">
                          <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs text-muted-foreground">Extracting...</span>
                        </div>
                      </div>
                    )}

                    {/* Card content */}
                    <div className="p-3">
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-sm font-semibold text-primary">
                            {getInitials(rec.name)}
                          </span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{rec.name}</p>
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[9px] font-medium px-1.5 py-0 h-4',
                                getRelationshipColor(rec.relationshipType)
                              )}
                            >
                              {RELATIONSHIP_LABELS[rec.relationshipType] || rec.relationshipType}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {rec.title}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5">
                            {rec.organization && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {rec.organization}
                              </span>
                            )}
                            {rec.email && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {rec.email}
                              </span>
                            )}
                            {rec._count && rec._count.documents > 0 && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                {rec._count.documents} letter{rec._count.documents !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        {!isPending && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem
                                onClick={() => handleEdit(rec)}
                                className="gap-2"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setDeleteTarget(rec)}
                                className="gap-2"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>

                    {/* Drop hint */}
                    {!isPending && !isEnriching && (
                      <div className="px-3 pb-2 -mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                          <Upload className="w-2.5 h-2.5" />
                          Drop CV or bio to enrich profile
                        </p>
                      </div>
                    )}

                    {/* Enrichment preview */}
                    {isPending && pendingEnrichment && (
                      <div className="border-t border-primary/20">
                        {/* Field list */}
                        <div className="px-3 py-2 space-y-1.5">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 mb-2">
                            Extracted fields
                          </p>
                          {Object.entries(pendingEnrichment.merged).map(([field, value]) => {
                            const isAppend = pendingEnrichment.fieldTypes[field] === 'append'
                            return (
                              <div
                                key={field}
                                className={cn(
                                  'rounded-md px-2.5 py-1.5 text-[11px] border',
                                  isAppend
                                    ? 'bg-amber-500/[0.06] border-amber-500/15 dark:bg-amber-500/[0.08]'
                                    : 'bg-emerald-500/[0.06] border-emerald-500/15 dark:bg-emerald-500/[0.08]'
                                )}
                              >
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  {isAppend ? (
                                    <ArrowRight className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                                  ) : (
                                    <Plus className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  )}
                                  <span className={cn(
                                    'font-semibold',
                                    isAppend
                                      ? 'text-amber-700 dark:text-amber-300'
                                      : 'text-emerald-700 dark:text-emerald-300'
                                  )}>
                                    {FIELD_LABELS[field] || field}
                                  </span>
                                  <span className={cn(
                                    'ml-auto text-[10px]',
                                    isAppend
                                      ? 'text-amber-600/60 dark:text-amber-400/60'
                                      : 'text-emerald-600/60 dark:text-emerald-400/60'
                                  )}>
                                    {isAppend ? 'append' : 'new'}
                                  </span>
                                </div>
                                <p className="text-foreground/70 leading-relaxed line-clamp-2 pl-[18px]">
                                  {isAppend
                                    ? value.split('\n\n').slice(-1)[0]
                                    : value}
                                </p>
                              </div>
                            )
                          })}
                        </div>

                        {/* Action bar */}
                        <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/30 border-t border-border/50">
                          <Button
                            variant="ghost"
                            size="xs"
                            className="flex-1 text-muted-foreground"
                            onClick={dismissEnrichment}
                            disabled={isSavingEnrichment}
                          >
                            <X className="w-3 h-3" />
                            Discard
                          </Button>
                          <Button
                            size="xs"
                            className="flex-1"
                            onClick={confirmEnrichment}
                            disabled={isSavingEnrichment}
                          >
                            {isSavingEnrichment ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                            {isSavingEnrichment ? 'Saving...' : 'Apply'}
                          </Button>
                        </div>
                      </div>
                    )}
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
            <DialogTitle>Delete recommender</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {deleteTarget?.name}? This will also
              unlink any associated recommendation letters.
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
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
