"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pencil, Check, X, Trash2 } from "lucide-react"

interface AppType {
  id: string
  code: string
  name: string
}

interface Criterion {
  id: string
  applicationTypeId: string
  criterionKey: string
  name: string
  description: string
  displayOrder: number
  active: boolean
  applicationType: AppType
}

type EditState = {
  id: string
  name: string
  description: string
  displayOrder: number
  active: boolean
} | null

export default function AdminCriteriaPage() {
  const [criteria, setCriteria] = useState<Criterion[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<EditState>(null)
  const [saving, setSaving] = useState(false)

  const didFetch = useRef(false)
  const fetchCriteria = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/criteria")
      if (res.ok) {
        setCriteria(await res.json())
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (didFetch.current) return
    didFetch.current = true
    fetchCriteria()
  }, [fetchCriteria])

  const startEdit = (c: Criterion) => {
    setEditing({
      id: c.id,
      name: c.name,
      description: c.description,
      displayOrder: c.displayOrder,
      active: c.active,
    })
  }

  const cancelEdit = () => setEditing(null)

  const saveEdit = async () => {
    if (!editing) return
    setSaving(true)
    const res = await fetch(`/api/admin/criteria/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editing.name,
        description: editing.description,
        displayOrder: editing.displayOrder,
        active: editing.active,
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      setCriteria((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      )
      setEditing(null)
    }
    setSaving(false)
  }

  const deleteCriterion = async (id: string) => {
    const res = await fetch(`/api/admin/criteria/${id}`, { method: "DELETE" })
    if (res.ok) {
      setCriteria((prev) => prev.filter((c) => c.id !== id))
    }
  }

  const toggleActive = async (c: Criterion) => {
    const res = await fetch(`/api/admin/criteria/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !c.active }),
    })
    if (res.ok) {
      const updated = await res.json()
      setCriteria((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      )
    }
  }

  // Group by application type
  const grouped = criteria.reduce<Record<string, { appType: AppType; items: Criterion[] }>>(
    (acc, c) => {
      const key = c.applicationTypeId
      if (!acc[key]) {
        acc[key] = { appType: c.applicationType, items: [] }
      }
      acc[key].items.push(c)
      return acc
    },
    {}
  )

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold mb-6">Criteria</h1>
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold mb-6">Criteria</h1>

      {Object.entries(grouped).map(([appTypeId, { appType, items }]) => (
        <div key={appTypeId} className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-medium">{appType.name}</h2>
            <Badge variant="secondary" className="text-xs">
              {appType.code}
            </Badge>
          </div>

          <div className="rounded-lg border border-stone-200 dark:border-stone-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800 bg-muted/50">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Key</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Description</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground w-16">Order</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground w-20">Active</th>
                  <th className="px-3 py-2 w-24" />
                </tr>
              </thead>
              <tbody>
                {items.map((c) => {
                  const isEditing = editing?.id === c.id
                  return (
                    <tr
                      key={c.id}
                      className="border-b last:border-b-0 border-stone-200 dark:border-stone-800"
                    >
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                        {c.criterionKey}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <Input
                            value={editing.name}
                            onChange={(e) =>
                              setEditing({ ...editing, name: e.target.value })
                            }
                            className="h-7 text-sm"
                          />
                        ) : (
                          c.name
                        )}
                      </td>
                      <td className="px-3 py-2 max-w-xs">
                        {isEditing ? (
                          <Input
                            value={editing.description}
                            onChange={(e) =>
                              setEditing({ ...editing, description: e.target.value })
                            }
                            className="h-7 text-sm"
                          />
                        ) : (
                          <span className="text-muted-foreground line-clamp-2">
                            {c.description}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <Input
                            type="number"
                            value={editing.displayOrder}
                            onChange={(e) =>
                              setEditing({
                                ...editing,
                                displayOrder: parseInt(e.target.value) || 0,
                              })
                            }
                            className="h-7 text-sm w-16"
                            min={0}
                          />
                        ) : (
                          <span className="text-muted-foreground">{c.displayOrder}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <button
                            type="button"
                            onClick={() =>
                              setEditing({ ...editing, active: !editing.active })
                            }
                            className={`inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                              editing.active
                                ? "bg-emerald-500"
                                : "bg-stone-300 dark:bg-stone-600"
                            }`}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                                editing.active ? "translate-x-4" : "translate-x-0.5"
                              }`}
                            />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleActive(c)}
                            className={`inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                              c.active
                                ? "bg-emerald-500"
                                : "bg-stone-300 dark:bg-stone-600"
                            }`}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                                c.active ? "translate-x-4" : "translate-x-0.5"
                              }`}
                            />
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1 justify-end">
                          {isEditing ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={saveEdit}
                                disabled={saving}
                              >
                                <Check className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={cancelEdit}
                              >
                                <X className="size-3.5" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => startEdit(c)}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => deleteCriterion(c.id)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {criteria.length === 0 && (
        <p className="text-muted-foreground text-sm">No criteria found. Run the seed script to populate criteria.</p>
      )}
    </div>
  )
}
