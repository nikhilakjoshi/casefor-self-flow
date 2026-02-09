"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"
import Link from "next/link"

interface AppType {
  id: string
  code: string
  name: string
}

interface Variation {
  id: string
  label: string
  content: string
  matchField: string
  matchValue: string
  isDefault: boolean
  active: boolean
}

interface Template {
  id: string
  name: string
  type: string
  description: string | null
  applicationTypeId: string
  systemInstruction: string
  version: number
  active: boolean
  applicationType: AppType
  variations: Variation[]
}

const TEMPLATE_TYPES = [
  { value: "PERSONAL_STATEMENT", label: "Personal Statement" },
  { value: "RECOMMENDATION_LETTER", label: "Recommendation Letter" },
  { value: "PETITION", label: "Petition" },
  { value: "USCIS_FORM", label: "USCIS Form" },
  { value: "OTHER", label: "Other" },
]

export default function AdminTemplateEditPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()

  const [template, setTemplate] = useState<Template | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [type, setType] = useState("")
  const [systemInstruction, setSystemInstruction] = useState("")
  const [active, setActive] = useState(true)

  // Variations state
  const [variations, setVariations] = useState<Variation[]>([])
  const [addingVariation, setAddingVariation] = useState(false)
  const [newVar, setNewVar] = useState({ label: "", content: "", matchField: "", matchValue: "" })

  const didFetch = useRef(false)
  const fetchTemplate = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/templates/${params.id}`)
      if (!res.ok) {
        setError("Template not found")
        return
      }
      const data: Template = await res.json()
      setTemplate(data)
      setName(data.name)
      setDescription(data.description ?? "")
      setType(data.type)
      setSystemInstruction(data.systemInstruction)
      setActive(data.active)
      setVariations(data.variations)
    } catch {
      setError("Failed to load template")
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    if (didFetch.current) return
    didFetch.current = true
    fetchTemplate()
  }, [fetchTemplate])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/templates/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type,
          systemInstruction,
          description: description || null,
          active,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setTemplate(updated)
        router.push("/admin/templates")
      } else {
        const data = await res.json()
        setError(data.error || "Failed to save")
      }
    } catch {
      setError("Failed to save template")
    } finally {
      setSaving(false)
    }
  }

  const handleAddVariation = async () => {
    if (!newVar.label || !newVar.content) return
    try {
      const res = await fetch(`/api/admin/templates/${params.id}/variations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newVar),
      })
      if (res.ok) {
        const created = await res.json()
        setVariations((prev) => [...prev, created])
        setNewVar({ label: "", content: "", matchField: "", matchValue: "" })
        setAddingVariation(false)
      }
    } catch {
      setError("Failed to add variation")
    }
  }

  const handleUpdateVariation = async (varId: string, data: Partial<Variation>) => {
    try {
      const res = await fetch(`/api/admin/templates/${params.id}/variations/${varId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        const updated = await res.json()
        setVariations((prev) => prev.map((v) => (v.id === varId ? updated : v)))
      }
    } catch {
      setError("Failed to update variation")
    }
  }

  const handleDeleteVariation = async (varId: string) => {
    try {
      const res = await fetch(`/api/admin/templates/${params.id}/variations/${varId}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setVariations((prev) => prev.filter((v) => v.id !== varId))
      }
    } catch {
      setError("Failed to delete variation")
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    )
  }

  if (!template) {
    return (
      <div className="p-6">
        <p className="text-destructive text-sm">{error || "Template not found"}</p>
        <Link href="/admin/templates" className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block">
          Back to templates
        </Link>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/admin/templates">
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">Edit Template</h1>
        <Badge variant="secondary" className="text-xs">
          v{template.version}
        </Badge>
      </div>

      {error && (
        <div className="mb-4 p-2 text-sm text-destructive bg-destructive/10 rounded">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-1.5 block">Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="max-w-md"
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">Description</label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            className="max-w-md"
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="flex h-9 w-full max-w-md rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {TEMPLATE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">Application Type</label>
          <p className="text-sm text-muted-foreground">
            {template.applicationType.name} ({template.applicationType.code})
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Active</label>
          <button
            type="button"
            onClick={() => setActive(!active)}
            className={`inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              active ? "bg-emerald-500" : "bg-stone-300 dark:bg-stone-600"
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                active ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">System Instruction</label>
          <p className="text-xs text-muted-foreground mb-1.5">
            General drafting guidelines: tone, voice, structure. Shared across all variations.
          </p>
          <textarea
            value={systemInstruction}
            onChange={(e) => setSystemInstruction(e.target.value)}
            rows={8}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
          />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
          <Link href="/admin/templates">
            <Button variant="outline">Cancel</Button>
          </Link>
        </div>
      </div>

      {/* Variations Section */}
      <div className="mt-10 border-t pt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Variations</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddingVariation(true)}
            className="gap-1"
          >
            <Plus className="size-3.5" />
            Add Variation
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Variations provide role-specific template content. They are matched against applicant profile fields.
        </p>

        <div className="space-y-4">
          {variations.map((v) => (
            <VariationCard
              key={v.id}
              variation={v}
              onUpdate={(data) => handleUpdateVariation(v.id, data)}
              onDelete={() => handleDeleteVariation(v.id)}
            />
          ))}

          {addingVariation && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <h3 className="text-sm font-medium">New Variation</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Label</label>
                  <Input
                    value={newVar.label}
                    onChange={(e) => setNewVar((p) => ({ ...p, label: e.target.value }))}
                    placeholder="e.g. Software Engineer"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Match Field</label>
                  <Input
                    value={newVar.matchField}
                    onChange={(e) => setNewVar((p) => ({ ...p, matchField: e.target.value }))}
                    placeholder="e.g. field_of_work"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Match Value</label>
                  <Input
                    value={newVar.matchValue}
                    onChange={(e) => setNewVar((p) => ({ ...p, matchValue: e.target.value }))}
                    placeholder="e.g. Software Engineering"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Content</label>
                <textarea
                  value={newVar.content}
                  onChange={(e) => setNewVar((p) => ({ ...p, content: e.target.value }))}
                  rows={6}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
                  placeholder="Template body for this variation..."
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddVariation}>
                  Create
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAddingVariation(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {variations.length === 0 && !addingVariation && (
            <p className="text-sm text-muted-foreground">
              No variations. Add one to provide template content for document generation.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function VariationCard({
  variation,
  onUpdate,
  onDelete,
}: {
  variation: Variation
  onUpdate: (data: Partial<Variation>) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(variation.label)
  const [content, setContent] = useState(variation.content)
  const [matchField, setMatchField] = useState(variation.matchField)
  const [matchValue, setMatchValue] = useState(variation.matchValue)

  const handleSave = () => {
    onUpdate({ label, content, matchField, matchValue })
    setEditing(false)
  }

  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{variation.label}</span>
          {variation.isDefault && (
            <Badge variant="secondary" className="text-xs">Default</Badge>
          )}
          {!variation.active && (
            <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!variation.isDefault && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => onUpdate({ isDefault: true })}
            >
              Set Default
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={() => setEditing(!editing)}
          >
            {editing ? "Cancel" : "Edit"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {(variation.matchField || variation.matchValue) && !editing && (
        <p className="text-xs text-muted-foreground">
          Match: {variation.matchField} = "{variation.matchValue}"
        </p>
      )}

      {!editing && (
        <p className="text-xs text-muted-foreground line-clamp-2 font-mono">
          {variation.content}
        </p>
      )}

      {editing && (
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Label</label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Match Field</label>
              <Input value={matchField} onChange={(e) => setMatchField(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Match Value</label>
              <Input value={matchValue} onChange={(e) => setMatchValue(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
            />
          </div>
          <Button size="sm" onClick={handleSave}>
            Save Variation
          </Button>
        </div>
      )}
    </div>
  )
}
