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
  FileSpreadsheet,
} from 'lucide-react'
import { RecommenderForm, RecommenderData } from './recommender-form'
import { CsvImportModal } from './csv-import-modal'

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

// Map relationship type to display label
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

// Get initials from name
function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

// Relationship type badge color
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
  const [showCsvImport, setShowCsvImport] = useState(false)
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
        // Update existing
        setRecommenders((prev) =>
          prev.map((r) =>
            r.id === saved.id
              ? { ...r, ...saved }
              : r
          )
        )
      } else {
        // Add new - refetch to get _count
        fetchRecommenders()
      }
      setShowForm(false)
      setEditingRecommender(null)
    },
    [editingRecommender, fetchRecommenders]
  )

  const handleEdit = useCallback(async (recommender: RecommenderItem) => {
    // Fetch full recommender data
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

  // Show form
  if (showForm) {
    return (
      <RecommenderForm
        caseId={caseId}
        recommender={editingRecommender ?? undefined}
        onSave={handleSave}
        onCancel={() => {
          setShowForm(false)
          setEditingRecommender(null)
        }}
      />
    )
  }

  // List view
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
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => setShowCsvImport(true)}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Import CSV
            </Button>
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
              {recommenders.map((rec) => (
                <div
                  key={rec.id}
                  className="group rounded-xl border border-border/50 bg-card/50 hover:bg-card hover:border-border transition-all duration-200 p-3"
                >
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
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      <CsvImportModal
        caseId={caseId}
        open={showCsvImport}
        onOpenChange={setShowCsvImport}
        onImported={fetchRecommenders}
      />

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
