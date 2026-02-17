"use client";

import { useState, useEffect, useRef } from "react";
import type { DetailedExtraction } from "@/lib/eb1a-extraction-schema";
import { cn } from "@/lib/utils";

interface ExtractionProgressPanelProps {
  extraction: Partial<DetailedExtraction>;
  isStreaming: boolean;
  streamPhase?: "connecting" | "extracting" | null;
}

const SECTIONS: { key: keyof DetailedExtraction; label: string }[] = [
  { key: "personal_info", label: "Profile" },
  { key: "education", label: "Education" },
  { key: "work_experience", label: "Experience" },
  { key: "publications", label: "Publications" },
  { key: "awards", label: "Awards" },
  { key: "patents", label: "Patents" },
  { key: "memberships", label: "Memberships" },
  { key: "media_coverage", label: "Media" },
  { key: "judging_activities", label: "Judging" },
  { key: "speaking_engagements", label: "Speaking" },
  { key: "grants", label: "Grants" },
  { key: "leadership_roles", label: "Leadership" },
  { key: "compensation", label: "Compensation" },
  { key: "exhibitions", label: "Exhibitions" },
  { key: "commercial_success", label: "Commercial" },
  { key: "original_contributions", label: "Contributions" },
  { key: "criteria_summary", label: "Evaluations" },
];

const MAX_VISIBLE_ITEMS = 5;

