"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TiptapEditor } from "@/components/ui/tiptap-editor"
import {
  Pencil,
  Check,
  X,
  Trash2,
  Plus,
  ArrowLeft,
  Save,
} from "lucide-react"

interface Criterion {
  id: string
  criterionKey: string
  name: string
  description: string
  uscisText: string
  guidanceText: string
  displayOrder: number
  active: boolean
}

interface PromptLink {
  id: string
  criterionKey: string
  purpose: string
  promptSlug: string
}

interface EvidenceTypeDef {
  id: string
  schemaKey: string
  name: string
  description: string | null
  displayOrder: number
  active: boolean
}

interface AppTypeDetail {
  id: string
  code: string
  name: string
  defaultThreshold: number
  active: boolean
  criteria: Criterion[]
  criterionPromptLinks: PromptLink[]
  evidenceTypeDefinitions: EvidenceTypeDef[]
  strengthRubric: { id: string; content: string } | null
  denialFramework: { id: string; frameworkName: string; content: string } | null
  _count: { cases: number; criteria: number; templates: number }
}

type Tab = "criteria" | "prompts" | "rubric" | "evidence" | "denial"

export default function ApplicationTypeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<AppTypeDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>("criteria")
  const [saving, setSaving] = useState(false)

  // Rubric / denial framework content
  const [rubricContent, setRubricContent] = useState("")
  const [denialContent, setDenialContent] = useState("")
  const [denialName, setDenialName] = useState("")

  // Inline editing
  const [editingCriterion, setEditingCriterion] = useState<Criterion | null>(null)
  const [newCriterion, setNewCriterion] = useState<{ key: string; name: string; description: string } | null>(null)

  const didFetch = useRef(false)
  const fetchDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/application-types/${id}`)
      if (res.ok) {
        const d = await res.json()
        setData(d)
        setRubricContent(d.strengthRubric?.content ?? "")
        setDenialContent(d.denialFramework?.content ?? "")
        setDenialName(d.denialFramework?.frameworkName ?? "")
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (didFetch.current) return
    didFetch.current = true
    fetchDetail()
  }, [fetchDetail])

  // ---- Criteria CRUD ----

  const saveCriterion = async () => {
    if (!editingCriterion || !data) return
    setSaving(true)
    const res = await fetch(`/api/admin/criteria/${editingCriterion.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editingCriterion.name,
        description: editingCriterion.description,
        displayOrder: editingCriterion.displayOrder,
        active: editingCriterion.active,
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      setData({
        ...data,
        criteria: data.criteria.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)),
      })
      setEditingCriterion(null)
    }
    setSaving(false)
  }

  const addCriterion = async () => {
    if (!newCriterion || !data) return
    setSaving(true)
    const res = await fetch("/api/admin/criteria", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationTypeId: data.id,
        criterionKey: newCriterion.key,
        name: newCriterion.name,
        description: newCriterion.description,
        displayOrder: data.criteria.length,
      }),
    })
    if (res.ok) {
      setNewCriterion(null)
      didFetch.current = false
      fetchDetail()
    }
    setSaving(false)
  }

  const deleteCriterion = async (cId: string) => {
    if (!data) return
    const res = await fetch(`/api/admin/criteria/${cId}`, { method: "DELETE" })
    if (res.ok) {
      setData({ ...data, criteria: data.criteria.filter((c) => c.id !== cId) })
    }
  }

  // ---- Rubric save ----

  const saveRubric = async () => {
    if (!data) return
    setSaving(true)
    const res = await fetch(`/api/admin/application-types/${data.id}/rubric`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: rubricContent }),
    })
    if (res.ok) {
      const rubric = await res.json()
      setData({ ...data, strengthRubric: rubric })
    }
    setSaving(false)
  }

  // ---- Denial framework save ----

  const saveDenialFramework = async () => {
    if (!data) return
    setSaving(true)
    const res = await fetch(`/api/admin/application-types/${data.id}/denial-framework`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frameworkName: denialName, content: denialContent }),
    })
    if (res.ok) {
      const framework = await res.json()
      setData({ ...data, denialFramework: framework })
    }
    setSaving(false)
  }

  if (loading || !data) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "criteria", label: `Criteria (${data.criteria.length})` },
    { key: "prompts", label: `Prompt Links (${data.criterionPromptLinks.length})` },
    { key: "rubric", label: "Strength Rubric" },
    { key: "evidence", label: `Evidence Types (${data.evidenceTypeDefinitions.length})` },
    { key: "denial", label: "Denial Framework" },
  ]

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/application-types">
          <Button size="icon-xs" variant="ghost">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h2 className="font-serif text-xl font-medium text-[var(--ink)]">
            {data.name}
          </h2>
          <div className="flex items-center gap-3 text-[0.75rem] text-[var(--ash)]">
            <span className="font-mono tabular-nums">{data.code}</span>
            <span>Threshold: {data.defaultThreshold}</span>
            <span>{data._count.cases} case(s)</span>
            <span>{data._count.templates} template(s)</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-[var(--cream)] mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-[var(--accent-gold)] text-[var(--ink)]"
                : "border-transparent text-[var(--ash)] hover:text-[var(--ink)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Criteria tab */}
      {tab === "criteria" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => setNewCriterion({ key: "", name: "", description: "" })}
              disabled={!!newCriterion}
            >
              <Plus className="size-3.5 mr-1" /> Add Criterion
            </Button>
          </div>

          {newCriterion && (
            <div className="border border-[var(--cream)] rounded-[8px] bg-[var(--warm-white)] p-4 space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Key (e.g. awards)"
                  value={newCriterion.key}
                  onChange={(e) => setNewCriterion({ ...newCriterion, key: e.target.value })}
                  className="h-7 text-sm w-32"
                />
                <Input
                  placeholder="Name"
                  value={newCriterion.name}
                  onChange={(e) => setNewCriterion({ ...newCriterion, name: e.target.value })}
                  className="h-7 text-sm flex-1"
                />
              </div>
              <Input
                placeholder="Description"
                value={newCriterion.description}
                onChange={(e) => setNewCriterion({ ...newCriterion, description: e.target.value })}
                className="h-7 text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={addCriterion} disabled={saving}>
                  Add
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setNewCriterion(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="border border-[var(--cream)] rounded-[8px] overflow-hidden bg-[var(--warm-white)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--cream)] bg-[var(--parchment)]">
                  <th className="text-left px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--ash)] w-12">#</th>
                  <th className="text-left px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--ash)] w-28">Key</th>
                  <th className="text-left px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--ash)]">Name</th>
                  <th className="text-left px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--ash)]">Description</th>
                  <th className="text-left px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--ash)] w-16">Active</th>
                  <th className="text-right px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--ash)] w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.criteria.map((c) => {
                  const isEd = editingCriterion?.id === c.id
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-[rgba(12,11,10,0.03)] last:border-b-0 hover:bg-[var(--accent-gold-subtle)]"
                    >
                      <td className="px-3 py-2 font-mono text-[0.7rem] text-[var(--ash)] tabular-nums">
                        {c.displayOrder}
                      </td>
                      <td className="px-3 py-2 font-mono text-[0.78rem] tabular-nums">
                        {c.criterionKey}
                      </td>
                      <td className="px-3 py-2">
                        {isEd ? (
                          <Input
                            value={editingCriterion.name}
                            onChange={(e) =>
                              setEditingCriterion({ ...editingCriterion, name: e.target.value })
                            }
                            className="h-7 text-sm"
                          />
                        ) : (
                          c.name
                        )}
                      </td>
                      <td className="px-3 py-2 text-[var(--ash)] text-[0.78rem] max-w-[300px] truncate">
                        {isEd ? (
                          <Input
                            value={editingCriterion.description}
                            onChange={(e) =>
                              setEditingCriterion({
                                ...editingCriterion,
                                description: e.target.value,
                              })
                            }
                            className="h-7 text-sm"
                          />
                        ) : (
                          c.description
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${
                            c.active ? "bg-[var(--green-ok)]" : "bg-[var(--stone)]"
                          }`}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        {isEd ? (
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              onClick={saveCriterion}
                              disabled={saving}
                            >
                              <Check className="size-3.5 text-[var(--green-ok)]" />
                            </Button>
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              onClick={() => setEditingCriterion(null)}
                            >
                              <X className="size-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              onClick={() => setEditingCriterion({ ...c })}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`Delete criterion ${c.criterionKey}?`))
                                  deleteCriterion(c.id)
                              }}
                            >
                              <Trash2 className="size-3.5 text-[var(--red-urgent)]" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Prompt Links tab */}
      {tab === "prompts" && (
        <div className="space-y-4">
          {data.criterionPromptLinks.length === 0 ? (
            <div className="text-center py-12 text-[var(--ash)] text-sm">
              No criterion prompt links configured. These connect criteria to specific analysis/verification prompts.
            </div>
          ) : (
            <div className="border border-[var(--cream)] rounded-[8px] overflow-hidden bg-[var(--warm-white)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--cream)] bg-[var(--parchment)]">
                    <th className="text-left px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--ash)]">Criterion</th>
                    <th className="text-left px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--ash)]">Purpose</th>
                    <th className="text-left px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--ash)]">Prompt Slug</th>
                  </tr>
                </thead>
                <tbody>
                  {data.criterionPromptLinks.map((l) => (
                    <tr
                      key={l.id}
                      className="border-b border-[rgba(12,11,10,0.03)] last:border-b-0"
                    >
                      <td className="px-3 py-2 font-mono text-[0.78rem]">{l.criterionKey}</td>
                      <td className="px-3 py-2 text-[var(--ash)]">{l.purpose}</td>
                      <td className="px-3 py-2 font-mono text-[0.78rem]">{l.promptSlug}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Strength Rubric tab */}
      {tab === "rubric" && (
        <div className="space-y-4">
          <p className="text-[0.78rem] text-[var(--ash)]">
            The strength evaluation rubric is the system prompt used to score criteria strength.
            Edit below and save.
          </p>
          <div className="border border-[var(--cream)] rounded-[8px] overflow-hidden bg-[var(--parchment)] focus-within:border-[var(--accent-gold)] focus-within:shadow-[var(--focus-ring)] transition-all" style={{ height: '480px' }}>
            <TiptapEditor
              key={`rubric-${data.id}`}
              content={rubricContent}
              onUpdate={(md) => setRubricContent(md)}
              editable={true}
              trackChangesDefault={false}
              minimal
            />
          </div>
          <Button onClick={saveRubric} disabled={saving}>
            <Save className="size-3.5 mr-1.5" />
            Save Rubric
          </Button>
        </div>
      )}

      {/* Evidence Types tab */}
      {tab === "evidence" && (
        <div className="space-y-4">
          {data.evidenceTypeDefinitions.length === 0 ? (
            <div className="text-center py-12 text-[var(--ash)] text-sm">
              No evidence types configured. These define which extraction schemas this type uses.
            </div>
          ) : (
            <div className="border border-[var(--cream)] rounded-[8px] overflow-hidden bg-[var(--warm-white)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--cream)] bg-[var(--parchment)]">
                    <th className="text-left px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--ash)]">Schema Key</th>
                    <th className="text-left px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--ash)]">Name</th>
                    <th className="text-left px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--ash)]">Description</th>
                    <th className="text-left px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--ash)] w-16">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {data.evidenceTypeDefinitions.map((e) => (
                    <tr
                      key={e.id}
                      className="border-b border-[rgba(12,11,10,0.03)] last:border-b-0"
                    >
                      <td className="px-3 py-2 font-mono text-[0.78rem]">{e.schemaKey}</td>
                      <td className="px-3 py-2">{e.name}</td>
                      <td className="px-3 py-2 text-[var(--ash)] text-[0.78rem]">
                        {e.description || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${
                            e.active ? "bg-[var(--green-ok)]" : "bg-[var(--stone)]"
                          }`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Denial Framework tab */}
      {tab === "denial" && (
        <div className="space-y-4">
          <p className="text-[0.78rem] text-[var(--ash)]">
            The denial framework prompt defines the legal standard for risk assessment (e.g. Kazarian Two-Step for EB-1A).
          </p>
          <Input
            placeholder="Framework name (e.g. Kazarian Two-Step)"
            value={denialName}
            onChange={(e) => setDenialName(e.target.value)}
            className="h-8 text-sm max-w-md"
          />
          <div className="border border-[var(--cream)] rounded-[8px] overflow-hidden bg-[var(--parchment)] focus-within:border-[var(--accent-gold)] focus-within:shadow-[var(--focus-ring)] transition-all" style={{ height: '400px' }}>
            <TiptapEditor
              key={`denial-${data.id}`}
              content={denialContent}
              onUpdate={(md) => setDenialContent(md)}
              editable={true}
              trackChangesDefault={false}
              minimal
            />
          </div>
          <Button onClick={saveDenialFramework} disabled={saving}>
            <Save className="size-3.5 mr-1.5" />
            Save Framework
          </Button>
        </div>
      )}
    </div>
  )
}
