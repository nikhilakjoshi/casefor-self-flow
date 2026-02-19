'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogTitle,
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
  Share2,
  MapPin,
  Check,
  AlertTriangle,
  ArrowRight,
  X,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CRITERIA_LABELS } from '@/lib/evidence-verification-schema'
import type { SurveyIntent } from '@/app/onboard/_lib/survey-schema'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { useSession } from 'next-auth/react'
import { RecommenderForm } from './recommender-form'
import { SignRequestDialog } from './sign-request-dialog'
import { SigningView } from './signing-view'
import type { RecommenderData } from './recommender-form'
import { CsvImportModal } from './csv-import-modal'
import type { DenialProbability } from '@/lib/denial-probability-schema'
import { ShareDialog } from './share-dialog'

export interface DocumentItem {
  id: string
  name: string
  type: string
  source: string
  status: 'DRAFT' | 'FINAL'
  category?: string | null
  recommenderId?: string | null
  createdAt: string
}

export interface Recommender {
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
  initialIntentData?: SurveyIntent
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

export const LETTER_TYPES: LetterType[] = [
  {
    key: 'executive_resume',
    title: 'Executive Resume',
    description: 'AI-drafted resume tailored for your EB-1A petition',
    category: 'EXECUTIVE_RESUME',
    icon: FileText,
    gradient: 'from-indigo-500/15 to-violet-500/15',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
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

export function formatDate(dateStr: string): string {
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

export function StatusDot({ status }: { status: string }) {
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

export function DraftRow({
  doc,
  caseId,
  onOpenDraft,
  onShare,
}: {
  doc: DocumentItem
  caseId: string
  onOpenDraft: LettersPanelProps['onOpenDraft']
  onShare?: (docId: string, docName: string) => void
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
      {onShare && (
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onShare(doc.id, doc.name) }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onShare(doc.id, doc.name) } }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted shrink-0 cursor-pointer"
          title="Share"
        >
          <Share2 className="w-3 h-3 text-muted-foreground" />
        </div>
      )}
    </button>
  )
}

export const RELATIONSHIP_LABELS: Record<string, string> = {
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
  onSignNow,
  onRequestSign,
}: {
  letterType: LetterType
  docs: DocumentItem[]
  caseId: string
  onUploaded: () => void
  onSignNow?: (docId: string, docName: string) => void
  onRequestSign?: (docId: string, docName: string) => void
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
          {(() => {
            const finalDocs = docs.filter((d) => d.status === 'FINAL')
            if (finalDocs.length === 0) return null
            return (
              <>
                {onSignNow && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] gap-1"
                    onClick={(e) => { e.stopPropagation(); onSignNow(finalDocs[0].id, finalDocs[0].name) }}
                  >
                    <PenTool className="w-3 h-3" />
                    Sign Now
                  </Button>
                )}
                {onRequestSign && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] gap-1"
                    onClick={(e) => { e.stopPropagation(); onRequestSign(finalDocs[0].id, finalDocs[0].name) }}
                  >
                    <PenTool className="w-3 h-3" />
                    E-Sign
                  </Button>
                )}
              </>
            )
          })()}
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

