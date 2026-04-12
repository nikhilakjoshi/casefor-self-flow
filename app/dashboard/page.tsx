"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Search,
  Bell,
  Plus,
  FileText,
  FolderOpen,
  MessageSquare,
  Edit3,
  ArrowRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ----- types returned by /api/dashboard -----

interface Stats {
  activeCases: number
  totalCases: number
  strongCriteria: number
  draftDocs: number
  needsAttention: number
  packageReady: number
}

interface CaseRow {
  id: string
  name: string
  shortId: string
  status: string
  intakeStatus: string
  strongCount: number
  weakCount: number
  threshold: number
  denialPct: number | null
  updatedAt: string
  createdAt: string
}

interface Milestone {
  caseId: string
  caseName: string
  priority: string
  issue: string
  criterion: string
  timeline: string
}

type CriteriaCoverage = Record<
  string,
  { strong: number; weak: number; none: number }
>

interface ActionItem {
  caseId: string
  caseName: string
  action: string
  detail: string
  priority: "HIGH" | "MEDIUM" | "LOW"
}

interface ActivityItem {
  kind: "case" | "document"
  caseId: string
  caseName: string
  text: string
  timestamp: string
}

interface ReadinessRow {
  label: string
  value: number
  total: number | null
  pct: number | null
}

interface DashboardData {
  stats: Stats
  casesTable: CaseRow[]
  topMilestones: Milestone[]
  criteriaCoverage: CriteriaCoverage
  actionItems: ActionItem[]
  recentActivity: ActivityItem[]
  readiness: ReadinessRow[]
}

// ----- helpers -----

function formatShortDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatDay(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("en-US", { day: "2-digit" })
}

function formatMonth(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("en-US", { month: "short" }).toUpperCase()
}

