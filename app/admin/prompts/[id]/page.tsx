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
import { ArrowLeft, RotateCcw, History, X } from "lucide-react"
import Link from "next/link"
import { TiptapEditor } from "@/components/ui/tiptap-editor"

interface Variable {
  key: string
  label: string
  description: string
}

interface VersionSummary {
  id: string
  version: number
  provider: string
  modelName: string
  createdAt: string
}

interface VersionDetail {
  id: string
  version: number
  content: string
  provider: string
  modelName: string
  temperature: number | null
  maxTokens: number | null
  createdAt: string
}

interface AgentPrompt {
  id: string
  slug: string
  name: string
  description: string | null
  category: string
  usageGroup: string
  content: string
  defaultContent: string
  variables: Variable[]
  provider: string
  modelName: string
  temperature: number | null
  maxTokens: number | null
  active: boolean
  versions: VersionSummary[]
}

const GROUP_LABELS: Record<string, string> = {
  "data-extraction": "Onboard / Data Extraction",
  "criterion-analysis": "Analyze / Criterion Analysis",
  "case-analysis": "Analyze / Case Analysis",
  "evidence-verification": "Evidence / Verification",
  "document-generation": "Drafting / Document Agents",
  "category-drafters": "Drafting / Category Drafters",
  uncategorized: "Other",
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

  const [showHistory, setShowHistory] = useState(false)
  const [viewingVersion, setViewingVersion] = useState<VersionDetail | null>(null)
  const [loadingVersion, setLoadingVersion] = useState(false)

  // TipTap editor key — bumped to force re-mount when content is reset externally
  const [editorKey, setEditorKey] = useState(0)

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
    // Append the variable tag to the end of content.
    // TipTap will re-render and the user can move it within the rich editor.
    const tag = `{{${varKey}}}`
    setContent((prev) => prev + tag)
    setEditorKey((k) => k + 1) // force TipTap remount with new content
  }

  const resetToDefault = () => {
    if (prompt?.defaultContent) {
      setContent(prompt.defaultContent)
      setEditorKey((k) => k + 1)
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

  const viewVersion = async (v: VersionSummary) => {
    setLoadingVersion(true)
    try {
      const res = await fetch(`/api/admin/prompts/${params.id}/versions/${v.id}`)
      if (res.ok) {
        setViewingVersion(await res.json())
      }
    } finally {
      setLoadingVersion(false)
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
        <Link href="/admin/prompts" className="text-sm text-[var(--accent-gold)] hover:text-[var(--accent-gold-light)] hover:underline mt-2 inline-block">
          Back to prompts
        </Link>
      </div>
    )
  }

  const variables = (prompt.variables ?? []) as Variable[]
  const latestVersion = prompt.versions?.[0]?.version ?? 0

  return (
    <div className="flex h-full overflow-hidden">
      {/* ---- Left config panel (like Vercel's file tree) ---- */}
      <div className="w-[300px] shrink-0 border-r border-[var(--cream)] bg-[var(--warm-white)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 px-4 py-3 border-b border-[var(--cream)] flex items-center gap-2">
          <Link href="/admin/prompts">
            <Button variant="ghost" size="icon-xs">
              <ArrowLeft className="size-3.5" />
            </Button>
          </Link>
          <div className="min-w-0 flex-1">
            <div className="font-serif text-[0.92rem] font-medium text-[var(--ink)] truncate">
              {prompt.name}
            </div>
            <div className="font-mono text-[0.65rem] text-[var(--ash)] tabular-nums truncate">
              {prompt.slug}
            </div>
          </div>
        </div>

        {/* Config fields — scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
          {error && (
            <div className="p-2 text-[0.75rem] text-[var(--red-urgent)] bg-[var(--red-bg)] rounded-[4px]">
              {error}
            </div>
          )}

          <div>
            <label className="text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--ash)] mb-1 block">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" />
          </div>

          <div>
            <label className="text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--ash)] mb-1 block">Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
              className="h-8 text-sm"
            />
          </div>

          <div>
            <label className="text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--ash)] mb-1 block">Group</label>
            <div className="text-[0.78rem] text-[var(--charcoal)]">
              {GROUP_LABELS[prompt.usageGroup] || prompt.usageGroup}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--ash)] mb-1 block">Provider</label>
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
                <SelectTrigger className="h-8 text-xs">
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
              <label className="text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--ash)] mb-1 block">Model</label>
              <Select value={modelName} onValueChange={setModelName}>
                <SelectTrigger className="h-8 text-xs">
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--ash)] mb-1 block">Temperature</label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                placeholder="Default"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--ash)] mb-1 block">Max Tokens</label>
              <Input
                type="number"
                min="1"
                value={maxTokens}
                onChange={(e) => setMaxTokens(e.target.value)}
                placeholder="Default"
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--ash)]">Active</label>
            <button
              type="button"
              onClick={() => setActive(!active)}
              className={`inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                active ? "bg-[var(--green-ok)]" : "bg-[var(--stone)]"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                  active ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {/* Variables */}
          {variables.length > 0 && (
            <div>
              <label className="text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--ash)] mb-1.5 block">Variables</label>
              <div className="flex flex-wrap gap-1">
                {variables.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVariable(v.key)}
                    className="inline-flex items-center rounded-[4px] border border-[var(--cream)] bg-[var(--parchment)] px-2 py-0.5 text-[0.68rem] font-mono text-[var(--charcoal)] hover:bg-[var(--cream)] hover:border-[var(--accent-gold)] transition-colors cursor-pointer"
                    title={v.description}
                  >
                    {`{{${v.key}}}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Version history */}
          {prompt.versions && prompt.versions.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--ash)] hover:text-[var(--ink)] transition-colors mb-1.5"
              >
                <History className="size-3" />
                Versions ({prompt.versions.length})
              </button>
              {showHistory && (
                <div className="space-y-0.5">
                  {prompt.versions.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => viewVersion(v)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-[4px] text-[0.75rem] flex items-center justify-between hover:bg-[var(--accent-gold-subtle)] transition-colors ${
                        viewingVersion?.id === v.id ? "bg-[var(--accent-gold-subtle)]" : ""
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[0.65rem] text-[var(--ash)] tabular-nums">v{v.version}</span>
                        {v.version === latestVersion && (
                          <span className="text-[0.6rem] text-[var(--accent-gold)]">current</span>
                        )}
                      </div>
                      <span className="font-mono text-[0.6rem] text-[var(--stone)] tabular-nums">
                        {new Date(v.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 border-t border-[var(--cream)] flex flex-col gap-2">
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Saving..." : "Save"}
            </Button>
            <div className="flex items-center gap-2">
              {prompt.defaultContent && content !== prompt.defaultContent && (
                <Button variant="ghost" size="sm" className="flex-1 h-7 text-xs gap-1" onClick={resetToDefault}>
                  <RotateCcw className="size-3" />
                  Reset
                </Button>
              )}
              <Link href="/admin/prompts" className="flex-1">
                <Button variant="outline" size="sm" className="w-full h-7 text-xs">
                  Cancel
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Right editor panel (fills remaining width) ---- */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[var(--parchment)]">
        {/* Editor toolbar header */}
        <div className="shrink-0 px-4 py-2 border-b border-[var(--cream)] flex items-center justify-between bg-[var(--warm-white)]">
          <div className="flex items-center gap-2">
            <span className="text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--ash)]">Content</span>
            {latestVersion > 0 && (
              <span className="font-mono text-[0.65rem] text-[var(--stone)] tabular-nums">v{latestVersion}</span>
            )}
          </div>
          <Badge
            variant={prompt.category === "static" ? "info" : prompt.category === "dynamic-system" ? "review" : "weak"}
            className="text-[0.65rem]"
          >
            {prompt.category}
          </Badge>
        </div>

        {/* Version preview (if viewing a past version) */}
        {viewingVersion && !loadingVersion && (
          <div className="shrink-0 px-4 py-2 border-b border-[var(--cream)] bg-[var(--amber-bg)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[0.75rem] text-[var(--amber-warn)]">
                <History className="size-3" />
                Viewing v{viewingVersion.version} ({viewingVersion.provider}/{viewingVersion.modelName.replace("claude-", "").replace("-20250514", "")})
              </div>
              <Button variant="ghost" size="icon-xs" onClick={() => setViewingVersion(null)}>
                <X className="size-3" />
              </Button>
            </div>
          </div>
        )}

        {/* TipTap editor fills remaining space */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <TiptapEditor
            key={editorKey}
            content={viewingVersion ? viewingVersion.content : content}
            onUpdate={(md) => { if (!viewingVersion) setContent(md) }}
            editable={!viewingVersion}
            trackChangesDefault={false}
            minimal
          />
        </div>
      </div>
    </div>
  )
}
