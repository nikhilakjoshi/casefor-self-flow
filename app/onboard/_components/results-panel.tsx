"use client";

import { cn } from "@/lib/utils";

export type Strength = "Strong" | "Weak" | "None";

interface CriterionResultData {
  criterionId: string;
  strength: Strength;
  reason: string;
  evidence: string[];
}

interface ResultsPanelProps {
  criteria: CriterionResultData[];
  isStreaming?: boolean;
  onBuildCase?: () => void;
}

const CRITERION_LABELS: Record<string, string> = {
  awards: "Awards",
  membership: "Membership",
  published_material: "Published Material",
  judging: "Judging",
  original_contributions: "Original Contributions",
  scholarly_articles: "Scholarly Articles",
  exhibitions: "Artistic Exhibitions",
  leading_role: "Leading / Critical Role",
  high_salary: "High Salary",
  commercial_success: "Commercial Success",
};

function getCriterionName(criterionId: string): string {
  return CRITERION_LABELS[criterionId] ?? criterionId;
}

function EvidenceRow({ criterion }: { criterion: CriterionResultData }) {
  return (
    <div className="group flex items-start gap-4 py-3.5 border-b border-stone-100 dark:border-stone-800/60 last:border-0">
      <div className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 flex items-center justify-center">
        <svg
          className="w-3 h-3 text-emerald-600 dark:text-emerald-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-stone-900 dark:text-stone-100 leading-tight">
          {getCriterionName(criterion.criterionId)}
        </p>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400 leading-relaxed line-clamp-2">
          {criterion.reason}
        </p>
      </div>
    </div>
  );
}

function GapRow({ criterion }: { criterion: CriterionResultData }) {
  return (
    <div className="flex items-start gap-4 py-3.5 border-b border-stone-100 dark:border-stone-800/60 last:border-0">
      <div className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center">
        <svg
          className="w-3 h-3 text-stone-400 dark:text-stone-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M5 12h14" strokeLinecap="round" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-stone-900 dark:text-stone-100 leading-tight">
          {getCriterionName(criterion.criterionId)}
        </p>
        <p className="mt-1 text-sm text-stone-400 dark:text-stone-500 leading-relaxed line-clamp-2">
          {criterion.reason || "No relevant evidence found in uploaded materials"}
        </p>
      </div>
    </div>
  );
}

function StreamingIndicator() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="flex items-center gap-3 mb-4">
        <div className="relative w-5 h-5">
          <div className="absolute inset-0 rounded-full border-2 border-stone-200 dark:border-stone-700" />
          <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
        <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
          Analyzing your profile...
        </span>
      </div>
      <p className="text-xs text-stone-400 dark:text-stone-500">
        Evaluating your background against EB-1A criteria
      </p>
    </div>
  );
}

export function ResultsPanel({
  criteria,
  isStreaming,
  onBuildCase,
}: ResultsPanelProps) {
  const evidenceFound = criteria.filter(
    (c) => c.strength === "Strong" || c.strength === "Weak"
  );
  const moreInfoNeeded = criteria.filter((c) => c.strength === "None");

  if (isStreaming && criteria.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950">
        <StreamingIndicator />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Streaming banner -- sticky at top */}
      {isStreaming && criteria.length > 0 && (
        <div className="sticky top-0 z-10 flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-muted/80 backdrop-blur-sm border border-border">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
          <span className="text-xs font-medium text-stone-600 dark:text-stone-300">
            Analyzing your profile...
          </span>
        </div>
      )}

      {/* Header + CTA row */}
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
            Profile alignment
          </h2>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
            Here is how your profile aligns with EB-1A criteria.
          </p>
          <p className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">
            Based on uploaded resume and survey answers
          </p>
        </div>
        {!isStreaming && criteria.length > 0 && (
          <button
            onClick={onBuildCase}
            className={cn(
              "shrink-0 inline-flex items-center gap-2 px-5 py-2.5 mt-1",
              "text-sm font-medium rounded-lg",
              "bg-primary text-primary-foreground",
              "hover:bg-primary/90 transition-colors"
            )}
          >
            Continue to full case analysis
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                d="M5 12h14m-7-7l7 7-7 7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Evidence found */}
      {evidenceFound.length > 0 && (
        <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950">
          <div className="px-5 pt-4 pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Evidence found
            </h3>
          </div>
          <div className="px-5 pb-2">
            {evidenceFound.map((c) => (
              <EvidenceRow key={c.criterionId} criterion={c} />
            ))}
          </div>
        </div>
      )}

      {/* More info needed */}
      {moreInfoNeeded.length > 0 && (
        <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950">
          <div className="px-5 pt-4 pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              More info needed
            </h3>
          </div>
          <div className="px-5 pb-2">
            {moreInfoNeeded.map((c) => (
              <GapRow key={c.criterionId} criterion={c} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
