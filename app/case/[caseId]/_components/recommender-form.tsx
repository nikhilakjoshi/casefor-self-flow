'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ChevronDown,
  User,
  Briefcase,
  Link2,
  Loader2,
  X,
  Upload,
  Globe,
  Sparkles,
} from 'lucide-react'
import { CRITERIA_LABELS } from '@/lib/evidence-verification-schema'

// Relationship type options matching Prisma enum
const RELATIONSHIP_TYPES = [
  { value: 'ACADEMIC_ADVISOR', label: 'Academic Advisor' },
  { value: 'RESEARCH_COLLABORATOR', label: 'Research Collaborator' },
  { value: 'INDUSTRY_COLLEAGUE', label: 'Industry Colleague' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'MENTEE', label: 'Mentee' },
  { value: 'CLIENT', label: 'Client' },
  { value: 'PEER_EXPERT', label: 'Peer Expert' },
  { value: 'OTHER', label: 'Other' },
] as const

type RelationshipType = typeof RELATIONSHIP_TYPES[number]['value']

export interface RecommenderData {
  id?: string
  name: string
  title: string
  relationshipType: RelationshipType
  relationshipContext: string
  email?: string | null
  phone?: string | null
  linkedIn?: string | null
  countryRegion?: string | null
  organization?: string | null
  bio?: string | null
  credentials?: string | null
  startDate?: string | null
  endDate?: string | null
  durationYears?: number | null
  contextNotes?: Record<string, unknown> | null
  criteriaKeys?: string[]
}

interface RecommenderFormProps {
  caseId: string
  recommender?: RecommenderData
  onSave: (recommender: RecommenderData) => void
  onCancel: () => void
}

