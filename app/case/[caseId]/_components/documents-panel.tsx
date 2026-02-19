'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useDropzone } from 'react-dropzone'
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
  PenLine,
  FilePlus,
  ScanSearch,
  ShieldCheck,
  PenTool,
  CircleCheck,
} from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { RecommendersPanel } from './recommenders-panel'
import { SignRequestDialog } from './sign-request-dialog'
import { SigningView } from './signing-view'

// Types
interface DocumentItem {
  id: string
  name: string
  type: 'MARKDOWN' | 'DOCX' | 'PDF'
  source: 'SYSTEM_GENERATED' | 'USER_UPLOADED'
  status: 'DRAFT' | 'FINAL'
  category?: string | null
  evidenceVerificationCount?: number
  signatureStatus?: 'PENDING' | 'COMPLETED' | 'DECLINED' | null
  createdAt: string
}

interface DocumentDetail extends DocumentItem {
  content?: string | null
  signedUrl?: string | null
}

interface DocumentsPanelProps {
  caseId: string
  isChatActive?: boolean
  hideChecklists?: boolean
  onOpenDraft?: (doc?: { id?: string; name?: string; content?: string; recommenderId?: string; category?: string }) => void
  onDocumentsRouted?: () => void
}

// Verification progress per-document
interface VerifyProgress {
  status: 'verifying' | 'complete'
  completed: Set<string>
  results: Record<string, { score: number; recommendation: string }>
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

const CATEGORY_LABELS: Record<string, string> = {
  RESUME_CV: 'Resume',
  AWARD_CERTIFICATE: 'Award',
  PUBLICATION: 'Publication',
  MEDIA_COVERAGE: 'Media',
  PATENT: 'Patent',
  RECOMMENDATION_LETTER: 'Rec Letter',
  MEMBERSHIP_CERTIFICATE: 'Membership',
  EMPLOYMENT_VERIFICATION: 'Employment',
  SALARY_DOCUMENTATION: 'Salary',
  CITATION_REPORT: 'Citations',
  JUDGING_EVIDENCE: 'Judging',
  PASSPORT_ID: 'ID',
  I20: 'I-20',
  VISA_STAMP: 'Visa Stamp',
  I797_APPROVAL: 'I-797',
  I94: 'I-94',
  PERSONAL_STATEMENT: 'Personal Statement',
  PETITION_LETTER: 'Petition',
  DEGREE_CERTIFICATE: 'Degree',
  OTHER: 'Other',
}

function CategoryBadge({ category }: { category: string }) {
  const label = CATEGORY_LABELS[category] || category
  return (
    <span className="text-[9px] font-medium tracking-wide px-1.5 py-0.5 rounded border bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20">
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

function SignatureBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    PENDING: {
      label: 'Signing',
      className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    },
    COMPLETED: {
      label: 'Signed',
      className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    },
    DECLINED: {
      label: 'Declined',
      className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    },
  }
  const c = config[status]
  if (!c) return null
  return (
    <span
      className={cn(
        'text-[9px] font-semibold tracking-wide px-1.5 py-0.5 rounded border flex items-center gap-1',
        c.className
      )}
    >
      <PenTool className="w-3 h-3" />
      {c.label}
    </span>
  )
}

const ALL_CRITERIA_LIST = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10']

function DocumentGroupCard({
  group,
  caseId,
  getDocumentStrength,
  verifyingDocs,
  viewDocument,
  handleVerifyAsEvidence,
  onOpenDraft,
  setDeleteTarget,
  onRequestSign,
  onViewSigning,
  onToggleStatus,
}: {
  group: DocumentGroup
  caseId: string
  getDocumentStrength: (name: string) => StrengthLevel | null
  verifyingDocs: Map<string, { status: string; completed: Set<string>; results: Record<string, { score: number; recommendation: string }> }>
  viewDocument: (id: string) => void
  handleVerifyAsEvidence: (id: string) => void
  onOpenDraft?: (doc?: { id?: string; name?: string; content?: string; recommenderId?: string; category?: string }) => void
  setDeleteTarget: (doc: DocumentItem | null) => void
  onRequestSign?: (doc: DocumentItem) => void
  onViewSigning?: (doc: DocumentItem) => void
  onToggleStatus?: (doc: DocumentItem) => void
}) {
  const strength = getDocumentStrength(group.latestDoc.name)
  const docId = group.latestDoc.id
  const isVerified = (group.latestDoc.evidenceVerificationCount ?? 0) > 0
  const verifyProgress = verifyingDocs.get(docId)
  const canVerify = group.latestDoc.source === 'USER_UPLOADED' && !isVerified && !verifyProgress

  return (
    <div className="group rounded-xl border border-border/50 bg-card/50 hover:bg-card hover:border-border transition-all duration-200">
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
            {group.latestDoc.category && <CategoryBadge category={group.latestDoc.category} />}
            {isVerified && !verifyProgress && (
              <span className="text-[9px] font-semibold tracking-wide px-1.5 py-0.5 rounded border bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Verified
              </span>
            )}
            {group.latestDoc.signatureStatus && (
              <SignatureBadge status={group.latestDoc.signatureStatus} />
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <TypeBadge type={group.latestDoc.type} />
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(group.latestDoc.createdAt)}
            </span>
          </div>
        </div>

        {onToggleStatus && (
          <Button
            variant={group.latestDoc.status === 'FINAL' ? 'outline' : 'ghost'}
            size="sm"
            className={cn(
              'h-8 px-2 text-xs gap-1 transition-all',
              group.latestDoc.status === 'FINAL'
                ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'text-muted-foreground opacity-0 group-hover:opacity-100'
            )}
            onClick={(e) => {
              e.stopPropagation()
              onToggleStatus(group.latestDoc)
            }}
            title={group.latestDoc.status === 'DRAFT' ? 'Mark as Final' : 'Revert to Draft'}
          >
            {group.latestDoc.status === 'DRAFT' ? (
              <><CircleCheck className="w-3.5 h-3.5" /><span className="hidden sm:inline">Mark Final</span></>
            ) : (
              <><CheckCircle2 className="w-3.5 h-3.5" /> Final</>
            )}
          </Button>
        )}

        {canVerify && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs gap-1 text-muted-foreground hover:text-teal-600 dark:hover:text-teal-400 opacity-0 group-hover:opacity-100 transition-all"
            onClick={(e) => {
              e.stopPropagation()
              handleVerifyAsEvidence(docId)
            }}
            title="Verify as evidence"
          >
            <ScanSearch className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Verify</span>
          </Button>
        )}

        {onOpenDraft && group.latestDoc.type === 'MARKDOWN' && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation()
              fetch(`/api/case/${caseId}/documents/${group.latestDoc.id}`)
                .then((res) => res.json())
                .then((data) => {
                  onOpenDraft({
                    id: data.id,
                    name: data.name,
                    content: data.content,
                    category: data.category,
                  })
                })
                .catch(console.error)
            }}
            title="Draft with AI"
          >
            <PenLine className="w-3.5 h-3.5" />
          </Button>
        )}

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
            {onToggleStatus && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault()
                    onToggleStatus(group.latestDoc)
                  }}
                  className="gap-2"
                >
                  {group.latestDoc.status === 'DRAFT' ? (
                    <>
                      <CircleCheck className="w-3.5 h-3.5" />
                      Mark as Final
                    </>
                  ) : (
                    <>
                      <Circle className="w-3.5 h-3.5" />
                      Revert to Draft
                    </>
                  )}
                </DropdownMenuItem>
              </>
            )}
            {group.latestDoc.status === 'FINAL' &&
              !group.latestDoc.signatureStatus &&
              onRequestSign && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault()
                      onRequestSign(group.latestDoc)
                    }}
                    className="gap-2"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    Request Signature
                  </DropdownMenuItem>
                </>
              )}
            {group.latestDoc.signatureStatus && onViewSigning && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault()
                  onViewSigning(group.latestDoc)
                }}
                className="gap-2"
              >
                <PenTool className="w-3.5 h-3.5" />
                View Signatures
              </DropdownMenuItem>
            )}
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

      {verifyProgress && (
        <div className="px-3 pb-2.5 pt-0">
          <div className="flex items-center gap-2">
            {verifyProgress.status === 'verifying' && (
              <Loader2 className="w-3 h-3 text-teal-500 animate-spin shrink-0" />
            )}
            {verifyProgress.status === 'complete' && (
              <ShieldCheck className="w-3 h-3 text-teal-500 shrink-0" />
            )}
            <div className="flex items-center gap-1 flex-1">
              {ALL_CRITERIA_LIST.map((c) => {
                const done = verifyProgress.completed.has(c)
                const result = verifyProgress.results[c]
                const isPass = result && result.score >= 5.0
                return (
                  <div
                    key={c}
                    className={cn(
                      'flex-1 h-1.5 rounded-full transition-all duration-300',
                      done
                        ? isPass
                          ? 'bg-teal-500'
                          : 'bg-stone-300 dark:bg-stone-600'
                        : verifyProgress.status === 'verifying'
                          ? 'bg-muted animate-pulse'
                          : 'bg-muted'
                    )}
                    title={done ? `${c}: ${result?.score.toFixed(1)} - ${result?.recommendation}` : c}
                  />
                )
              })}
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
              {verifyProgress.status === 'complete'
                ? 'Verified'
                : `${verifyProgress.completed.size}/10`}
            </span>
          </div>
        </div>
      )}
    </div>
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