function truncate(s: string, max = 60): string {
  if (!s || s.length <= max) return s || "";
  return s.slice(0, max) + "...";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getItemSummary(key: keyof DetailedExtraction, item: any): string {
  switch (key) {
    case "personal_info": {
      const parts: string[] = [];
      if (item.name) parts.push(item.name);
      if (item.current_title) {
        let s = item.current_title;
        if (item.current_organization) s += ` at ${item.current_organization}`;
        parts.push(s);
      }
      return parts.join(" - ") || "...";
    }
    case "education":
      return truncate(
        [item.degree, item.institution].filter(Boolean).join(", ")
      );
    case "work_experience":
      return truncate(
        [item.title, item.organization].filter(Boolean).join(" at ")
      );
    case "publications":
      return truncate(item.title || "...");
    case "awards":
      return truncate(item.name || "...");
    case "patents":
      return truncate(item.title || "...");
    case "memberships":
      return truncate(item.organization || "...");
    case "media_coverage":
      return truncate(
        [item.outlet, item.title].filter(Boolean).join(": ")
      );
    case "judging_activities":
      return truncate(
        [item.type, item.organization].filter(Boolean).join(" - ")
      );
    case "speaking_engagements":
      return truncate(item.event || "...");
    case "grants":
      return truncate(item.title || "...");
    case "leadership_roles":
      return truncate(
        [item.title, item.organization].filter(Boolean).join(" at ")
      );
    case "compensation":
      return truncate(item.context || "...");
    case "exhibitions":
      return truncate(
        [item.venue, item.title].filter(Boolean).join(": ")
      );
    case "commercial_success":
      return truncate(item.description || "...");
    case "original_contributions":
      return truncate(item.description || "...");
    case "criteria_summary":
      return truncate(
        [item.criterion_id, item.strength].filter(Boolean).join(": ")
      );
    default:
      return "...";
  }
}

function getItems(
  extraction: Partial<DetailedExtraction>,
  key: keyof DetailedExtraction
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
  const val = extraction[key];
  if (val === undefined || val === null) return [];
  if (key === "personal_info") return val ? [val] : [];
  if (Array.isArray(val)) return val;
  return [];
}

function getCount(extraction: Partial<DetailedExtraction>, key: keyof DetailedExtraction): number {
  const val = extraction[key];
  if (val === undefined || val === null) return -1;
  if (key === "personal_info") return val ? 1 : 0;
  if (Array.isArray(val)) return val.length;
  return 0;
}

function SectionRow({
  sectionKey,
  label,
  extraction,
  isStreaming,
  isActiveFrontier,
}: {
  sectionKey: keyof DetailedExtraction;
  label: string;
  extraction: Partial<DetailedExtraction>;
  isStreaming: boolean;
  isActiveFrontier: boolean;
}) {
  const count = getCount(extraction, sectionKey);
  const isPopulated = count > 0;
  const isPending = isActiveFrontier;
  const isQueued = count === -1 && isStreaming && !isActiveFrontier;
  const isZero = count === 0 || (count === -1 && !isStreaming);

  const items = getItems(extraction, sectionKey);
  const [expanded, setExpanded] = useState(false);
  const prevCountRef = useRef(0);

  // Auto-expand when new items arrive during streaming
  useEffect(() => {
    if (isStreaming && items.length > prevCountRef.current && items.length > 0) {
      setExpanded(true);
    }
    prevCountRef.current = items.length;
  }, [items.length, isStreaming]);

  const visibleItems = items.slice(0, MAX_VISIBLE_ITEMS);
  const hiddenCount = items.length - MAX_VISIBLE_ITEMS;

  return (
    <div>
      <button
        type="button"
        onClick={() => isPopulated && setExpanded((e) => !e)}
        className={cn(
          "flex items-center justify-between gap-2 py-1 w-full text-left",
          isPopulated && "cursor-pointer hover:bg-muted/50 -mx-1 px-1 rounded"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isPopulated && (
            <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {isPending && (
            <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
          )}
          {isQueued && (
            <span className="w-3.5 h-3.5 shrink-0" />
          )}
          {isZero && (
            <span className="w-3.5 h-3.5 flex items-center justify-center text-muted-foreground shrink-0">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14" strokeLinecap="round" />
              </svg>
            </span>
          )}
          <span className={cn(
            "text-xs truncate",
            isPopulated ? "text-foreground font-medium" : isPending ? "text-foreground" : "text-muted-foreground"
          )}>
            {label}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isPopulated && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 tabular-nums">
              {sectionKey === "criteria_summary" ? `${count}/10` : count}
            </span>
          )}
          {isPopulated && (
            <svg
              className={cn(
                "w-3 h-3 text-muted-foreground transition-transform",
                expanded && "rotate-180"
              )}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </button>

      {expanded && isPopulated && (
        <div className="ml-5.5 pl-1.5 border-l border-border/60 mt-0.5 mb-1">
          {visibleItems.map((item, idx) => (
            <div
              key={idx}
              className="text-[11px] text-muted-foreground leading-tight py-[2px] truncate"
            >
              {getItemSummary(sectionKey, item)}
            </div>
          ))}
          {hiddenCount > 0 && (
            <div className="text-[11px] text-muted-foreground/60 leading-tight py-[2px]">
              + {hiddenCount} more
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ExtractionProgressPanel({ extraction, isStreaming, streamPhase }: ExtractionProgressPanelProps) {
  const headerText = streamPhase === "connecting"
    ? "Connecting..."
    : streamPhase === "extracting"
      ? "Extracting..."
      : "Extraction complete"

  // Find the active frontier: first section with count === -1 during streaming
  let activeFrontierKey: keyof DetailedExtraction | null = null;
  if (isStreaming) {
    for (const { key } of SECTIONS) {
      if (getCount(extraction, key) === -1) {
        activeFrontierKey = key;
        break;
      }
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 sticky top-6">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">{headerText}</h3>
        {streamPhase === "connecting" && (
          <div className="mt-2 h-1 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full w-1/3 rounded-full bg-primary/60 animate-pulse" />
          </div>
        )}
      </div>
      <div className="space-y-0.5">
        {SECTIONS.map(({ key, label }) => (
          <SectionRow
            key={key}
            sectionKey={key}
            label={label}
            extraction={extraction}
            isStreaming={isStreaming}
            isActiveFrontier={key === activeFrontierKey}
          />
        ))}
      </div>
    </div>
  );
}
