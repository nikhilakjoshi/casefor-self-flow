"use client"

import { useEffect, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import {
  FolderOpen,
  Plus,
  Clock,
  FileText,
  ArrowRight,
} from "lucide-react"

interface CaseItem {
  id: string
  name: string | null
  status: string
  createdAt: string
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const [cases, setCases] = useState<CaseItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCases = useCallback(async () => {
    if (!session?.user) return
    try {
      const res = await fetch("/api/cases")
      if (res.ok) {
        const data = await res.json()
        setCases(data.cases || [])
      }
    } catch (err) {
      console.error("Failed to fetch cases:", err)
    } finally {
      setLoading(false)
    }
  }, [session?.user])

  useEffect(() => {
    fetchCases()
  }, [fetchCases])

  const userName = session?.user?.name?.split(" ")[0] || "there"

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center border-b border-stone-200 dark:border-stone-800">
          <div className="flex flex-1 items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <span className="text-sm font-medium text-stone-600 dark:text-stone-400">
              Dashboard
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          <div className="p-6 max-w-5xl space-y-8">
            {/* Welcome */}
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Welcome back, {userName}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage your EB-1A immigration cases
              </p>
            </div>

            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-card p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                    <FolderOpen className="size-5 text-muted-foreground" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">
                    Total Cases
                  </span>
                </div>
                <p className="text-3xl font-semibold">
                  {loading ? "-" : cases.length}
                </p>
              </div>
              <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-card p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                    <Clock className="size-5 text-muted-foreground" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">
                    In Progress
                  </span>
                </div>
                <p className="text-3xl font-semibold">
                  {loading
                    ? "-"
                    : cases.filter(
                        (c) =>
                          c.status === "DRAFT" || c.status === "IN_PROGRESS"
                      ).length}
                </p>
              </div>
              <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-card p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                    <FileText className="size-5 text-muted-foreground" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">
                    Completed
                  </span>
                </div>
                <p className="text-3xl font-semibold">
                  {loading
                    ? "-"
                    : cases.filter((c) => c.status === "COMPLETED").length}
                </p>
              </div>
            </div>

            {/* Cases List */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-foreground">
                  Your Cases
                </h2>
                <Button asChild size="sm">
                  <Link href="/onboard">
                    <Plus className="size-4 mr-1.5" />
                    New Case
                  </Link>
                </Button>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-stone-200 dark:border-stone-800 bg-card p-5 animate-pulse"
                    >
                      <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                      <div className="h-3 bg-muted rounded w-1/4" />
                    </div>
                  ))}
                </div>
              ) : cases.length === 0 ? (
                <div className="rounded-xl border border-dashed border-stone-300 dark:border-stone-700 bg-muted/30 p-12 text-center">
                  <div className="flex size-12 items-center justify-center rounded-lg bg-muted mx-auto mb-4">
                    <FolderOpen className="size-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-sm font-medium text-foreground mb-1">
                    No cases yet
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Start building your EB-1A petition
                  </p>
                  <Button asChild>
                    <Link href="/onboard">
                      <Plus className="size-4 mr-1.5" />
                      Create your first case
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {cases.map((c) => (
                    <Link
                      key={c.id}
                      href={`/case/${c.id}`}
                      className="group flex items-center justify-between rounded-xl border border-stone-200 dark:border-stone-800 bg-card p-5 hover:border-stone-300 dark:hover:border-stone-700 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-muted shrink-0">
                          <FolderOpen className="size-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {c.name || `Case ${c.id.slice(-6)}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(c.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-medium text-muted-foreground px-2 py-1 rounded-md bg-muted">
                          {c.status.toLowerCase().replace("_", " ")}
                        </span>
                        <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
