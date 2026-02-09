"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import type { DetailedExtraction } from "@/lib/eb1a-extraction-schema"
import { CRITERIA_METADATA } from "@/lib/eb1a-extraction-schema"
import {
  ChevronDown,
  ChevronRight,
  User,
  GraduationCap,
  Briefcase,
  FileText,
  Award,
  ScrollText,
  Users,
  Newspaper,
  Scale,
  Mic,
  DollarSign,
  Building,
  Palette,
  TrendingUp,
  Lightbulb,
  ClipboardList,
  AlignLeft,
  Banknote,
} from "lucide-react"

function Section({
  title,
  icon: Icon,
  count,
  children,
  defaultOpen,
}: {
  title: string
  icon: React.ElementType
  count: number
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen ?? count > 0)

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-muted/50 hover:bg-muted transition-colors text-left"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
        <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="flex-1 text-sm font-medium">{title}</span>
        <span
          className={cn(
            "text-xs px-1.5 py-0.5 rounded",
            count > 0
              ? "bg-background text-muted-foreground"
              : "bg-muted text-muted-foreground/50"
          )}
        >
          {count}
        </span>
      </button>
      {open && <div className="p-3 space-y-2 bg-background">{children}</div>}
    </div>
  )
}

function KV({ label, value }: { label: string; value?: string | number | boolean | null }) {
  if (value == null || value === "") return null
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-muted-foreground shrink-0 w-28">{label}</span>
      <span className="text-foreground break-words min-w-0">
        {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}
      </span>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-2 rounded border border-border bg-muted/30 space-y-1">
      {children}
    </div>
  )
}

function SourceTag({ source }: { source?: "extracted" | "survey" }) {
  if (!source) return null
  return (
    <span
      className={cn(
        "text-[10px] px-1.5 py-0.5 rounded font-medium",
        source === "survey"
          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
          : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400"
      )}
    >
      {source === "survey" ? "Survey" : "Resume"}
    </span>
  )
}

