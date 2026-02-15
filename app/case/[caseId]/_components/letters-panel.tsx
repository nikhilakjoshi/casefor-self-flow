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
  ChevronDown,
  ExternalLink,
  PenTool,
  Package,
  FolderUp,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CRITERIA_LABELS } from '@/lib/evidence-verification-schema'
import { RecommenderForm } from './recommender-form'
import type { RecommenderData } from './recommender-form'
import { CsvImportModal } from './csv-import-modal'
import type { DenialProbability } from '@/lib/denial-probability-schema'

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
  denialProbability?: DenialProbability | null
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
  uscisUrl?: string
}

const LETTER_TYPES: LetterType[] = [
  {
    key: 'resume',
    title: 'Resume / CV',
    description: 'Generate or upload your resume highlighting extraordinary ability',
    category: 'RESUME_CV',
    icon: FileText,
    gradient: 'from-teal-500/15 to-emerald-500/15',
    iconColor: 'text-teal-600 dark:text-teal-400',
    isDraftable: true,
  },
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
    uscisUrl: 'https://www.uscis.gov/i-140',
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
    uscisUrl: 'https://www.uscis.gov/i-907',
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
    uscisUrl: 'https://www.uscis.gov/g-28',
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
    uscisUrl: 'https://www.uscis.gov/g-1450',
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
    uscisUrl: 'https://www.uscis.gov/g-1450',
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
    uscisUrl: 'https://www.uscis.gov/g-1450',
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

function getRiskBannerStyle(level: string) {
  switch (level) {
    case 'LOW': return { bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-700 dark:text-emerald-300', icon: 'text-emerald-600' }
    case 'MEDIUM': return { bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-700 dark:text-amber-300', icon: 'text-amber-600' }
    case 'HIGH': return { bg: 'bg-orange-500/10 border-orange-500/30', text: 'text-orange-700 dark:text-orange-300', icon: 'text-orange-600' }
    case 'VERY_HIGH': return { bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-700 dark:text-red-300', icon: 'text-red-600' }
    default: return { bg: 'bg-muted/60 border-border', text: 'text-muted-foreground', icon: 'text-muted-foreground' }
  }
}

function DenialRiskBanner({ data }: { data: DenialProbability }) {
  const [collapsed, setCollapsed] = useState(true)
  const assessment = data.overall_assessment
  if (!assessment) return null
  const style = getRiskBannerStyle(assessment.risk_level)
  const topRisks = data.red_flags?.slice(0, 3) ?? []
  const riskLabel = assessment.risk_level === 'VERY_HIGH' ? 'Very High' : assessment.risk_level.charAt(0) + assessment.risk_level.slice(1).toLowerCase()

  return (
    <div className={cn('rounded-lg border p-3', style.bg)}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 text-left"
      >
        <Shield className={cn('w-4 h-4 shrink-0', style.icon)} />
        <div className="flex-1 min-w-0">
          <span className={cn('text-xs font-semibold', style.text)}>
            {riskLabel} Denial Risk ({assessment.denial_probability_pct}%)
          </span>
        </div>
        <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', !collapsed && 'rotate-180')} />
      </button>
      {!collapsed && (
        <div className="mt-2 space-y-1.5">
          <p className={cn('text-[11px] leading-relaxed', style.text)}>
            {assessment.summary}
          </p>
          {topRisks.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Top risks</span>
              {topRisks.map((flag, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className={cn(
                    'w-1.5 h-1.5 rounded-full mt-1 shrink-0',
                    flag.level === 'HIGH' ? 'bg-red-500' : flag.level === 'MEDIUM' ? 'bg-amber-500' : 'bg-stone-400'
                  )} />
                  <span className="text-[11px] text-muted-foreground">{flag.description}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
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
  const [expanded, setExpanded] = useState(false)

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
        setExpanded(true)
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
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-3',
          docs.length > 0 && 'cursor-pointer'
        )}
        onClick={() => docs.length > 0 && setExpanded(!expanded)}
      >
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
          {letterType.uscisUrl && (
            <a
              href={letterType.uscisUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 h-7 px-3 rounded-md border border-border text-[11px] font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Fill on USCIS
            </a>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1"
            disabled={uploading}
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
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
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px] gap-1 cursor-not-allowed opacity-50"
                  disabled
                >
                  <PenTool className="w-3 h-3" />
                  E-Sign
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Coming soon</TooltipContent>
          </Tooltip>
          {docs.length > 0 && (
            <ChevronDown
              className={cn(
                'w-4 h-4 text-muted-foreground transition-transform',
                expanded && 'rotate-180'
              )}
            />
          )}
        </div>
      </div>

      {expanded && docs.length > 0 && (
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
              <span className="text-[10px] text-muted-foreground shrink-0">
                {doc.source === 'SYSTEM_GENERATED' ? 'System' : 'Uploaded'}
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

function RecommenderCard({
  letterType,
  recommenders,
  allRecDocs,
  getDocsForRecommender,
  caseId,
  onOpenDraft,
  onAddRecommender,
  onImportCsv,
  onUploaded,
}: {
  letterType: LetterType
  recommenders: Recommender[]
  allRecDocs: DocumentItem[]
  getDocsForRecommender: (id: string) => DocumentItem[]
  caseId: string
  onOpenDraft: LettersPanelProps['onOpenDraft']
  onAddRecommender: () => void
  onImportCsv: () => void
  onUploaded: () => void
}) {
  const Icon = letterType.icon
  const hasContent = recommenders.length > 0 || allRecDocs.length > 0
  const [expanded, setExpanded] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('category', 'RECOMMENDATION_LETTER')
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
      {/* Header */}
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-3',
          hasContent && 'border-b border-border/30 cursor-pointer'
        )}
        onClick={() => hasContent && setExpanded(!expanded)}
      >
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
            onClick={(e) => { e.stopPropagation(); onImportCsv() }}
          >
            <FileSpreadsheet className="w-3 h-3" />
            Import CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1"
            onClick={(e) => { e.stopPropagation(); onAddRecommender() }}
          >
            <Plus className="w-3 h-3" />
            Add
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1"
            disabled={uploading}
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
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
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px] gap-1 cursor-not-allowed opacity-50"
                  disabled
                >
                  <PenTool className="w-3 h-3" />
                  E-Sign
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Coming soon</TooltipContent>
          </Tooltip>
          {hasContent && (
            <ChevronDown
              className={cn(
                'w-4 h-4 text-muted-foreground transition-transform',
                expanded && 'rotate-180'
              )}
            />
          )}
        </div>
      </div>

      {/* Recommender sub-cards */}
      {expanded && (
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
                onClick={onAddRecommender}
              >
                <Plus className="w-3.5 h-3.5" />
                Add Recommender
              </Button>
            </div>
          ) : (
            (() => {
              const grouped = new Map<string, Recommender[]>()
              for (const rec of recommenders) {
                const type = rec.relationshipType || 'OTHER'
                const list = grouped.get(type) || []
                list.push(rec)
                grouped.set(type, list)
              }
              // Stable order: follow RELATIONSHIP_LABELS key order
              const typeOrder = Object.keys(RELATIONSHIP_LABELS)
              const sortedTypes = [...grouped.keys()].sort(
                (a, b) => (typeOrder.indexOf(a) === -1 ? 999 : typeOrder.indexOf(a)) - (typeOrder.indexOf(b) === -1 ? 999 : typeOrder.indexOf(b))
              )

              return sortedTypes.map((type) => {
                const recs = grouped.get(type)!
                return (
                  <div key={type} className="space-y-1.5">
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 pt-1">
                      {RELATIONSHIP_LABELS[type] ?? type}{' '}
                      <span className="font-normal">({recs.length})</span>
                    </h4>
                    {recs.map((rec) => {
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
                    })}
                  </div>
                )
              })
            })()
          )}
        </div>
      )}
    </div>
  )
}

function DraftableCard({
  letterType,
  docs,
  caseId,
  onOpenDraft,
  onUploaded,
}: {
  letterType: LetterType
  docs: DocumentItem[]
  caseId: string
  onOpenDraft: LettersPanelProps['onOpenDraft']
  onUploaded: () => void
}) {
  const Icon = letterType.icon
  const [expanded, setExpanded] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
        setExpanded(true)
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
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-3',
          docs.length > 0 && 'cursor-pointer'
        )}
        onClick={() => docs.length > 0 && setExpanded(!expanded)}
      >
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
              {docs.length} draft{docs.length !== 1 ? 's' : ''}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1"
            onClick={(e) => {
              e.stopPropagation()
              onOpenDraft({
                name: letterType.title,
                category: letterType.category || undefined,
              })
            }}
          >
            <PenLine className="w-3 h-3" />
            Draft
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1"
            disabled={uploading}
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
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
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px] gap-1 cursor-not-allowed opacity-50"
                  disabled
                >
                  <PenTool className="w-3 h-3" />
                  E-Sign
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Coming soon</TooltipContent>
          </Tooltip>
          {docs.length > 0 && (
            <ChevronDown
              className={cn(
                'w-4 h-4 text-muted-foreground transition-transform',
                expanded && 'rotate-180'
              )}
            />
          )}
        </div>
      </div>

      {expanded && docs.length > 0 && (
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
}

const CATEGORY_LABELS: Record<string, string> = {
  RESUME_CV: 'Resume / CV',
  AWARD_CERTIFICATE: 'Award Certificate',
  PUBLICATION: 'Publication',
  MEDIA_COVERAGE: 'Media Coverage',
  PATENT: 'Patent',
  RECOMMENDATION_LETTER: 'Recommendation Letter',
  MEMBERSHIP_CERTIFICATE: 'Membership Certificate',
  EMPLOYMENT_VERIFICATION: 'Employment Verification',
  SALARY_DOCUMENTATION: 'Salary Documentation',
  CITATION_REPORT: 'Citation Report',
  JUDGING_EVIDENCE: 'Judging Evidence',
  PERSONAL_STATEMENT: 'Personal Statement',
  PETITION_LETTER: 'Petition Letter',
  PASSPORT_ID: 'Passport / ID',
  DEGREE_CERTIFICATE: 'Degree Certificate',
  COVER_LETTER: 'Cover Letter',
  USCIS_ADVISORY_LETTER: 'USCIS Advisory Letter',
  G1450PPU: 'G-1450 (Premium Processing)',
  G1450300: 'G-1450 (I-140 Fee)',
  G1450I40: 'G-1450 (I-40)',
  G28: 'G-28 Attorney Representation',
  I140: 'I-140 Petition',
  I907: 'I-907 Premium Processing',
  OTHER: 'Other',
}

function CategoryPickerDialog({
  open,
  onOpenChange,
  suggestedCategory,
  documentId,
  fileName,
  caseId,
  onCategorized,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  suggestedCategory: string | null
  documentId: string
  fileName: string
  caseId: string
  onCategorized: () => void
}) {
  const [saving, setSaving] = useState(false)

  const handleSelect = async (category: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/case/${caseId}/documents/${documentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category }),
      })
      if (res.ok) {
        toast.success(`Categorized as ${CATEGORY_LABELS[category] || category}`)
        onCategorized()
        onOpenChange(false)
      } else {
        toast.error('Failed to update category')
      }
    } catch {
      toast.error('Failed to update category')
    } finally {
      setSaving(false)
    }
  }

  const categories = Object.entries(CATEGORY_LABELS)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-hidden" showCloseButton={false}>
        <div className="p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Categorize Document</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Select the correct category for <span className="font-medium">{fileName}</span>
            </p>
          </div>
          <div className="max-h-[50vh] overflow-y-auto space-y-1 pr-1">
            {categories.map(([value, label]) => (
              <button
                key={value}
                disabled={saving}
                onClick={() => handleSelect(value)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs transition-colors hover:bg-muted/60',
                  value === suggestedCategory && 'bg-primary/10 border border-primary/30'
                )}
              >
                <span className="flex-1">{label}</span>
                {value === suggestedCategory && (
                  <span className="text-[10px] text-primary font-medium shrink-0">Suggested</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function LettersPanel({ caseId, onOpenDraft, denialProbability }: LettersPanelProps) {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [recommenders, setRecommenders] = useState<Recommender[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddRecommender, setShowAddRecommender] = useState(false)
  const [showCsvImport, setShowCsvImport] = useState(false)
  const [assembling, setAssembling] = useState(false)
  const [globalDragOver, setGlobalDragOver] = useState(false)
  const [globalUploading, setGlobalUploading] = useState(false)
  const [categoryPicker, setCategoryPicker] = useState<{
    open: boolean
    documentId: string
    fileName: string
    suggestedCategory: string | null
  }>({ open: false, documentId: '', fileName: '', suggestedCategory: null })
  const globalDragCounterRef = useRef(0)

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

  const handleAssemblePackage = useCallback(async () => {
    setAssembling(true)
    try {
      const res = await fetch(`/api/case/${caseId}/assemble-package`, {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Package assembly failed')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const disposition = res.headers.get('Content-Disposition')
      const filenameMatch = disposition?.match(/filename="?([^"]+)"?/)
      const filename = filenameMatch?.[1] || 'package.pdf'
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Package assembled and downloaded')
    } catch {
      toast.error('Package assembly failed')
    } finally {
      setAssembling(false)
    }
  }, [caseId])

  const handleGlobalDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setGlobalDragOver(false)
    globalDragCounterRef.current = 0

    const file = e.dataTransfer.files[0]
    if (!file) return

    setGlobalUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('classifySync', 'true')

      const res = await fetch(`/api/case/${caseId}/documents`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Upload failed')
        return
      }

      const data = await res.json()
      const confidence = data.classificationConfidence ?? 0
      const category = data.category ?? null

      if (confidence > 0.7 && category) {
        toast.success(`Auto-categorized as ${CATEGORY_LABELS[category] || category}`)
        fetchData()
      } else {
        setCategoryPicker({
          open: true,
          documentId: data.id,
          fileName: file.name,
          suggestedCategory: category,
        })
      }
    } catch {
      toast.error('Upload failed')
    } finally {
      setGlobalUploading(false)
    }
  }, [caseId, fetchData])

  const handleGlobalDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    globalDragCounterRef.current++
    if (globalDragCounterRef.current === 1) {
      setGlobalDragOver(true)
    }
  }, [])

  const handleGlobalDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    globalDragCounterRef.current--
    if (globalDragCounterRef.current === 0) {
      setGlobalDragOver(false)
    }
  }, [])

  const handleGlobalDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

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
    <TooltipProvider>
    <>
    <div
      className="relative h-full"
      onDragEnter={handleGlobalDragEnter}
      onDragLeave={handleGlobalDragLeave}
      onDragOver={handleGlobalDragOver}
      onDrop={handleGlobalDrop}
    >
      {/* Global drag overlay */}
      {(globalDragOver || globalUploading) && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary/50 rounded-lg">
          <div className="flex flex-col items-center gap-2 text-center">
            {globalUploading ? (
              <>
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm font-medium">Classifying document...</p>
              </>
            ) : (
              <>
                <FolderUp className="w-8 h-8 text-primary" />
                <p className="text-sm font-medium">Drop to upload &amp; auto-categorize</p>
                <p className="text-[11px] text-muted-foreground">File will be classified automatically</p>
              </>
            )}
          </div>
        </div>
      )}
    <ScrollArea className="h-full">
      <div className="p-4 space-y-3">
        {denialProbability && <DenialRiskBanner data={denialProbability} />}
        {LETTER_TYPES.map((letterType) => {
          if (letterType.isPerRecommender) {
            return (
              <RecommenderCard
                key={letterType.key}
                letterType={letterType}
                recommenders={recommenders}
                allRecDocs={getDocsForCategory('RECOMMENDATION_LETTER')}
                getDocsForRecommender={getDocsForRecommender}
                caseId={caseId}
                onOpenDraft={onOpenDraft}
                onAddRecommender={() => setShowAddRecommender(true)}
                onImportCsv={() => setShowCsvImport(true)}
                onUploaded={fetchData}
              />
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
            <DraftableCard
              key={letterType.key}
              letterType={letterType}
              docs={docs}
              caseId={caseId}
              onOpenDraft={onOpenDraft}
              onUploaded={fetchData}
            />
          )
        })}

        {/* Assemble Package */}
        <div className="pt-2 border-t border-border/50">
          <Button
            className="w-full gap-2"
            disabled={assembling || documents.filter((d) => d.status === 'FINAL').length === 0}
            onClick={handleAssemblePackage}
          >
            {assembling ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Package className="w-4 h-4" />
            )}
            {assembling ? 'Assembling...' : 'Assemble Package'}
          </Button>
          {documents.filter((d) => d.status === 'FINAL').length === 0 && (
            <p className="text-[10px] text-muted-foreground text-center mt-1.5">
              Mark documents as FINAL to assemble
            </p>
          )}
        </div>
      </div>
    </ScrollArea>
    </div>

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

    <CategoryPickerDialog
      open={categoryPicker.open}
      onOpenChange={(open) => setCategoryPicker((prev) => ({ ...prev, open }))}
      suggestedCategory={categoryPicker.suggestedCategory}
      documentId={categoryPicker.documentId}
      fileName={categoryPicker.fileName}
      caseId={caseId}
      onCategorized={fetchData}
    />
    </>
    </TooltipProvider>
  )
}
