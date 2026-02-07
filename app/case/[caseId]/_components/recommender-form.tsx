'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  ChevronDown,
  User,
  Briefcase,
  Link2,
  Loader2,
  X,
} from 'lucide-react'

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
      onSave,
    ]
  )

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
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
            <select
              value={relationshipType}
              onChange={(e) =>
                setRelationshipType(e.target.value as RelationshipType)
              }
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {RELATIONSHIP_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Relationship Context" required>
            <textarea
              value={relationshipContext}
              onChange={(e) => setRelationshipContext(e.target.value)}
              placeholder="Describe how you know this person and why they can speak to your qualifications..."
              className="w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
          </FormField>
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