function formatRelative(iso: string): string {
  const d = new Date(iso)
  const diffMin = (Date.now() - d.getTime()) / 60000
  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${Math.floor(diffMin)} min ago`
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)} hr ago`
  const days = Math.floor(diffMin / 1440)
  if (days === 1) return "yesterday"
  if (days < 7) return `${days} days ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function statusPillClasses(status: string): { bg: string; fg: string; label: string } {
  switch (status) {
    case "ACTIVE":
      return { bg: "var(--green-bg)", fg: "var(--green-ok)", label: "Active" }
    case "EVIDENCE":
      return { bg: "var(--amber-bg)", fg: "var(--amber-warn)", label: "Evidence" }
    case "SCREENING":
      return { bg: "var(--blue-bg)", fg: "var(--blue-info)", label: "Screening" }
    case "CLOSED":
      return { bg: "var(--cream)", fg: "var(--ash)", label: "Closed" }
    default:
      return { bg: "var(--cream)", fg: "var(--ash)", label: status.toLowerCase() }
  }
}

function timeOfDay(): string {
  const h = new Date().getHours()
  if (h < 12) return "morning"
  if (h < 18) return "afternoon"
  return "evening"
}

// Criteria labels — shown on the coverage chart. Keep short.
const CRITERIA_LABELS: Record<string, string> = {
  C1: "Awards",
  C2: "Membership",
  C3: "Press",
  C4: "Judging",
  C5: "Original",
  C6: "Scholarly",
  C7: "Artistic",
  C8: "Leading role",
  C9: "High salary",
  C10: "Commercial",
}

// -----------------------------------------------------------------------------

export default function DashboardPage() {
  const { data: session } = useSession()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    if (!session?.user) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/dashboard")
        if (!res.ok) return
        const json = (await res.json()) as DashboardData
        if (!cancelled) setData(json)
      } catch (err) {
        console.error("dashboard fetch error:", err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [session?.user])

  const firstName = session?.user?.name?.split(" ")[0] || "there"
  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  const filteredCases = useMemo(() => {
    if (!data) return []
    if (!search.trim()) return data.casesTable
    const q = search.toLowerCase()
    return data.casesTable.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.shortId.toLowerCase().includes(q),
    )
  }, [data, search])

  const attentionSentence =
    data && data.stats.needsAttention > 0
      ? `${data.stats.needsAttention} case${data.stats.needsAttention === 1 ? "" : "s"} need${data.stats.needsAttention === 1 ? "s" : ""} attention today`
      : data && data.stats.activeCases === 0
        ? "start your first petition"
        : "all cases on track"

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AppSidebar />
      <SidebarInset className="flex flex-col overflow-hidden">
        <header className="flex h-12 shrink-0 items-center border-b border-[var(--cream)]">
          <div className="flex flex-1 items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <span className="font-serif text-[1.05rem] font-medium tracking-[-0.01em] text-[var(--ink)]">
              Dashboard
            </span>
          </div>
        </header>

        <ScrollArea className="flex-1 min-h-0">
          <div className="bg-[var(--parchment)]">
          <div className="mx-auto max-w-[1440px] px-8 py-8 lg:px-14 lg:py-10">
            {/* ---- Page header ---- */}
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-8">
              <div className="min-w-0">
                <h1 className="font-serif text-[2rem] font-medium leading-none tracking-[-0.02em] text-[var(--ink)]">
                  Good {timeOfDay()}, {firstName}
                </h1>
                <p className="mt-2 text-[0.82rem] text-[var(--ash)]">
                  {dateStr} — {attentionSentence}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-2 bg-[var(--warm-white)] border border-[var(--cream)] rounded-[4px] px-3.5 py-2 min-w-[220px] focus-within:border-[var(--accent-gold)] focus-within:shadow-[0_0_0_3px_var(--accent-gold-muted)] transition-all">
                  <Search className="w-[15px] h-[15px] text-[var(--ash)] shrink-0" />
                  <input
                    type="text"
                    placeholder="Search cases..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-transparent outline-none text-[0.82rem] text-[var(--charcoal)] placeholder:text-[var(--stone)]"
                  />
                </div>
                <button
                  className="w-9 h-9 rounded-[4px] border border-[var(--cream)] bg-[var(--warm-white)] flex items-center justify-center hover:bg-[var(--cream)] transition-colors relative"
                  aria-label="Notifications"
                >
                  <Bell className="w-4 h-4 text-[var(--charcoal)]" strokeWidth={1.5} />
                  {data && data.stats.needsAttention > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[var(--red-urgent)]" />
                  )}
                </button>
                <Link
                  href="/onboard"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-[4px] bg-[var(--ink)] text-[var(--parchment)] text-[0.82rem] font-medium hover:bg-[var(--deep-brown)] transition-all hover:shadow-[0_4px_12px_rgba(12,11,10,0.06)]"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                  New Case
                </Link>
              </div>
            </div>

            {/* ---- Stats row ---- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
              <StatCard
                label="Active Cases"
                value={loading ? "—" : String(data?.stats.activeCases ?? 0)}
                sub={
                  data
                    ? data.stats.totalCases === data.stats.activeCases
                      ? "all cases active"
                      : `${data.stats.totalCases - data.stats.activeCases} closed or skipped`
                    : ""
                }
                dotColor="var(--green-ok)"
              />
              <StatCard
                label="Strong Criteria"
                value={loading ? "—" : String(data?.stats.strongCriteria ?? 0)}
                sub={
                  data && data.stats.activeCases > 0
                    ? `${(data.stats.strongCriteria / Math.max(1, data.stats.activeCases)).toFixed(1)} avg per case`
                    : "across your portfolio"
                }
                dotColor="var(--accent-gold)"
              />
              <StatCard
                label="Draft Documents"
                value={loading ? "—" : String(data?.stats.draftDocs ?? 0)}
                sub={
                  data && data.stats.draftDocs > 0
                    ? "in progress"
                    : "no drafts yet"
                }
                dotColor="var(--blue-info)"
              />
              <StatCard
                label="Needs Attention"
                value={loading ? "—" : String(data?.stats.needsAttention ?? 0)}
                sub={
                  data && data.stats.needsAttention > 0
                    ? "intake pending or high risk"
                    : "nothing urgent"
                }
                dotColor="var(--red-urgent)"
              />
            </div>

            {/* ---- Row 1: Cases + Milestones ---- */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 mb-6">
              <Card
                title="Active Cases"
                action={
                  data && data.stats.totalCases > 0 ? (
                    <Link href="/dashboard" className="text-[var(--accent-gold)] hover:text-[var(--accent-gold-light)] transition-colors">
                      View all →
                    </Link>
                  ) : null
                }
              >
                {loading ? (
                  <TableSkeleton />
                ) : filteredCases.length === 0 ? (
                  <EmptyCases />
                ) : (
                  <CasesTable rows={filteredCases} />
                )}
              </Card>

              <Card
                title="Upcoming Milestones"
                action={
                  <Link href="/dashboard" className="text-[var(--accent-gold)] hover:text-[var(--accent-gold-light)] transition-colors">
                    Gap analysis →
                  </Link>
                }
              >
                {loading ? (
                  <ListSkeleton />
                ) : !data || data.topMilestones.length === 0 ? (
                  <EmptyPanel
                    line1="No gap-analysis milestones yet"
                    line2="Run gap analysis on a case to surface timeline items."
                  />
                ) : (
                  <MilestonesList items={data.topMilestones} />
                )}
              </Card>
            </div>

            {/* ---- Row 2: Criteria coverage + Action items ---- */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 mb-6">
              <Card
                title="Criteria Coverage — Portfolio"
                action={
                  <span className="text-[var(--ash)]">
                    Strong across all active cases
                  </span>
                }
              >
                {loading ? (
                  <ListSkeleton />
                ) : !data ||
                  Object.keys(data.criteriaCoverage).length === 0 ? (
                  <EmptyPanel
                    line1="No analyses yet"
                    line2="Criteria coverage builds as you run EB-1A analysis on your cases."
                  />
                ) : (
                  <CriteriaCoverageChart data={data.criteriaCoverage} />
                )}
              </Card>

              <Card
                title="Action Items"
                action={
                  <Link href="/dashboard" className="text-[var(--accent-gold)] hover:text-[var(--accent-gold-light)] transition-colors">
                    All tasks →
                  </Link>
                }
              >
                {loading ? (
                  <ListSkeleton />
                ) : !data || data.actionItems.length === 0 ? (
                  <EmptyPanel
                    line1="No action items"
                    line2="Gap analyses will populate actionable next steps here."
                  />
                ) : (
                  <ActionItemsList items={data.actionItems} />
                )}
              </Card>
            </div>

            {/* ---- Row 3: Activity + Readiness ---- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <Card
                title="Recent Activity"
                action={
                  <span className="text-[var(--ash)]">Last updated first</span>
                }
              >
                {loading ? (
                  <ListSkeleton />
                ) : !data || data.recentActivity.length === 0 ? (
                  <EmptyPanel
                    line1="No activity yet"
                    line2="Case updates and document saves will appear here."
                  />
                ) : (
                  <ActivityFeed items={data.recentActivity} />
                )}
              </Card>

              <Card title="Package Readiness">
                {loading ? (
                  <ListSkeleton />
                ) : !data ? null : (
                  <ReadinessPanel rows={data.readiness} />
                )}
              </Card>
            </div>
          </div>
          </div>
        </ScrollArea>
      </SidebarInset>
    </SidebarProvider>
  )
}

// ----- local components -----

function Card({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="bg-[var(--warm-white)] rounded-[8px] border border-[rgba(12,11,10,0.04)] shadow-[0_1px_3px_rgba(12,11,10,0.04),0_0_0_1px_rgba(12,11,10,0.03)] overflow-hidden">
      <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[rgba(12,11,10,0.04)]">
        <h3 className="font-serif text-[1.15rem] font-medium leading-none tracking-[-0.01em] text-[var(--ink)]">
          {title}
        </h3>
        {action && (
          <div className="text-[0.75rem] font-medium">{action}</div>
        )}
      </div>
      <div>{children}</div>
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  dotColor,
}: {
  label: string
  value: string
  sub: string
  dotColor: string
}) {
  return (
    <div className="bg-[var(--warm-white)] rounded-[8px] border border-[rgba(12,11,10,0.04)] shadow-[0_1px_3px_rgba(12,11,10,0.04),0_0_0_1px_rgba(12,11,10,0.03)] px-6 py-[22px] transition-all hover:shadow-[0_4px_12px_rgba(12,11,10,0.06)] hover:-translate-y-px">
      <div
        className="flex items-center gap-1.5 text-[0.72rem] font-medium uppercase tracking-[0.06em] text-[var(--ash)] mb-2.5"
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: dotColor }}
        />
        {label}
      </div>
      <div className="font-serif text-[2.2rem] font-medium leading-none tracking-[-0.02em] text-[var(--ink)] tabular-nums">
        {value}
      </div>
      <div className="mt-2 text-[0.75rem] text-[var(--ash)]">{sub}</div>
    </div>
  )
}

function CasesTable({ rows }: { rows: CaseRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {["Case", "Strong", "Status", "Risk", "Updated"].map((h) => (
              <th
                key={h}
                className="text-left px-6 py-3.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--ash)] bg-[var(--parchment)] border-b border-[rgba(12,11,10,0.06)] whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const pill = statusPillClasses(c.status)
            const riskColor =
              c.denialPct === null
                ? "var(--ash)"
                : c.denialPct >= 60
                  ? "var(--red-urgent)"
                  : c.denialPct >= 30
                    ? "var(--amber-warn)"
                    : "var(--green-ok)"
            return (
              <tr
                key={c.id}
                className="border-b border-[rgba(12,11,10,0.03)] last:border-b-0 hover:bg-[var(--accent-gold-subtle)] transition-colors cursor-pointer"
                onClick={() => {
                  window.location.href = `/case/${c.id}`
                }}
              >
                <td className="px-6 py-4 align-middle">
                  <div className="text-[0.87rem] font-medium text-[var(--ink)] truncate max-w-[260px]">
                    {c.name}
                  </div>
                  <div className="font-mono text-[0.7rem] text-[var(--ash)] tabular-nums mt-0.5">
                    CASE-{c.shortId}
                  </div>
                </td>
                <td className="px-6 py-4 align-middle">
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-[1.05rem] font-medium text-[var(--ink)] tabular-nums">
                      {c.strongCount}
                    </span>
                    <span className="text-[0.7rem] text-[var(--ash)]">
                      / {c.threshold}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 align-middle">
                  <span
                    className="inline-flex items-center gap-1.5 text-[0.72rem] font-medium px-2.5 py-1 rounded-full"
                    style={{ background: pill.bg, color: pill.fg }}
                  >
                    <span
                      className="w-1 h-1 rounded-full"
                      style={{ background: pill.fg }}
                    />
                    {pill.label}
                  </span>
                </td>
                <td className="px-6 py-4 align-middle font-mono text-[0.78rem] tabular-nums" style={{ color: riskColor }}>
                  {c.denialPct === null ? "—" : `${c.denialPct}%`}
                </td>
                <td className="px-6 py-4 align-middle font-mono text-[0.78rem] text-[var(--ash)] tabular-nums whitespace-nowrap">
                  {formatShortDate(c.updatedAt)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function MilestonesList({ items }: { items: Milestone[] }) {
  return (
    <div className="px-1 py-1">
      {items.map((m, i) => {
        const isUrgent = m.priority === "HIGH"
        return (
          <Link
            key={i}
            href={`/case/${m.caseId}?subtab=planning`}
            className="flex items-start gap-4 px-5 py-4 border-b border-[rgba(12,11,10,0.03)] last:border-b-0 hover:bg-[var(--accent-gold-subtle)] transition-colors"
          >
            <div
              className={cn(
                "shrink-0 w-12 h-[52px] bg-[var(--parchment)] border rounded-[4px] flex flex-col items-center justify-center",
                isUrgent
                  ? "border-[rgba(166,61,47,0.3)]"
                  : "border-[rgba(12,11,10,0.04)]",
              )}
            >
              <span
                className={cn(
                  "font-serif text-[1.3rem] font-medium leading-none",
                  isUrgent ? "text-[var(--red-urgent)]" : "text-[var(--ink)]",
                )}
              >
                {m.priority === "HIGH" ? "!" : m.criterion.slice(0, 3) || "—"}
              </span>
              <span
                className={cn(
                  "text-[0.62rem] font-medium uppercase tracking-[0.08em] mt-0.5",
                  isUrgent ? "text-[var(--red-urgent)]" : "text-[var(--ash)]",
                )}
              >
                {m.priority.slice(0, 3)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[0.84rem] font-medium text-[var(--ink)] truncate">
                {m.issue}
              </div>
              <div className="text-[0.72rem] text-[var(--ash)] mt-1 truncate">
                {m.caseName} · {m.timeline}
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function CriteriaCoverageChart({ data }: { data: CriteriaCoverage }) {
  const keys = Object.keys(CRITERIA_LABELS)
  const max = Math.max(
    1,
    ...keys.map((k) => {
      const d = data[k]
      if (!d) return 0
      return d.strong + d.weak + d.none
    }),
  )
  return (
    <div className="px-6 py-5 space-y-2.5">
      {keys.map((k) => {
        const d = data[k] ?? { strong: 0, weak: 0, none: 0 }
        const total = d.strong + d.weak + d.none
        const strongPct = total > 0 ? (d.strong / max) * 100 : 0
        const weakPct = total > 0 ? (d.weak / max) * 100 : 0
        return (
          <div key={k} className="flex items-center gap-3">
            <div className="w-[84px] shrink-0 text-[0.72rem] text-[var(--ash)] flex items-center gap-1.5">
              <span className="font-mono tabular-nums text-[0.68rem] text-[var(--stone)]">
                {k}
              </span>
              <span>{CRITERIA_LABELS[k]}</span>
            </div>
            <div className="flex-1 h-[18px] bg-[var(--parchment)] rounded-[3px] overflow-hidden relative">
              <div
                className="absolute inset-y-0 left-0 rounded-[3px] transition-all duration-1000"
                style={{
                  width: `${strongPct}%`,
                  background:
                    "linear-gradient(90deg, var(--accent-gold), var(--accent-gold-light))",
                }}
              />
              <div
                className="absolute inset-y-0 rounded-[3px] bg-[var(--cream)]"
                style={{ left: `${strongPct}%`, width: `${weakPct}%` }}
              />
            </div>
            <div className="w-16 shrink-0 text-right font-mono text-[0.72rem] tabular-nums text-[var(--charcoal)]">
              {d.strong}
              <span className="text-[var(--ash)]">/{total || 0}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ActionItemsList({ items }: { items: ActionItem[] }) {
  return (
    <div className="px-1 py-1">
      {items.map((a, i) => {
        const priorityColor =
          a.priority === "HIGH"
            ? "var(--red-urgent)"
            : a.priority === "MEDIUM"
              ? "var(--amber-warn)"
              : "var(--green-ok)"
        return (
          <Link
            key={i}
            href={`/case/${a.caseId}?subtab=planning`}
            className="flex items-start gap-3 px-5 py-3 border-b border-[rgba(12,11,10,0.03)] last:border-b-0 hover:bg-[var(--accent-gold-subtle)] transition-colors"
          >
            <div className="shrink-0 w-4 h-4 mt-0.5 rounded-full border-2 border-[var(--stone)]" />
            <div className="flex-1 min-w-0">
              <div className="text-[0.82rem] text-[var(--ink)] truncate">
                {a.action}
              </div>
              <div className="text-[0.7rem] text-[var(--ash)] mt-0.5 truncate">
                {a.caseName} · {a.detail}
              </div>
            </div>
            <div
              className="shrink-0 w-2 h-2 rounded-full mt-1.5"
              style={{ background: priorityColor }}
            />
          </Link>
        )
      })}
    </div>
  )
}

function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <div className="px-1 py-1">
      {items.map((a, i) => {
        const Icon = a.kind === "case" ? FolderOpen : a.text.startsWith("Drafted") ? Edit3 : FileText
        const iconBg =
          a.kind === "case" ? "var(--accent-gold-muted)" : "var(--blue-bg)"
        const iconColor =
          a.kind === "case" ? "var(--accent-gold)" : "var(--blue-info)"
        return (
          <Link
            key={i}
            href={`/case/${a.caseId}`}
            className="flex items-start gap-3 px-5 py-3 border-b border-[rgba(12,11,10,0.03)] last:border-b-0 hover:bg-[var(--accent-gold-subtle)] transition-colors"
          >
            <div
              className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: iconBg, color: iconColor }}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[0.82rem] text-[var(--charcoal)] truncate">
                {a.text} in{" "}
                <span className="text-[var(--ink)] font-medium">
                  {a.caseName}
                </span>
              </div>
              <div className="text-[0.7rem] text-[var(--stone)] mt-0.5 font-mono tabular-nums">
                {formatRelative(a.timestamp)}
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function ReadinessPanel({ rows }: { rows: ReadinessRow[] }) {
  return (
    <div className="px-1 py-1">
      {rows.map((r, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-[rgba(12,11,10,0.03)] last:border-b-0"
        >
          <div className="text-[0.78rem] text-[var(--ash)]">{r.label}</div>
          <div className="flex items-center gap-3 shrink-0">
            {r.pct !== null && (
              <div className="w-[120px] h-1.5 bg-[var(--cream)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${r.pct}%`,
                    background:
                      "linear-gradient(90deg, var(--accent-gold), var(--green-ok))",
                  }}
                />
              </div>
            )}
            <div className="font-mono text-[0.82rem] font-medium text-[var(--ink)] tabular-nums text-right min-w-[56px]">
              {r.total !== null ? `${r.value}/${r.total}` : r.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="p-6 space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-12 bg-[var(--parchment)] rounded animate-pulse"
        />
      ))}
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="p-6 space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-10 bg-[var(--parchment)] rounded animate-pulse"
        />
      ))}
    </div>
  )
}

