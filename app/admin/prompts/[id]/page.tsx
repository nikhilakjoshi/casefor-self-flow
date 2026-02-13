"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, RotateCcw } from "lucide-react"
import Link from "next/link"

interface Variable {
  key: string
  label: string
  description: string
}

interface AgentPrompt {
  id: string
  slug: string
  name: string
  description: string | null
  category: string
  content: string
  defaultContent: string
  variables: Variable[]
  provider: string
  modelName: string
  temperature: number | null
  maxTokens: number | null
  active: boolean
}

const PROVIDERS = [
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google" },
]

const MODELS: Record<string, { value: string; label: string }[]> = {
  anthropic: [
    { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
    { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
    { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  ],
  google: [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  ],
}

export default function AdminPromptEditPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()

  const [prompt, setPrompt] = useState<AgentPrompt | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [provider, setProvider] = useState("anthropic")
  const [modelName, setModelName] = useState("")
  const [temperature, setTemperature] = useState("")
  const [maxTokens, setMaxTokens] = useState("")
  const [content, setContent] = useState("")
  const [active, setActive] = useState(true)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const didFetch = useRef(false)
  const fetchPrompt = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/prompts/${params.id}`)
      if (!res.ok) {
        setError("Prompt not found")
        return
      }
      const data: AgentPrompt = await res.json()
      setPrompt(data)
      setName(data.name)
      setDescription(data.description ?? "")
      setProvider(data.provider)
      setModelName(data.modelName)
      setTemperature(data.temperature != null ? String(data.temperature) : "")
      setMaxTokens(data.maxTokens != null ? String(data.maxTokens) : "")
      setContent(data.content)
      setActive(data.active)
    } catch {
      setError("Failed to load prompt")
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    if (didFetch.current) return
    didFetch.current = true
    fetchPrompt()
  }, [fetchPrompt])

  const insertVariable = (varKey: string) => {
    const textarea = textareaRef.current
    if (!textarea) return
    const tag = `{{${varKey}}}`
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const before = content.slice(0, start)
    const after = content.slice(end)
    const newContent = before + tag + after
    setContent(newContent)
    requestAnimationFrame(() => {
      textarea.focus()
      const pos = start + tag.length
      textarea.setSelectionRange(pos, pos)
    })
  }

  const resetToDefault = () => {
    if (prompt?.defaultContent) {
      setContent(prompt.defaultContent)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        name,
        description: description || null,
        provider,
        modelName,
        content,
        active,
        temperature: temperature ? parseFloat(temperature) : null,
        maxTokens: maxTokens ? parseInt(maxTokens, 10) : null,
      }
      const res = await fetch(`/api/admin/prompts/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        router.push("/admin/prompts")
      } else {
        const data = await res.json()
        setError(data.error || "Failed to save")
      }
    } catch {
      setError("Failed to save prompt")
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

  if (!prompt) {
    return (
      <div className="p-6">
        <p className="text-destructive text-sm">{error || "Prompt not found"}</p>
        <Link href="/admin/prompts" className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block">
          Back to prompts
        </Link>
      </div>
    )
  }

  const variables = (prompt.variables ?? []) as Variable[]

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/admin/prompts">
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">Edit Prompt</h1>
        <Badge variant="secondary" className="text-xs font-mono">
          {prompt.slug}
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
          <Input value={name} onChange={(e) => setName(e.target.value)} className="max-w-md" />
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

        <div className="grid grid-cols-2 gap-4 max-w-md">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Provider</label>
            <Select
              value={provider}
              onValueChange={(val) => {
                setProvider(val)
                const models = MODELS[val]
                if (models && !models.some((m) => m.value === modelName)) {
                  setModelName(models[0].value)
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Model</label>
            <Select value={modelName} onValueChange={setModelName}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(MODELS[provider] ?? []).map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 max-w-md">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Temperature</label>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              placeholder="Default"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Max Tokens</label>
            <Input
              type="number"
              min="1"
              value={maxTokens}
              onChange={(e) => setMaxTokens(e.target.value)}
              placeholder="Default"
            />
          </div>
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
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium">Content</label>
            {prompt.defaultContent && content !== prompt.defaultContent && (
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={resetToDefault}>
                <RotateCcw className="size-3" />
                Reset to Default
              </Button>
            )}
          </div>

          {variables.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {variables.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertVariable(v.key)}
                  className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-mono transition-colors hover:bg-muted cursor-pointer"
                  title={v.description}
                >
                  {`{{${v.key}}}`}
                </button>
              ))}
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={24}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono leading-relaxed"
          />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
          <Link href="/admin/prompts">
            <Button variant="outline">Cancel</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