function FormSection({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  title: string
  icon: React.ElementType
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors group">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium flex-1 text-left">{title}</span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-muted-foreground transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 pt-2 pb-4 space-y-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function FormField({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

export function RecommenderForm({
  caseId,
  recommender,
  onSave,
  onCancel,
}: RecommenderFormProps) {
  const isEdit = !!recommender?.id

  // Form state
  const [name, setName] = useState(recommender?.name ?? '')
  const [title, setTitle] = useState(recommender?.title ?? '')
  const [relationshipType, setRelationshipType] = useState<RelationshipType>(
    recommender?.relationshipType ?? 'ACADEMIC_ADVISOR'
  )
  const [relationshipContext, setRelationshipContext] = useState(
    recommender?.relationshipContext ?? ''
  )
  const [email, setEmail] = useState(recommender?.email ?? '')
  const [phone, setPhone] = useState(recommender?.phone ?? '')
  const [linkedIn, setLinkedIn] = useState(recommender?.linkedIn ?? '')
  const [countryRegion, setCountryRegion] = useState(
    recommender?.countryRegion ?? ''
  )
  const [organization, setOrganization] = useState(
    recommender?.organization ?? ''
  )
  const [bio, setBio] = useState(recommender?.bio ?? '')
  const [credentials, setCredentials] = useState(recommender?.credentials ?? '')
  const [startDate, setStartDate] = useState(
    recommender?.startDate?.slice(0, 10) ?? ''
  )
  const [endDate, setEndDate] = useState(
    recommender?.endDate?.slice(0, 10) ?? ''
  )
  const [durationYears, setDurationYears] = useState(
    recommender?.durationYears?.toString() ?? ''
  )

  const [contextNotes, setContextNotes] = useState<Record<string, unknown> | null>(
    recommender?.contextNotes ?? null
  )
  const [criteriaKeys, setCriteriaKeys] = useState<string[]>(
    recommender?.criteriaKeys ?? []
  )
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [extractUrl, setExtractUrl] = useState('')

  const applyExtracted = useCallback(
    (data: Record<string, string | null>) => {
      if (data.name && !name) setName(data.name)
      if (data.title && !title) setTitle(data.title)
      if (data.email && !email) setEmail(data.email)
      if (data.phone && !phone) setPhone(data.phone)
      if (data.linkedIn && !linkedIn) setLinkedIn(data.linkedIn)
      if (data.countryRegion && !countryRegion) setCountryRegion(data.countryRegion)
      if (data.organization && !organization) setOrganization(data.organization)
      if (data.bio && !bio) setBio(data.bio)
      if (data.credentials && !credentials) setCredentials(data.credentials)
    },
    [name, title, email, phone, linkedIn, countryRegion, organization, bio, credentials]
  )

  const extractFromFile = useCallback(
    async (file: File) => {
      setIsExtracting(true)
      setExtractError(null)
      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch(`/api/case/${caseId}/recommenders/extract`, {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Extraction failed')
        }
        const { extracted, contextNotes: notes } = await res.json()
        applyExtracted(extracted)
        setContextNotes(notes)
      } catch (err) {
        setExtractError(err instanceof Error ? err.message : 'Extraction failed')
      } finally {
        setIsExtracting(false)
      }
    },
    [caseId, applyExtracted]
  )

  const extractFromUrl = useCallback(
    async () => {
      if (!extractUrl.trim()) return
      setIsExtracting(true)
      setExtractError(null)
      try {
        const res = await fetch(`/api/case/${caseId}/recommenders/extract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: extractUrl.trim() }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Extraction failed')
        }
        const { extracted, contextNotes: notes } = await res.json()
        applyExtracted(extracted)
        setContextNotes(notes)
      } catch (err) {
        setExtractError(err instanceof Error ? err.message : 'Extraction failed')
      } finally {
        setIsExtracting(false)
      }
    },
    [caseId, extractUrl, applyExtracted]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => {
      if (files[0]) extractFromFile(files[0])
    },
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    multiple: false,
    disabled: isExtracting,
  })

  const [isImproving, setIsImproving] = useState(false)

  const improveContext = useCallback(async () => {
    if (!relationshipContext.trim()) return
    setIsImproving(true)
    try {
      const res = await fetch(`/api/case/${caseId}/recommenders/improve-context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft: relationshipContext.trim(),
          recommenderName: name || undefined,
          recommenderTitle: title || undefined,
          relationshipType,
          organization: organization || undefined,
          bio: bio || undefined,
          credentials: credentials || undefined,
        }),
      })
      if (!res.ok) throw new Error('Failed to improve')
      const { improved } = await res.json()
      if (improved) setRelationshipContext(improved)
    } catch {
      // silent fail -- user still has their draft
    } finally {
      setIsImproving(false)
    }
  }, [caseId, relationshipContext, name, title, relationshipType, organization, bio, credentials])

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)

      // Validate required fields
      if (!name.trim()) {
        setError('Name is required')
        return
      }
      if (!title.trim()) {
        setError('Title is required')
        return
      }
      if (!relationshipContext.trim()) {
        setError('Relationship context is required')
        return
      }

      setIsSaving(true)

      try {
        const payload: Record<string, unknown> = {
          name: name.trim(),
          title: title.trim(),
          relationshipType,
          relationshipContext: relationshipContext.trim(),
        }

        // Add optional fields only if provided
        if (email.trim()) payload.email = email.trim()
        if (phone.trim()) payload.phone = phone.trim()
        if (linkedIn.trim()) payload.linkedIn = linkedIn.trim()
        if (countryRegion.trim()) payload.countryRegion = countryRegion.trim()
        if (organization.trim()) payload.organization = organization.trim()
        if (bio.trim()) payload.bio = bio.trim()
        if (credentials.trim()) payload.credentials = credentials.trim()
        if (startDate) payload.startDate = new Date(startDate).toISOString()
        if (endDate) payload.endDate = new Date(endDate).toISOString()
        if (durationYears.trim()) {
          const parsed = parseFloat(durationYears)
          if (!isNaN(parsed)) payload.durationYears = parsed
        }
        if (contextNotes) payload.contextNotes = contextNotes
        if (criteriaKeys.length > 0) payload.criteriaKeys = criteriaKeys

        const url = isEdit
          ? `/api/case/${caseId}/recommenders/${recommender.id}`
          : `/api/case/${caseId}/recommenders`

        const res = await fetch(url, {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to save recommender')
        }

        const saved = await res.json()
        onSave(saved)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save')
      } finally {
        setIsSaving(false)
      }
    },
    [
      caseId,
      isEdit,
      recommender?.id,
      name,
      title,
      relationshipType,
      relationshipContext,
      email,
      phone,
      linkedIn,
      countryRegion,
      organization,
      bio,
      credentials,
      startDate,
      endDate,
      durationYears,
      contextNotes,
      criteriaKeys,
      onSave,
    ]
  )

  return (
    <form onSubmit={handleSubmit} className="flex flex-col max-h-[85vh]">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 flex items-center justify-between border-b border-border">
        <h3 className="text-sm font-semibold">
          {isEdit ? 'Edit Recommender' : 'Add Recommender'}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onCancel}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Form content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Extraction zone - create mode only */}
        {!isEdit && (
          <div className="space-y-3">
            <div
              {...getRootProps()}
              className={cn(
                'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors',
                isDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50',
                isExtracting && 'opacity-50 pointer-events-none'
              )}
            >
              <input {...getInputProps()} />
              {isExtracting ? (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Extracting...
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <Upload className="w-5 h-5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Drop a PDF, DOCX, or TXT to auto-fill
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={extractUrl}
                  onChange={(e) => setExtractUrl(e.target.value)}
                  placeholder="Paste profile URL..."
                  className="h-9 pl-8"
                  disabled={isExtracting}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      extractFromUrl()
                    }
                  }}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isExtracting || !extractUrl.trim()}
                onClick={extractFromUrl}
                className="h-9"
              >
                {isExtracting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Fetch'
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              For best results, upload a PDF or DOCX profile. Public URLs work well, though some sites may restrict access.
            </p>

            {extractError && (
              <p className="text-xs text-red-500 bg-red-500/10 px-3 py-2 rounded-md">
                {extractError}
              </p>
            )}
          </div>
        )}

        {/* Required fields - always visible */}
        <div className="space-y-3">
          <FormField label="Full Name" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dr. Jane Smith"
              className="h-9"
            />
          </FormField>

          <FormField label="Professional Title" required>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Professor of Computer Science"
              className="h-9"
            />
          </FormField>

          <FormField label="Relationship Type" required>
            <Select
              value={relationshipType}
              onValueChange={(v) => setRelationshipType(v as RelationshipType)}
            >
              <SelectTrigger className="w-full h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_TYPES.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Relationship Context
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              {relationshipContext.trim().length > 0 && (
                <button
                  type="button"
                  onClick={improveContext}
                  disabled={isImproving}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {isImproving ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  {isImproving ? 'Improving...' : 'Improve'}
                </button>
              )}
            </div>
            <textarea
              value={relationshipContext}
              onChange={(e) => setRelationshipContext(e.target.value)}
              placeholder="Describe how you know this person and why they can speak to your qualifications..."
              className="w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
          </div>

          {/* Criteria Mapping - inline row */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Criteria Mapping</label>
            <TooltipProvider delayDuration={200}>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(CRITERIA_LABELS).map(([key, label]) => (
                  <Tooltip key={key}>
                    <TooltipTrigger asChild>
                      <label
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2 py-1 rounded-md border cursor-pointer transition-colors text-xs",
                          criteriaKeys.includes(key)
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border bg-muted/30 text-muted-foreground hover:border-muted-foreground/50"
                        )}
                      >
                        <Checkbox
                          checked={criteriaKeys.includes(key)}
                          onCheckedChange={(checked) => {
                            setCriteriaKeys((prev) =>
                              checked
                                ? [...prev, key]
                                : prev.filter((k) => k !== key)
                            )
                          }}
                          className="h-3.5 w-3.5"
                        />
                        <span className="font-medium">{key}</span>
                      </label>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{label}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipProvider>
          </div>
        </div>

        {/* Collapsible sections */}
        <div className="space-y-1 border-t border-border pt-4">
          <FormSection title="Contact Information" icon={User}>
            <FormField label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane.smith@university.edu"
                className="h-9"
              />
            </FormField>

            <FormField label="Phone">
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 123-4567"
                className="h-9"
              />
            </FormField>

            <FormField label="LinkedIn Profile">
              <Input
                type="url"
                value={linkedIn}
                onChange={(e) => setLinkedIn(e.target.value)}
                placeholder="https://linkedin.com/in/janesmith"
                className="h-9"
              />
            </FormField>

            <FormField label="Country/Region">
              <Input
                value={countryRegion}
                onChange={(e) => setCountryRegion(e.target.value)}
                placeholder="United States"
                className="h-9"
              />
            </FormField>
          </FormSection>

          <FormSection title="Professional Details" icon={Briefcase}>
            <FormField label="Organization">
              <Input
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="Stanford University"
                className="h-9"
              />
            </FormField>

            <FormField label="Bio">
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Brief professional biography..."
                className="w-full min-h-[60px] px-3 py-2 rounded-md border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
            </FormField>

            <FormField label="Credentials">
              <Input
                value={credentials}
                onChange={(e) => setCredentials(e.target.value)}
                placeholder="Ph.D., IEEE Fellow, ACM Distinguished Member"
                className="h-9"
              />
            </FormField>
          </FormSection>

          <FormSection title="Relationship Timeline" icon={Link2}>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Start Date">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9"
                />
              </FormField>

              <FormField label="End Date">
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9"
                />
              </FormField>
            </div>

            <FormField label="Duration (Years)">
              <Input
                type="number"
                step="0.5"
                min="0"
                value={durationYears}
                onChange={(e) => setDurationYears(e.target.value)}
                placeholder="3.5"
                className="h-9"
              />
            </FormField>
          </FormSection>

        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-3 border-t border-border space-y-3">
        {error && (
          <p className="text-xs text-red-500 bg-red-500/10 px-3 py-2 rounded-md">
            {error}
          </p>
        )}

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : isEdit ? (
              'Update'
            ) : (
              'Add Recommender'
            )}
          </Button>
        </div>
      </div>
    </form>
  )
}