export function ExtractionRawPanel({
  extraction,
}: {
  extraction: DetailedExtraction | null
}) {
  if (!extraction) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center text-muted-foreground">
          <p className="text-sm">No extraction data</p>
        </div>
      </div>
    )
  }

  const pi = extraction.personal_info

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {/* Personal Info */}
        <Section title="Personal Info" icon={User} count={pi ? 1 : 0}>
          {pi && (
            <Card>
              <KV label="Name" value={pi.name} />
              <KV label="Email" value={pi.email} />
              <KV label="Phone" value={pi.phone} />
              <KV label="LinkedIn" value={pi.linkedin} />
              <KV label="Title" value={pi.current_title} />
              <KV label="Organization" value={pi.current_organization} />
              <KV label="Field" value={pi.field} />
              <KV label="Years Exp" value={pi.years_experience} />
              <SourceTag source={pi.source} />
            </Card>
          )}
        </Section>

        {/* Education */}
        <Section title="Education" icon={GraduationCap} count={extraction.education.length}>
          {extraction.education.map((ed, i) => (
            <Card key={i}>
              <KV label="Degree" value={ed.degree} />
              <KV label="Field" value={ed.field} />
              <KV label="Institution" value={ed.institution} />
              <KV label="Year" value={ed.year} />
              <SourceTag source={ed.source} />
            </Card>
          ))}
        </Section>

        {/* Work Experience */}
        <Section title="Work Experience" icon={Briefcase} count={extraction.work_experience.length}>
          {extraction.work_experience.map((w, i) => (
            <Card key={i}>
              <KV label="Title" value={w.title} />
              <KV label="Organization" value={w.organization} />
              <KV label="Start Year" value={w.start_year} />
              <KV label="End Year" value={w.end_year} />
              <KV label="Description" value={w.description} />
              <SourceTag source={w.source} />
            </Card>
          ))}
        </Section>

        {/* Publications */}
        <Section title="Publications" icon={FileText} count={extraction.publications.length}>
          {extraction.publications.map((pub, i) => (
            <Card key={i}>
              <KV label="Title" value={pub.title} />
              <KV label="Venue" value={pub.venue} />
              <KV label="Venue Tier" value={pub.venue_tier} />
              <KV label="Year" value={pub.year} />
              <KV label="Citations" value={pub.citations} />
              <KV label="DOI" value={pub.doi} />
              {pub.authors && pub.authors.length > 0 && (
                <KV label="Authors" value={pub.authors.join(", ")} />
              )}
              <SourceTag source={pub.source} />
            </Card>
          ))}
        </Section>

        {/* Awards */}
        <Section title="Awards" icon={Award} count={extraction.awards.length}>
          {extraction.awards.map((a, i) => (
            <Card key={i}>
              <KV label="Name" value={a.name} />
              <KV label="Issuer" value={a.issuer} />
              <KV label="Year" value={a.year} />
              <KV label="Scope" value={a.scope} />
              <KV label="Description" value={a.description} />
              <SourceTag source={a.source} />
            </Card>
          ))}
        </Section>

        {/* Patents */}
        <Section title="Patents" icon={ScrollText} count={extraction.patents.length}>
          {extraction.patents.map((p, i) => (
            <Card key={i}>
              <KV label="Title" value={p.title} />
              <KV label="Number" value={p.number} />
              <KV label="Status" value={p.status} />
              <KV label="Year" value={p.year} />
              {p.inventors && p.inventors.length > 0 && (
                <KV label="Inventors" value={p.inventors.join(", ")} />
              )}
              <SourceTag source={p.source} />
            </Card>
          ))}
        </Section>

        {/* Memberships */}
        <Section title="Memberships" icon={Users} count={extraction.memberships.length}>
          {extraction.memberships.map((m, i) => (
            <Card key={i}>
              <KV label="Organization" value={m.organization} />
              <KV label="Role" value={m.role} />
              <KV label="Selectivity" value={m.selectivity_evidence} />
              <KV label="Year Joined" value={m.year_joined} />
              <SourceTag source={m.source} />
            </Card>
          ))}
        </Section>

        {/* Media Coverage */}
        <Section title="Media Coverage" icon={Newspaper} count={extraction.media_coverage.length}>
          {extraction.media_coverage.map((mc, i) => (
            <Card key={i}>
              <KV label="Outlet" value={mc.outlet} />
              <KV label="Title" value={mc.title} />
              <KV label="Date" value={mc.date} />
              <KV label="About Person" value={mc.about_the_person} />
              <KV label="URL" value={mc.url} />
              <SourceTag source={mc.source} />
            </Card>
          ))}
        </Section>

        {/* Judging Activities */}
        <Section title="Judging Activities" icon={Scale} count={extraction.judging_activities.length}>
          {extraction.judging_activities.map((j, i) => (
            <Card key={i}>
              <KV label="Type" value={j.type.replace(/_/g, " ")} />
              <KV label="Organization" value={j.organization} />
              <KV label="Venue" value={j.venue} />
              <KV label="Description" value={j.description} />
              <KV label="Year" value={j.year} />
              <SourceTag source={j.source} />
            </Card>
          ))}
        </Section>

        {/* Speaking Engagements */}
        <Section title="Speaking Engagements" icon={Mic} count={extraction.speaking_engagements.length}>
          {extraction.speaking_engagements.map((s, i) => (
            <Card key={i}>
              <KV label="Event" value={s.event} />
              <KV label="Type" value={s.type} />
              <KV label="Location" value={s.location} />
              <KV label="Year" value={s.year} />
              <KV label="Description" value={s.description} />
              <SourceTag source={s.source} />
            </Card>
          ))}
        </Section>

        {/* Grants */}
        <Section title="Grants" icon={DollarSign} count={extraction.grants.length}>
          {extraction.grants.map((g, i) => (
            <Card key={i}>
              <KV label="Title" value={g.title} />
              <KV label="Funder" value={g.funder} />
              <KV label="Amount" value={g.amount != null ? `${g.currency ?? "$"}${g.amount.toLocaleString()}` : undefined} />
              <KV label="Role" value={g.role} />
              <KV label="Year" value={g.year} />
              <SourceTag source={g.source} />
            </Card>
          ))}
        </Section>

        {/* Leadership Roles */}
        <Section title="Leadership Roles" icon={Building} count={extraction.leadership_roles.length}>
          {extraction.leadership_roles.map((lr, i) => (
            <Card key={i}>
              <KV label="Title" value={lr.title} />
              <KV label="Organization" value={lr.organization} />
              <KV label="Distinction" value={lr.distinction} />
              <KV label="Start Year" value={lr.start_year} />
              <KV label="End Year" value={lr.end_year} />
              <KV label="Description" value={lr.description} />
              <SourceTag source={lr.source} />
            </Card>
          ))}
        </Section>

        {/* Compensation */}
        <Section title="Compensation" icon={Banknote} count={extraction.compensation.length}>
          {extraction.compensation.map((c, i) => (
            <Card key={i}>
              <KV label="Amount" value={c.amount != null ? `${c.currency ?? "$"}${c.amount.toLocaleString()}` : undefined} />
              <KV label="Period" value={c.period} />
              <KV label="Context" value={c.context} />
              <KV label="Comparison" value={c.comparison} />
              <SourceTag source={c.source} />
            </Card>
          ))}
        </Section>

        {/* Exhibitions */}
        <Section title="Exhibitions" icon={Palette} count={extraction.exhibitions.length}>
          {extraction.exhibitions.map((ex, i) => (
            <Card key={i}>
              <KV label="Venue" value={ex.venue} />
              <KV label="Title" value={ex.title} />
              <KV label="Type" value={ex.type} />
              <KV label="Year" value={ex.year} />
              <KV label="Location" value={ex.location} />
              <SourceTag source={ex.source} />
            </Card>
          ))}
        </Section>

        {/* Commercial Success */}
        <Section title="Commercial Success" icon={TrendingUp} count={extraction.commercial_success.length}>
          {extraction.commercial_success.map((cs, i) => (
            <Card key={i}>
              <KV label="Description" value={cs.description} />
              <KV label="Metrics" value={cs.metrics} />
              <KV label="Revenue" value={cs.revenue != null ? `${cs.currency ?? "$"}${cs.revenue.toLocaleString()}` : undefined} />
              <SourceTag source={cs.source} />
            </Card>
          ))}
        </Section>

        {/* Original Contributions */}
        <Section title="Original Contributions" icon={Lightbulb} count={extraction.original_contributions.length}>
          {extraction.original_contributions.map((oc, i) => (
            <Card key={i}>
              <KV label="Description" value={oc.description} />
              <KV label="Impact" value={oc.impact} />
              <KV label="Evidence" value={oc.evidence} />
              <SourceTag source={oc.source} />
            </Card>
          ))}
        </Section>

        {/* Criteria Summary */}
        <Section title="Criteria Summary" icon={ClipboardList} count={extraction.criteria_summary.length}>
          {extraction.criteria_summary.map((cs, i) => (
            <Card key={i}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium">{cs.criterion_id}</span>
                <span className="text-[10px] text-muted-foreground">
                  {CRITERIA_METADATA[cs.criterion_id]?.name}
                </span>
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded font-medium ml-auto",
                    cs.strength === "Strong" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
                    cs.strength === "Weak" && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
                    cs.strength === "None" && "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-500"
                  )}
                >
                  {cs.strength}
                </span>
              </div>
              <KV label="Evidence Count" value={cs.evidence_count} />
              <p className="text-xs text-muted-foreground mt-1">{cs.summary}</p>
              {cs.key_evidence.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {cs.key_evidence.map((ev, j) => (
                    <p key={j} className="text-[11px] text-foreground/80 pl-2 border-l border-border">
                      {ev}
                    </p>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </Section>

        {/* Extracted Text */}
        <Section title="Extracted Text" icon={AlignLeft} count={extraction.extracted_text ? 1 : 0} defaultOpen={false}>
          {extraction.extracted_text && (
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words font-mono bg-muted/50 p-3 rounded border border-border max-h-96 overflow-y-auto">
              {extraction.extracted_text}
            </pre>
          )}
        </Section>
      </div>
    </div>
  )
}
