"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Strength = "Strong" | "Weak" | "None";

interface CriterionResult {
  criterionId: string;
  strength: Strength;
  reason: string;
  evidence: string[];
}

interface Analysis {
  criteria: CriterionResult[];
  strongCount: number;
  weakCount: number;
  version?: number;
  criteriaNames?: Record<string, string>;
  criteriaThreshold?: number;
}

interface ReportPanelProps {
  caseId: string;
  initialAnalysis?: Analysis | null;
  version?: number;
  threshold?: number;
  onThresholdChange?: (threshold: number) => void;
}

function getStrengthConfig(strength: Strength) {
  switch (strength) {
    case "Strong":
      return {
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/30",
        badge: "bg-emerald-600 text-white",
        icon: (
          <svg
            className="w-3 h-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          >
            <path
              d="M20 6L9 17l-5-5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ),
      };
    case "Weak":
      return {
        bg: "bg-amber-500/10",
        border: "border-amber-500/30",
        badge: "bg-amber-500 text-white",
        icon: (
          <svg
            className="w-3 h-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          >
            <path d="M5 12h14" strokeLinecap="round" />
          </svg>
        ),
      };
    default:
      return {
        bg: "bg-muted/60",
        border: "border-border",
        badge: "bg-muted-foreground text-background",
        icon: (
          <svg
            className="w-3 h-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          >
            <path
              d="M18 6L6 18M6 6l12 12"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ),
      };
  }
}

function CriterionCard({ criterion, criteriaNames }: { criterion: CriterionResult; criteriaNames?: Record<string, string> }) {
  const config = getStrengthConfig(criterion.strength);

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-all",
        config.bg,
        config.border,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex items-center justify-center w-5 h-5 rounded-full shrink-0",
                config.badge,
              )}
            >
              {config.icon}
            </span>
            <h4 className="text-xs font-semibold text-stone-800 dark:text-stone-200 truncate">
              {criteriaNames?.[criterion.criterionId] ?? criterion.criterionId}
            </h4>
          </div>
          <p className="mt-1.5 text-xs text-stone-600 dark:text-stone-400 line-clamp-2">
            {criterion.reason}
          </p>
        </div>
      </div>
    </div>
  );
}

export function ReportPanel({
  caseId,
  initialAnalysis,
  version = 0,
  threshold = 3,
  onThresholdChange,
}: ReportPanelProps) {
  const [analysis, setAnalysis] = useState<Analysis | null>(
    initialAnalysis ?? null,
  );

  useEffect(() => {
    let cancelled = false;

    async function fetchAnalysis() {
      try {
        // Brief delay on refetches to let agent tool calls commit to DB
        if (version > 0) {
          await new Promise((r) => setTimeout(r, 1000));
        }
        if (cancelled) return;
        const res = await fetch(`/api/case/${caseId}/analysis`, {
          cache: "no-store",
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          if (data) {
            setAnalysis(data);
            if (data.criteriaThreshold != null) {
              onThresholdChange?.(data.criteriaThreshold);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch analysis:", err);
      }
    }

    fetchAnalysis();
    return () => {
      cancelled = true;
    };
  }, [caseId, version, onThresholdChange]);

  if (!analysis) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center text-stone-400 dark:text-stone-500">
          <p className="text-sm">No analysis yet</p>
          <p className="text-xs mt-1">
            The analysis will appear here as your case develops
          </p>
        </div>
      </div>
    );
  }

  const meetsThreshold = analysis.strongCount >= threshold;

  async function updateThreshold(newVal: number) {
    if (newVal < 1 || newVal > 10) return;
    const prev = threshold;
    onThresholdChange?.(newVal);
    try {
      const res = await fetch(`/api/case/${caseId}/threshold`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threshold: newVal }),
      });
      if (!res.ok) onThresholdChange?.(prev);
    } catch {
      onThresholdChange?.(prev);
    }
  }

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 mb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
            EB-1A Analysis{analysis.version ? ` v${analysis.version}` : ''}
          </h3>
          <div
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
              meetsThreshold
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
            )}
          >
            <span>{analysis.strongCount}/{threshold}</span>
            <button
              onClick={() => updateThreshold(threshold - 1)}
              disabled={threshold <= 1}
              className="w-4 h-4 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30"
            >
              -
            </button>
            <button
              onClick={() => updateThreshold(threshold + 1)}
              disabled={threshold >= 10}
              className="w-4 h-4 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30"
            >
              +
            </button>
          </div>
        </div>
        <div className="flex gap-3 mt-2 text-xs text-stone-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            {analysis.strongCount} strong
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            {analysis.weakCount} weak
          </span>
        </div>
      </div>

      {/* Criteria Grid */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {analysis.criteria.map((c) => (
          <CriterionCard key={c.criterionId} criterion={c} criteriaNames={analysis.criteriaNames} />
        ))}
      </div>
    </div>
  );
}
