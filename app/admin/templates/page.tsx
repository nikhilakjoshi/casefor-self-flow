"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trash2, FileText } from "lucide-react"
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
  version: number
  active: boolean
  createdAt: string
  applicationType: AppType
}

const TYPE_LABELS: Record<string, string> = {
  PERSONAL_STATEMENT: "Personal Statement",
  RECOMMENDATION_LETTER: "Recommendation Letter",
  PETITION: "Petition",
  USCIS_FORM: "USCIS Form",
  OTHER: "Other",
}

export default function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)

  const didFetch = useRef(false)
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/templates")
      if (res.ok) {
        setTemplates(await res.json())
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (didFetch.current) return
    didFetch.current = true
    fetchTemplates()
  }, [fetchTemplates])

  const deleteTemplate = async (id: string) => {
    const res = await fetch(`/api/admin/templates/${id}`, { method: "DELETE" })
    if (res.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== id))
    }
  }

  const toggleActive = async (t: Template) => {
    const res = await fetch(`/api/admin/templates/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !t.active }),
    })
    if (res.ok) {
      const updated = await res.json()
      setTemplates((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      )
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold mb-6">Templates</h1>
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold mb-6">Templates</h1>

      {templates.length > 0 ? (
        <div className="rounded-lg border border-stone-200 dark:border-stone-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 dark:border-stone-800 bg-muted/50">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Application Type</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground w-16">Ver</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground w-20">Active</th>
                <th className="px-3 py-2 w-24" />
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr
                  key={t.id}
                  className="border-b last:border-b-0 border-stone-200 dark:border-stone-800"
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/templates/${t.id}`}
                      className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5"
                    >
                      <FileText className="size-3.5 shrink-0" />
                      {t.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary" className="text-xs">
                      {TYPE_LABELS[t.type] || t.type}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {t.applicationType.name}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    v{t.version}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleActive(t)}
                      className={`inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        t.active
                          ? "bg-emerald-500"
                          : "bg-stone-300 dark:bg-stone-600"
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                          t.active ? "translate-x-4" : "translate-x-0.5"
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
                        onClick={() => deleteTemplate(t.id)}
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
          No templates found. Run the seed script to populate templates.
        </p>
      )}
    </div>
  )
}
