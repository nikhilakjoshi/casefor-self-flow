"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trash2, MessageSquare } from "lucide-react"
import Link from "next/link"

interface AgentPrompt {
  id: string
  slug: string
  name: string
  description: string | null
  category: string
  provider: string
  modelName: string
  active: boolean
  variables: Array<{ key: string; label: string; description: string }>
  updatedAt: string
}

const CATEGORY_COLORS: Record<string, string> = {
  static: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  "dynamic-system": "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  "dynamic-user": "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
}

export default function AdminPromptsPage() {
  const [prompts, setPrompts] = useState<AgentPrompt[]>([])
  const [loading, setLoading] = useState(true)

  const didFetch = useRef(false)
  const fetchPrompts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/prompts")
      if (res.ok) {
        setPrompts(await res.json())
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (didFetch.current) return
    didFetch.current = true
    fetchPrompts()
  }, [fetchPrompts])

  const deletePrompt = async (id: string) => {
    const res = await fetch(`/api/admin/prompts/${id}`, { method: "DELETE" })
    if (res.ok) {
      setPrompts((prev) => prev.filter((p) => p.id !== id))
    }
  }

  const toggleActive = async (p: AgentPrompt) => {
    const res = await fetch(`/api/admin/prompts/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !p.active }),
    })
    if (res.ok) {
      const updated = await res.json()
      setPrompts((prev) =>
        prev.map((item) => (item.id === updated.id ? { ...item, active: updated.active } : item))
      )
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold mb-6">Agent Prompts</h1>
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold mb-6">Agent Prompts</h1>

      {prompts.length > 0 ? (
        <div className="rounded-lg border border-stone-200 dark:border-stone-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 dark:border-stone-800 bg-muted/50">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Category</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Provider</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Model</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground w-16">Vars</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground w-20">Active</th>
                <th className="px-3 py-2 w-24" />
              </tr>
            </thead>
            <tbody>
              {prompts.map((p) => (
                <tr
                  key={p.id}
                  className="border-b last:border-b-0 border-stone-200 dark:border-stone-800"
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/prompts/${p.id}`}
                      className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5"
                    >
                      <MessageSquare className="size-3.5 shrink-0" />
                      {p.name}
                    </Link>
                    {p.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 ml-5 truncate max-w-xs">
                        {p.description}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant="secondary"
                      className={`text-xs ${CATEGORY_COLORS[p.category] || ""}`}
                    >
                      {p.category}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{p.provider}</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs font-mono">
                    {p.modelName.replace("claude-", "").replace("-20250514", "")}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {(p.variables as unknown[]).length}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleActive(p)}
                      className={`inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        p.active
                          ? "bg-emerald-500"
                          : "bg-stone-300 dark:bg-stone-600"
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                          p.active ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => deletePrompt(p.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          No prompts found. Run the seed script to populate agent prompts.
        </p>
      )}
    </div>
  )
}
