"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trash2, MessageSquare, ChevronDown, ChevronRight } from "lucide-react"
import Link from "next/link"

interface AgentPrompt {
  id: string
  slug: string
  name: string
  description: string | null
  category: string
  usageGroup: string
  provider: string
  modelName: string
  active: boolean
  variables: Array<{ key: string; label: string; description: string }>
  updatedAt: string
  _count: { versions: number }
}

const CATEGORY_COLORS: Record<string, string> = {
  static: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  "dynamic-system": "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  "dynamic-user": "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
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

function groupPrompts(prompts: AgentPrompt[]): [string, AgentPrompt[]][] {
  const groups = new Map<string, AgentPrompt[]>()
  for (const p of prompts) {
    const g = p.usageGroup || "uncategorized"
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g)!.push(p)
  }
  // Sort groups by label
  return Array.from(groups.entries()).sort((a, b) =>
    (GROUP_LABELS[a[0]] || a[0]).localeCompare(GROUP_LABELS[b[0]] || b[0])
  )
}

export default function AdminPromptsPage() {
  const [prompts, setPrompts] = useState<AgentPrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

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

  const toggleGroup = (group: string) => {
    setCollapsed((prev) => ({ ...prev, [group]: !prev[group] }))
  }

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold mb-6">Agent Prompts</h1>
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    )
  }

  const groups = groupPrompts(prompts)

  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold mb-6">Agent Prompts</h1>

      {groups.length > 0 ? (
        <div className="space-y-3">
          {groups.map(([group, items]) => (
            <div
              key={group}
              className="rounded-lg border border-stone-200 dark:border-stone-800 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleGroup(group)}
                className="w-full flex items-center gap-2 px-3 py-2.5 bg-muted/50 hover:bg-muted/80 transition-colors text-left"
              >
                {collapsed[group] ? (
                  <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                )}
                <span className="text-sm font-medium">
                  {GROUP_LABELS[group] || group}
                </span>
                <Badge variant="secondary" className="text-xs ml-1">
                  {items.length}
                </Badge>
              </button>

              {!collapsed[group] && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-t border-stone-200 dark:border-stone-800 bg-muted/30">
                      <th className="text-left px-3 py-1.5 font-medium text-muted-foreground text-xs">Name</th>
                      <th className="text-left px-3 py-1.5 font-medium text-muted-foreground text-xs">Category</th>
                      <th className="text-left px-3 py-1.5 font-medium text-muted-foreground text-xs">Model</th>
                      <th className="text-left px-3 py-1.5 font-medium text-muted-foreground text-xs w-12">Ver</th>
                      <th className="text-left px-3 py-1.5 font-medium text-muted-foreground text-xs w-16">Active</th>
                      <th className="px-3 py-1.5 w-12" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((p) => (
                      <tr
                        key={p.id}
                        className="border-t last:border-b-0 border-stone-200 dark:border-stone-800"
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
                        <td className="px-3 py-2 text-muted-foreground text-xs font-mono">
                          {p.modelName.replace("claude-", "").replace("-20250514", "")}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-xs font-mono">
                            v{p._count.versions}
                          </Badge>
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
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          No prompts found. Run the seed script to populate agent prompts.
        </p>
      )}
    </div>
  )
}
