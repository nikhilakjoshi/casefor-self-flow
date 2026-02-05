"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

interface AppType {
  id: string
  code: string
  name: string
}

interface Template {
  id: string
  name: string
  type: string
  applicationTypeId: string
  content: string
  version: number
  active: boolean
  applicationType: AppType
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
  const [type, setType] = useState("")
  const [content, setContent] = useState("")
  const [active, setActive] = useState(true)

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
      setType(data.type)
      setContent(data.content)
      setActive(data.active)
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
        body: JSON.stringify({ name, type, content, active }),
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
          <label className="text-sm font-medium mb-1.5 block">Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={16}
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
    </div>
  )
}