export function RecommenderCard({
  letterType,
  recommenders,
  allRecDocs,
  getDocsForRecommender,
  caseId,
  onOpenDraft,
  onAddRecommender,
  onImportCsv,
  onUploaded,
  onShare,
  onSignNow,
  onRequestSign,
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
  onShare?: (docId: string, docName: string) => void
  onSignNow?: (docId: string, docName: string) => void
  onRequestSign?: (docId: string, docName: string) => void
}) {
  const Icon = letterType.icon
  const hasContent = recommenders.length > 0 || allRecDocs.length > 0
  const [expanded, setExpanded] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Per-recommender enrichment state
  const [dragOverRecId, setDragOverRecId] = useState<string | null>(null)
  const [enrichingRecId, setEnrichingRecId] = useState<string | null>(null)
  const [pendingEnrichment, setPendingEnrichment] = useState<{
    recommenderId: string
    recName: string
    merged: Record<string, string>
    fieldTypes: Record<string, 'new' | 'append'>
  } | null>(null)
  const [isSavingEnrichment, setIsSavingEnrichment] = useState(false)

  const SIMPLE_FIELDS = ['name', 'title', 'organization', 'email', 'phone', 'linkedIn', 'countryRegion'] as const
  const RICH_FIELDS = ['bio', 'credentials'] as const
  const FIELD_LABELS: Record<string, string> = {
    name: 'Name', title: 'Title', organization: 'Organization', email: 'Email',
    phone: 'Phone', linkedIn: 'LinkedIn', countryRegion: 'Region', bio: 'Bio', credentials: 'Credentials',
  }

  const handleEnrichDrop = useCallback(async (recommenderId: string, files: File[]) => {
    setEnrichingRecId(recommenderId)
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
        setPendingEnrichment({ recommenderId, recName, merged: allMerged, fieldTypes: allFieldTypes })
      } else {
        toast('No new fields found to update')
      }
    } catch (err) {
      console.error('Enrichment failed:', err)
      toast.error('Extraction failed')
    } finally {
      setEnrichingRecId(null)
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
        onUploaded()
      } else {
        toast.error('Failed to save changes')
      }
    } catch {
      toast.error('Failed to save changes')
    } finally {
      setIsSavingEnrichment(false)
      setPendingEnrichment(null)
    }
  }, [caseId, pendingEnrichment, onUploaded])

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
          {(() => {
            const finalRecDocs = allRecDocs.filter((d) => d.status === 'FINAL')
            if (finalRecDocs.length === 0) return null
            return (
              <>
                {onSignNow && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] gap-1"
                    onClick={(e) => { e.stopPropagation(); onSignNow(finalRecDocs[0].id, finalRecDocs[0].name) }}
                  >
                    <PenTool className="w-3 h-3" />
                    Sign Now
                  </Button>
                )}
                {onRequestSign && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] gap-1"
                    onClick={(e) => { e.stopPropagation(); onRequestSign(finalRecDocs[0].id, finalRecDocs[0].name) }}
                  >
                    <PenTool className="w-3 h-3" />
                    E-Sign
                  </Button>
                )}
              </>
            )
          })()}
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
                      const isPending = pendingEnrichment?.recommenderId === rec.id
                      const isEnriching = enrichingRecId === rec.id
                      const isDragOverRec = dragOverRecId === rec.id
                      return (
                        <div
                          key={rec.id}
                          className={cn(
                            'group/rec relative rounded-lg border overflow-hidden bg-background/50 transition-all duration-200',
                            isDragOverRec
                              ? 'border-primary ring-2 ring-primary/20 bg-primary/[0.03]'
                              : isPending
                                ? 'border-primary/40'
                                : 'border-border/40'
                          )}
                          onDragOver={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (!isEnriching && !isPending) setDragOverRecId(rec.id)
                          }}
                          onDragLeave={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                              setDragOverRecId(null)
                            }
                          }}
                          onDrop={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setDragOverRecId(null)
                            const files = Array.from(e.dataTransfer.files)
                            if (files.length > 0 && !enrichingRecId && !isPending) {
                              handleEnrichDrop(rec.id, files)
                            }
                          }}
                        >
                          {/* Drag overlay */}
                          {isDragOverRec && !isEnriching && (
                            <div className="absolute inset-0 z-10 bg-primary/10 backdrop-blur-[1px] flex items-center justify-center pointer-events-none rounded-lg">
                              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/15 border border-primary/25">
                                <Upload className="w-3.5 h-3.5 text-primary" />
                                <span className="text-xs font-medium text-primary">Drop to enrich profile</span>
                              </div>
                            </div>
                          )}

                          {/* Extracting overlay */}
                          {isEnriching && (
                            <div className="absolute inset-0 z-10 bg-background/60 backdrop-blur-[2px] flex items-center justify-center rounded-lg">
                              <div className="flex items-center gap-2">
                                <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                <span className="text-xs text-muted-foreground">Extracting...</span>
                              </div>
                            </div>
                          )}

                          <div className="relative p-3">
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
                              {!isPending && (
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
                              )}
                            </div>

                            {recDocs.length > 0 && !isPending && (
                              <div className="mt-2 space-y-1">
                                {recDocs.map((doc) => (
                                  <DraftRow
                                    key={doc.id}
                                    doc={doc}
                                    caseId={caseId}
                                    onOpenDraft={onOpenDraft}
                                    onShare={onShare}
                                  />
                                ))}
                              </div>
                            )}

                            {/* Drop hint */}
                            {!isPending && !isEnriching && (
                              <div className="mt-1.5 opacity-0 group-hover/rec:opacity-100 transition-opacity">
                                <p className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                                  <Upload className="w-2.5 h-2.5" />
                                  Drop CV or bio to enrich profile
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Enrichment preview */}
                          {isPending && pendingEnrichment && (
                            <div className="border-t border-primary/20">
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
                              <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/30 border-t border-border/50">
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  className="flex-1 text-muted-foreground"
                                  onClick={() => setPendingEnrichment(null)}
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
  onShare,
  onSignNow,
  onRequestSign,
}: {
  letterType: LetterType
  docs: DocumentItem[]
  caseId: string
  onOpenDraft: LettersPanelProps['onOpenDraft']
  onUploaded: () => void
  onShare?: (docId: string, docName: string) => void
  onSignNow?: (docId: string, docName: string) => void
  onRequestSign?: (docId: string, docName: string) => void
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
          {(() => {
            const finalDocs = docs.filter((d) => d.status === 'FINAL')
            if (finalDocs.length === 0) return null
            return (
              <>
                {onSignNow && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] gap-1"
                    onClick={(e) => { e.stopPropagation(); onSignNow(finalDocs[0].id, finalDocs[0].name) }}
                  >
                    <PenTool className="w-3 h-3" />
                    Sign Now
                  </Button>
                )}
                {onRequestSign && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] gap-1"
                    onClick={(e) => { e.stopPropagation(); onRequestSign(finalDocs[0].id, finalDocs[0].name) }}
                  >
                    <PenTool className="w-3 h-3" />
                    E-Sign
                  </Button>
                )}
              </>
            )
          })()}
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
              onShare={onShare}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const CATEGORY_LABELS: Record<string, string> = {
  RESUME_CV: 'Resume / CV',
  EXECUTIVE_RESUME: 'Executive Resume',
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
  I20: 'I-20',
  VISA_STAMP: 'Visa Stamps',
  I797_APPROVAL: 'I-797 Approval',
  I94: 'I-94',
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
        <DialogTitle className="sr-only">Categorize Document</DialogTitle>
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

function UsIntentCard({ caseId, initialData }: { caseId: string; initialData?: SurveyIntent }) {
  const [data, setData] = useState<SurveyIntent>(initialData ?? {})
  const [expanded, setExpanded] = useState(() => {
    // Open if empty (no meaningful fields filled)
    const d = initialData ?? {}
    return !d.usBenefit && !d.moveTimeline && !d.hasJobOffer && !d.hasBusinessPlan
  })
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isComplete = !!(data.usBenefit || data.moveTimeline || data.hasJobOffer || data.hasBusinessPlan)

  const save = useCallback(async (updated: SurveyIntent) => {
    setSaving(true)
    try {
      const payload = { ...updated, continueInField: true }
      await fetch(`/api/case/${caseId}/survey`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { intent: payload } }),
      })
      // Trigger reanalysis
      fetch(`/api/case/${caseId}/analyze`, { method: 'POST' }).catch(() => {})
    } catch (err) {
      console.error('Failed to save intent:', err)
    } finally {
      setSaving(false)
    }
  }, [caseId])

  const handleChange = useCallback((updates: Partial<SurveyIntent>) => {
    setData((prev) => {
      const next = { ...prev, ...updates }
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => save(next), 800)
      return next
    })
  }, [save])

  return (
    <div
      className={cn(
        'rounded-xl border overflow-hidden transition-colors',
        isComplete ? 'border-border/50 bg-card/50' : 'border-amber-500/50 bg-amber-500/5'
      )}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-gradient-to-br from-sky-500/15 to-blue-500/15">
          <MapPin className="w-4 h-4 text-sky-600 dark:text-sky-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold">U.S. Intent</h3>
          <p className="text-[11px] text-muted-foreground">
            Your plans to work in the United States
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isComplete ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <Check className="w-3 h-3" />
              Completed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <AlertTriangle className="w-3 h-3" />
              Incomplete
            </span>
          )}
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          <ChevronDown
            className={cn(
              'w-4 h-4 text-muted-foreground transition-transform',
              expanded && 'rotate-180'
            )}
          />
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/30 pt-3">
          <div className="flex items-start gap-3">
            <Checkbox
              id="intent-hasJobOffer"
              checked={data.hasJobOffer ?? false}
              onCheckedChange={(checked) => handleChange({ hasJobOffer: checked === true })}
              className="mt-0.5"
            />
            <label htmlFor="intent-hasJobOffer" className="text-sm">
              I have a job offer or contract in the U.S.
            </label>
          </div>

          {data.hasJobOffer && (
            <div className="ml-6">
              <label className="text-sm font-medium">Job Offer Details</label>
              <Textarea
                placeholder="Describe your job offer or contract..."
                value={data.jobOfferDetails ?? ''}
                onChange={(e) => handleChange({ jobOfferDetails: e.target.value })}
                className="mt-1.5 min-h-[60px]"
              />
            </div>
          )}

          <div className="flex items-start gap-3">
            <Checkbox
              id="intent-hasBusinessPlan"
              checked={data.hasBusinessPlan ?? false}
              onCheckedChange={(checked) => handleChange({ hasBusinessPlan: checked === true })}
              className="mt-0.5"
            />
            <label htmlFor="intent-hasBusinessPlan" className="text-sm">
              I have a business plan (if entrepreneur)
            </label>
          </div>

          {data.hasBusinessPlan && (
            <div className="ml-6">
              <label className="text-sm font-medium">Business Plan Details</label>
              <Textarea
                placeholder="Describe your business plan..."
                value={data.businessPlanDetails ?? ''}
                onChange={(e) => handleChange({ businessPlanDetails: e.target.value })}
                className="mt-1.5 min-h-[60px]"
              />
            </div>
          )}

          <div>
            <label className="text-sm font-medium">
              How will your work benefit the U.S.?
            </label>
            <Textarea
              placeholder="Describe the national benefit of your work..."
              value={data.usBenefit ?? ''}
              onChange={(e) => handleChange({ usBenefit: e.target.value })}
              className="mt-1.5 min-h-[80px]"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Timeline for Move</label>
            <Input
              placeholder="e.g., Within 6 months, Next year"
              value={data.moveTimeline ?? ''}
              onChange={(e) => handleChange({ moveTimeline: e.target.value })}
              className="mt-1.5"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export function LettersPanel({ caseId, onOpenDraft, denialProbability, initialIntentData }: LettersPanelProps) {
  const { data: session } = useSession()
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [recommenders, setRecommenders] = useState<Recommender[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddRecommender, setShowAddRecommender] = useState(false)
  const [showCsvImport, setShowCsvImport] = useState(false)
  const [assembling, setAssembling] = useState(false)
  // Signing state
  const [signTarget, setSignTarget] = useState<{ docId: string; docName: string } | null>(null)
  const [signingViewTarget, setSigningViewTarget] = useState<{ docId: string; docName: string } | null>(null)
  const [globalDragOver, setGlobalDragOver] = useState(false)
  const [globalUploading, setGlobalUploading] = useState(false)
  const [categoryPicker, setCategoryPicker] = useState<{
    open: boolean
    documentId: string
    fileName: string
    suggestedCategory: string | null
  }>({ open: false, documentId: '', fileName: '', suggestedCategory: null })
  const [shareTarget, setShareTarget] = useState<{ docId: string; docName: string } | null>(null)
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

  const handleSignNow = useCallback(async (docId: string, docName: string) => {
    try {
      const res = await fetch(`/api/case/${caseId}/documents/${docId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selfSign: true }),
      })
      if (res.ok) {
        setSigningViewTarget({ docId, docName })
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Failed to create self-sign request')
      }
    } catch {
      toast.error('Failed to create self-sign request')
    }
  }, [caseId])

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
        <UsIntentCard caseId={caseId} initialData={initialIntentData} />
        {LETTER_TYPES.filter((lt) => !lt.isPerRecommender).map((letterType) => {
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
                onShare={(docId, docName) => setShareTarget({ docId, docName })}
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
                onSignNow={handleSignNow}
                onRequestSign={(docId, docName) => setSignTarget({ docId, docName })}
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
              onShare={(docId, docName) => setShareTarget({ docId, docName })}
              onSignNow={handleSignNow}
              onRequestSign={(docId, docName) => setSignTarget({ docId, docName })}
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
        <DialogTitle className="sr-only">Add Recommender</DialogTitle>
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

    {shareTarget && (
      <ShareDialog
        open={!!shareTarget}
        onOpenChange={(open) => { if (!open) setShareTarget(null) }}
        caseId={caseId}
        docId={shareTarget.docId}
        docName={shareTarget.docName}
      />
    )}

    {signTarget && (
      <SignRequestDialog
        open={!!signTarget}
        onOpenChange={(open) => { if (!open) setSignTarget(null) }}
        caseId={caseId}
        docId={signTarget.docId}
        docName={signTarget.docName}
        currentUserEmail={session?.user?.email ?? undefined}
        currentUserName={session?.user?.name ?? undefined}
        onSuccess={() => {
          const target = signTarget
          setSignTarget(null)
          if (target) setSigningViewTarget(target)
          fetchData()
        }}
      />
    )}

    {signingViewTarget && (
      <Dialog open={!!signingViewTarget} onOpenChange={(open) => { if (!open) { setSigningViewTarget(null); fetchData() } }}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] p-0 overflow-hidden">
          <DialogTitle className="sr-only">Sign Document</DialogTitle>
          <SigningView
            caseId={caseId}
            docId={signingViewTarget.docId}
            docName={signingViewTarget.docName}
            currentUserEmail={session?.user?.email ?? undefined}
            onClose={() => { setSigningViewTarget(null); fetchData() }}
            onSignComplete={fetchData}
          />
        </DialogContent>
      </Dialog>
    )}
    </>
    </TooltipProvider>
  )
}