function EmptyCases() {
  return (
    <div className="px-6 py-14 flex flex-col items-center text-center">
      <div className="w-12 h-12 rounded-full bg-[var(--parchment)] border border-[var(--cream)] flex items-center justify-center mb-4">
        <FolderOpen className="w-5 h-5 text-[var(--ash)]" strokeWidth={1.5} />
      </div>
      <h3 className="font-serif text-[1.15rem] font-medium text-[var(--ink)] mb-1">
        No active cases yet
      </h3>
      <p className="text-[0.82rem] text-[var(--ash)] mb-5">
        Start building an EB-1A petition to populate this dashboard.
      </p>
      <Link
        href="/onboard"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-[4px] bg-[var(--ink)] text-[var(--parchment)] text-[0.82rem] font-medium hover:bg-[var(--deep-brown)] transition-all"
      >
        <Plus className="w-3.5 h-3.5" strokeWidth={2} />
        Create your first case
      </Link>
    </div>
  )
}

function EmptyPanel({ line1, line2 }: { line1: string; line2: string }) {
  return (
    <div className="px-6 py-12 flex flex-col items-center text-center">
      <div className="w-9 h-9 rounded-full bg-[var(--parchment)] border border-[var(--cream)] flex items-center justify-center mb-3">
        <MessageSquare className="w-4 h-4 text-[var(--ash)]" strokeWidth={1.5} />
      </div>
      <div className="text-[0.87rem] font-medium text-[var(--charcoal)]">
        {line1}
      </div>
      <div className="text-[0.75rem] text-[var(--ash)] mt-1 max-w-[260px]">
        {line2}
      </div>
    </div>
  )
}