export function DocumentsPanel({ caseId, isChatActive, hideChecklists, onOpenDraft, onDocumentsRouted }: DocumentsPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('documents')
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [selectedDoc, setSelectedDoc] = useState<DocumentDetail | null>(null)
  const [isLoadingList, setIsLoadingList] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [isUploadingResume, setIsUploadingResume] = useState(false)
  const resumeInputRef = useRef<HTMLInputElement>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [isStreaming, setIsStreaming] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DocumentItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Signing state
  const [signTarget, setSignTarget] = useState<DocumentItem | null>(null)
  const [signingViewDoc, setSigningViewDoc] = useState<DocumentItem | null>(null)

  const handleToggleStatus = useCallback(async (doc: DocumentItem) => {
    const newStatus = doc.status === 'DRAFT' ? 'FINAL' : 'DRAFT'
    try {
      const res = await fetch(`/api/case/${caseId}/documents/${doc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        setDocuments((prev) =>
          prev.map((d) => (d.id === doc.id ? { ...d, status: newStatus } : d))
        )
      }
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  }, [caseId])

  // Evidence verification state
  const [verifyingDocs, setVerifyingDocs] = useState<Map<string, VerifyProgress>>(new Map())
  const handleVerifyAsEvidence = useCallback(async (docId: string) => {
    if (verifyingDocs.has(docId)) return

    setVerifyingDocs((prev) => {
      const next = new Map(prev)
      next.set(docId, { status: 'verifying', completed: new Set(), results: {} })
      return next
    })

    try {
      const res = await fetch(`/api/case/${caseId}/evidence-verify/${docId}`, { method: 'POST' })
      if (!res.ok) throw new Error('Verification failed')

      const reader = res.body?.getReader()
      if (!reader) return

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))

            if (event.type === 'criterion_complete') {
              const criterion = event.criterion as string
              const result = event.result as { score: number; recommendation: string }
              setVerifyingDocs((prev) => {
                const next = new Map(prev)
                const entry = next.get(docId)
                if (entry) {
                  const completed = new Set(entry.completed)
                  completed.add(criterion)
                  next.set(docId, {
                    ...entry,
                    completed,
                    results: { ...entry.results, [criterion]: result },
                  })
                }
                return next
              })
            }

            if (event.type === 'doc_complete') {
              setVerifyingDocs((prev) => {
                const next = new Map(prev)
                const entry = next.get(docId)
                if (entry) next.set(docId, { ...entry, status: 'complete' })
                return next
              })
              // Mark doc as verified in local state
              setDocuments((prev) =>
                prev.map((d) => d.id === docId ? { ...d, evidenceVerificationCount: 10 } : d)
              )
              onDocumentsRouted?.()
              // Clear progress after a brief delay
              setTimeout(() => {
                setVerifyingDocs((prev) => {
                  const next = new Map(prev)
                  next.delete(docId)
                  return next
                })
              }, 2000)
            }
          } catch {
            // partial JSON
          }
        }
      }
    } catch (err) {
      console.error('Verify as evidence error:', err)
      setVerifyingDocs((prev) => {
        const next = new Map(prev)
        next.delete(docId)
        return next
      })
    }
  }, [caseId, verifyingDocs, onDocumentsRouted])

  // Upload modal + dropzone state
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [uploadContext, setUploadContext] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setIsDragOver(false)
    if (acceptedFiles.length === 0) return
    setPendingFile(acceptedFiles[0])
    setUploadContext('')
  }, [])

  const { getRootProps, getInputProps: getDropzoneInputProps } = useDropzone({
    onDrop,
    onDragEnter: () => setIsDragOver(true),
    onDragLeave: () => setIsDragOver(false),
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md', '.markdown'],
    },
    maxFiles: 1,
    noClick: true,
    noKeyboard: true,
  })

  // Checklist state
  const [checklist, setChecklist] = useState<DocumentChecklist | null>(null)
  const [isLoadingChecklist, setIsLoadingChecklist] = useState(true)
  const [isVerifying, setIsVerifying] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const knownDocIdsRef = useRef<Set<string>>(new Set())

  const documentGroups = useMemo(() => groupDocuments(documents), [documents])
  const collectedGroups = useMemo(() => documentGroups.filter((g) => g.latestDoc.source === 'USER_UPLOADED'), [documentGroups])
  const draftedGroups = useMemo(() => documentGroups.filter((g) => g.latestDoc.source === 'SYSTEM_GENERATED'), [documentGroups])

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

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setPendingFile(file)
    setUploadContext('')
  }

  async function confirmUpload() {
    if (!pendingFile) return

    const file = pendingFile
    const context = uploadContext.trim()
    setPendingFile(null)
    setUploadContext('')
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      if (context) formData.append('context', context)

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

  async function handleResumeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setIsUploadingResume(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('category', 'RESUME_CV')

      const res = await fetch(`/api/case/${caseId}/documents`, {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        await fetchDocuments()
        fetchChecklist()
      }
    } catch (err) {
      console.error('Resume upload failed:', err)
    } finally {
      setIsUploadingResume(false)
    }
  }

  const resumeDoc = documents.find((d) => d.category === 'RESUME_CV')

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

  // Signing view
  if (signingViewDoc) {
    return (
      <SigningView
        caseId={caseId}
        docId={signingViewDoc.id}
        docName={signingViewDoc.name}
        onClose={() => {
          setSigningViewDoc(null)
          fetchDocuments()
        }}
      />
    )
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
            <Button
              variant={selectedDoc.status === 'FINAL' ? 'outline' : 'ghost'}
              size="sm"
              className={cn(
                'h-7 text-[11px] gap-1',
                selectedDoc.status === 'FINAL'
                  ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : 'text-muted-foreground'
              )}
              onClick={async () => {
                const newStatus = selectedDoc.status === 'DRAFT' ? 'FINAL' : 'DRAFT'
                try {
                  const res = await fetch(`/api/case/${caseId}/documents/${selectedDoc.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: newStatus }),
                  })
                  if (res.ok) {
                    setSelectedDoc({ ...selectedDoc, status: newStatus })
                    setDocuments((prev) =>
                      prev.map((d) => (d.id === selectedDoc.id ? { ...d, status: newStatus } : d))
                    )
                  }
                } catch (err) {
                  console.error('Failed to update status:', err)
                }
              }}
            >
              {selectedDoc.status === 'DRAFT' ? (
                <><CircleCheck className="w-3.5 h-3.5" /> Mark Final</>
              ) : (
                <><CheckCircle2 className="w-3.5 h-3.5" /> Final</>
              )}
            </Button>
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
  if (!hideChecklists && activeTab === 'recommenders') {
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
      <div {...getRootProps()} className="h-full flex flex-col p-4 overflow-hidden relative">
        <input {...getDropzoneInputProps()} />

        {isDragOver && (
          <div className="absolute inset-0 z-50 bg-foreground/60 backdrop-blur-sm flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-background">
              <div className="w-16 h-16 rounded-2xl bg-background/20 flex items-center justify-center">
                <Upload className="w-8 h-8" />
              </div>
              <p className="text-lg font-medium">Drop file to upload</p>
              <p className="text-sm text-white/70">PDF, DOCX, TXT, or Markdown</p>
            </div>
          </div>
        )}
        {/* Tab selector -- hide when in documents-only mode */}
        {!hideChecklists && (
          <div className="shrink-0 mb-4">
            <PanelTabs activeTab={activeTab} onTabChange={setActiveTab} />
          </div>
        )}

        {/* Checklist section -- hide when in documents-only mode */}
        {!hideChecklists && (
          <DocumentChecklist
            caseId={caseId}
            checklist={checklist}
            isLoading={isLoadingChecklist}
            isVerifying={isVerifying}
            onVerify={verifyDocuments}
            onViewDocument={viewDocument}
          />
        )}

        {/* Resume status */}
        <div className="shrink-0 mb-4 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">
                  {resumeDoc ? resumeDoc.name : 'No resume uploaded'}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {resumeDoc ? 'Resume on file' : 'Upload your resume or CV'}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] gap-1 shrink-0"
              disabled={isUploadingResume}
              onClick={() => resumeInputRef.current?.click()}
            >
              <Upload className="w-3 h-3" />
              {isUploadingResume ? 'Uploading...' : resumeDoc ? 'Replace' : 'Upload'}
            </Button>
          </div>
          <input
            ref={resumeInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.docx,.txt,.md,.markdown"
            onChange={handleResumeUpload}
          />
        </div>

        {/* Actions */}
        <div className="shrink-0 mb-4 flex items-center justify-end gap-1.5">
          {onOpenDraft && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => onOpenDraft()}
            >
              <FilePlus className="w-3.5 h-3.5" />
              New Document
            </Button>
          )}
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
            <div className="space-y-6">
              {/* Collected Evidence */}
              {collectedGroups.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Collected Evidence</h3>
                    <span className="text-[10px] text-muted-foreground">{collectedGroups.length}</span>
                  </div>
                  <div className="space-y-2">
                    {collectedGroups.map((group) => (
                      <DocumentGroupCard
                        key={group.baseName}
                        group={group}
                        caseId={caseId}
                        getDocumentStrength={getDocumentStrength}
                        verifyingDocs={verifyingDocs}
                        viewDocument={viewDocument}
                        handleVerifyAsEvidence={handleVerifyAsEvidence}
                        onOpenDraft={onOpenDraft}
                        setDeleteTarget={setDeleteTarget}
                        onRequestSign={(doc) => setSignTarget(doc)}
                        onViewSigning={(doc) => setSigningViewDoc(doc)}
                        onToggleStatus={handleToggleStatus}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Drafted Documents */}
              {draftedGroups.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Drafted Documents</h3>
                    <span className="text-[10px] text-muted-foreground">{draftedGroups.length}</span>
                  </div>
                  <div className="space-y-2">
                    {draftedGroups.map((group) => (
                      <DocumentGroupCard
                        key={group.baseName}
                        group={group}
                        caseId={caseId}
                        getDocumentStrength={getDocumentStrength}
                        verifyingDocs={verifyingDocs}
                        viewDocument={viewDocument}
                        handleVerifyAsEvidence={handleVerifyAsEvidence}
                        onOpenDraft={onOpenDraft}
                        setDeleteTarget={setDeleteTarget}
                        onRequestSign={(doc) => setSignTarget(doc)}
                        onViewSigning={(doc) => setSigningViewDoc(doc)}
                        onToggleStatus={handleToggleStatus}
                      />
                    ))}
                  </div>
                </div>
              )}
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

      {/* Upload context modal */}
      <Dialog open={!!pendingFile} onOpenChange={(open) => { if (!open) { setPendingFile(null); setUploadContext('') } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload {pendingFile?.name}</DialogTitle>
            <DialogDescription>
              Add optional context to help the AI understand this document.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="e.g. This is my citation report from Google Scholar, covering publications from 2019-2024..."
            value={uploadContext}
            onChange={(e) => setUploadContext(e.target.value)}
            rows={4}
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setPendingFile(null); setUploadContext('') }}>
              Cancel
            </Button>
            <Button onClick={confirmUpload}>
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sign request dialog */}
      <SignRequestDialog
        open={!!signTarget}
        onOpenChange={(open) => { if (!open) setSignTarget(null) }}
        caseId={caseId}
        docId={signTarget?.id || ''}
        docName={signTarget?.name || ''}
        onSuccess={() => {
          setSignTarget(null)
          fetchDocuments()
        }}
      />
    </>
  )
}
