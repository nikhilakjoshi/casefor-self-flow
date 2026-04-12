"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Pencil,
  Check,
  X,
  Trash2,
  Copy,
  Plus,
  ArrowRight,
} from "lucide-react"

interface AppType {
  id: string
  code: string
  name: string
  defaultThreshold: number
  active: boolean
  _count: { criteria: number; cases: number }
}

export default function ApplicationTypesPage() {
  const [types, setTypes] = useState<AppType[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<{
    id: string
    code: string
    name: string
    defaultThreshold: number
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newType, setNewType] = useState({ code: "", name: "", defaultThreshold: 3 })
  const [cloning, setCloning] = useState<string | null>(null)
  const [cloneData, setCloneData] = useState({ code: "", name: "" })

  const didFetch = useRef(false)
  const fetchTypes = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/application-types")
      if (res.ok) setTypes(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (didFetch.current) return
    didFetch.current = true
    fetchTypes()
  }, [fetchTypes])

  const saveEdit = async () => {
    if (!editing) return
    setSaving(true)
    const res = await fetch(`/api/admin/application-types/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: editing.code,
        name: editing.name,
        defaultThreshold: editing.defaultThreshold,
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      setTypes((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      setEditing(null)
    }
    setSaving(false)
  }

  const toggleActive = async (t: AppType) => {
    const res = await fetch(`/api/admin/application-types/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !t.active }),
    })
    if (res.ok) {
      const updated = await res.json()
      setTypes((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
    }
  }

  const deleteType = async (id: string) => {
    const res = await fetch(`/api/admin/application-types/${id}`, { method: "DELETE" })
    if (res.ok) {
      setTypes((prev) => prev.filter((t) => t.id !== id))
    } else {
      const data = await res.json()
      alert(data.error || "Delete failed")
    }
  }

  const createType = async () => {
    if (!newType.code || !newType.name) return
    setSaving(true)
    const res = await fetch("/api/admin/application-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newType),
    })
    if (res.ok) {
      const created = await res.json()
      setTypes((prev) => [...prev, created])
      setNewType({ code: "", name: "", defaultThreshold: 3 })
      setCreating(false)
    }
    setSaving(false)
  }

  const cloneType = async (sourceId: string) => {
    if (!cloneData.code || !cloneData.name) return
    setSaving(true)
    const res = await fetch(`/api/admin/application-types/${sourceId}/clone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cloneData),
    })
    if (res.ok) {
      const created = await res.json()
      setTypes((prev) => [...prev, created])
      setCloning(null)
      setCloneData({ code: "", name: "" })
    } else {
      const data = await res.json()
      alert(data.error || "Clone failed")
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="p-6">
        <h2 className="font-serif text-xl font-medium text-[var(--ink)] mb-4">Application Types</h2>
        <div className="animate-pulse space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-12 bg-muted rounded" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-serif text-xl font-medium text-[var(--ink)]">Application Types</h2>
        <Button size="sm" onClick={() => setCreating(true)} disabled={creating}>
          <Plus className="size-3.5 mr-1" />
          New Type
        </Button>
      </div>

      {creating && (
        <div className="mb-6 border border-[var(--cream)] rounded-[8px] bg-[var(--warm-white)] p-4 space-y-3">
          <h3 className="text-sm font-medium">Create Application Type</h3>
          <div className="flex gap-3">
            <Input
              placeholder="Code (e.g. O1B)"
              value={newType.code}
              onChange={(e) => setNewType({ ...newType, code: e.target.value.toUpperCase() })}
              className="h-8 text-sm w-32"
            />
            <Input
              placeholder="Name"
              value={newType.name}
              onChange={(e) => setNewType({ ...newType, name: e.target.value })}
              className="h-8 text-sm flex-1"
            />
            <Input
              type="number"
              min={1}
              max={10}
              value={newType.defaultThreshold}
              onChange={(e) => setNewType({ ...newType, defaultThreshold: parseInt(e.target.value) || 3 })}
              className="h-8 text-sm w-20"
            />
            <Button size="sm" onClick={createType} disabled={saving}>
              Create
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="border border-[var(--cream)] rounded-[8px] overflow-hidden bg-[var(--warm-white)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--cream)] bg-[var(--parchment)]">
              <th className="text-left px-4 py-2.5 font-medium text-[var(--ash)] text-[0.72rem] uppercase tracking-wider">Code</th>
              <th className="text-left px-4 py-2.5 font-medium text-[var(--ash)] text-[0.72rem] uppercase tracking-wider">Name</th>
              <th className="text-left px-4 py-2.5 font-medium text-[var(--ash)] text-[0.72rem] uppercase tracking-wider w-20">Threshold</th>
              <th className="text-left px-4 py-2.5 font-medium text-[var(--ash)] text-[0.72rem] uppercase tracking-wider w-20">Criteria</th>
              <th className="text-left px-4 py-2.5 font-medium text-[var(--ash)] text-[0.72rem] uppercase tracking-wider w-16">Cases</th>
              <th className="text-left px-4 py-2.5 font-medium text-[var(--ash)] text-[0.72rem] uppercase tracking-wider w-16">Active</th>
              <th className="text-right px-4 py-2.5 font-medium text-[var(--ash)] text-[0.72rem] uppercase tracking-wider w-32">Actions</th>
            </tr>
          </thead>
          <tbody>
            {types.map((t) => {
              const isEditing = editing?.id === t.id
              const isCloning = cloning === t.id
              return (
                <tr
                  key={t.id}
                  className="border-b border-[rgba(12,11,10,0.03)] last:border-b-0 hover:bg-[var(--accent-gold-subtle)] transition-colors"
                >
                  <td className="px-4 py-2.5 font-mono text-[0.78rem] tabular-nums">
                    {isEditing ? (
                      <Input
                        value={editing.code}
                        onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
                        className="h-7 text-sm w-24"
                      />
                    ) : (
                      t.code
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {isEditing ? (
                      <Input
                        value={editing.name}
                        onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                        className="h-7 text-sm"
                      />
                    ) : (
                      <Link
                        href={`/admin/application-types/${t.id}`}
                        className="text-[var(--accent-gold)] hover:text-[var(--accent-gold-light)] transition-colors"
                      >
                        {t.name}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[0.78rem] tabular-nums">
                    {isEditing ? (
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={editing.defaultThreshold}
                        onChange={(e) =>
                          setEditing({ ...editing, defaultThreshold: parseInt(e.target.value) || 3 })
                        }
                        className="h-7 text-sm w-16"
                      />
                    ) : (
                      t.defaultThreshold
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[0.78rem] tabular-nums">
                    {t._count.criteria}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[0.78rem] tabular-nums">
                    {t._count.cases}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => toggleActive(t)}
                      className={`inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        t.active ? "bg-[var(--green-ok)]" : "bg-[var(--stone)]"
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                          t.active ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {isEditing ? (
                        <>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={saveEdit}
                            disabled={saving}
                          >
                            <Check className="size-3.5 text-[var(--green-ok)]" />
                          </Button>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => setEditing(null)}
                          >
                            <X className="size-3.5" />
                          </Button>
                        </>
                      ) : isCloning ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            placeholder="Code"
                            value={cloneData.code}
                            onChange={(e) =>
                              setCloneData({ ...cloneData, code: e.target.value.toUpperCase() })
                            }
                            className="h-6 text-xs w-16"
                          />
                          <Input
                            placeholder="Name"
                            value={cloneData.name}
                            onChange={(e) =>
                              setCloneData({ ...cloneData, name: e.target.value })
                            }
                            className="h-6 text-xs w-32"
                          />
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => cloneType(t.id)}
                            disabled={saving}
                          >
                            <Check className="size-3.5 text-[var(--green-ok)]" />
                          </Button>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => {
                              setCloning(null)
                              setCloneData({ code: "", name: "" })
                            }}
                          >
                            <X className="size-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() =>
                              setEditing({
                                id: t.id,
                                code: t.code,
                                name: t.name,
                                defaultThreshold: t.defaultThreshold,
                              })
                            }
                            title="Edit"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => setCloning(t.id)}
                            title="Clone"
                          >
                            <Copy className="size-3.5" />
                          </Button>
                          <Link href={`/admin/application-types/${t.id}`}>
                            <Button size="icon-xs" variant="ghost" title="Detail">
                              <ArrowRight className="size-3.5" />
                            </Button>
                          </Link>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`Delete ${t.name}? This cannot be undone.`))
                                deleteType(t.id)
                            }}
                            title="Delete"
                            disabled={t._count.cases > 0}
                          >
                            <Trash2 className="size-3.5 text-[var(--red-urgent)]" />
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
  )
}
