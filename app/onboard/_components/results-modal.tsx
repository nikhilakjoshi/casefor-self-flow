"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Strength = "Strong" | "Weak" | "None";

interface CriterionResultData {
  criterionId: string;
  strength: Strength;
  reason: string;
  evidence: string[];
}

interface ResultsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  criteria: CriterionResultData[];
  strongCount: number;
  weakCount: number;
  isStreaming?: boolean;
  caseId?: string;
  onBuildCase?: () => void;
  onAddMoreInfo?: () => void;
  criteriaNames?: Record<string, string>;
  threshold?: number;
}

function getCriterionName(criterionId: string, names?: Record<string, string>): string {
  return names?.[criterionId] ?? criterionId;
}

function getStrengthConfig(strength: Strength) {
  switch (strength) {
    case "Strong":
      return {
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/30",
        badge: "bg-emerald-600 text-white",
        icon: (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
        accent: "text-emerald-700 dark:text-emerald-400",
      };
    case "Weak":
      return {
        bg: "bg-amber-500/10",
        border: "border-amber-500/30",
        badge: "bg-amber-500 text-white",
        icon: (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 9v4m0 4h.01" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
        accent: "text-amber-700 dark:text-amber-400",
      };
    case "None":
    default:
      return {
        bg: "bg-muted/60",
        border: "border-border",
        badge: "bg-muted-foreground text-background",
        icon: (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14" strokeLinecap="round" />
          </svg>
        ),
        accent: "text-stone-500 dark:text-stone-400",
      };
  }
}

function CriterionCardEnhanced({
  criterionName,
  strength,
  reason,
  evidence,
  index,
}: {
  criterionName: string;
  strength: Strength;
  reason: string;
  evidence?: string[];
  index: number;
}) {
  const config = getStrengthConfig(strength);

  return (
    <div
      className={cn(
        "group relative rounded-xl border p-5 transition-all duration-300",
        "hover:shadow-md hover:-translate-y-0.5",
        config.bg,
        config.border
      )}
      style={{
        animationDelay: `${index * 50}ms`,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span className={cn("flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold", config.badge)}>
              {config.icon}
            </span>
            <h3 className="text-sm font-semibold tracking-tight text-stone-900 dark:text-stone-100">
              {criterionName}
            </h3>
          </div>
          <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">
            {reason}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full",
            config.badge
          )}
        >
          {strength}
        </span>
      </div>

      {evidence && evidence.length > 0 && (
        <div className="mt-4 pt-4 border-t border-stone-200/60 dark:border-stone-700/40">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-500 mb-3">
            Supporting Evidence
          </p>
          <div className="space-y-2.5">
            {evidence.map((quote, idx) => (
              <div
                key={idx}
                className="relative pl-4 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:rounded-full before:bg-border"
              >
                <p className="text-xs leading-relaxed text-stone-600 dark:text-stone-400 italic">
                  "{quote}"
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreRing({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const percentage = (value / max) * 100;
  const circumference = 2 * Math.PI * 18;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-14 h-14">
        <svg className="w-14 h-14 -rotate-90" viewBox="0 0 40 40">
          <circle
            cx="20"
            cy="20"
            r="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-stone-200 dark:text-stone-700"
          />
          <circle
            cx="20"
            cy="20"
            r="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={color}
            style={{
              transition: "stroke-dashoffset 0.8s ease-out",
            }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-stone-800 dark:text-stone-200">
          {value}
        </span>
      </div>
      <span className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

export function ResultsModal({
  open,
  onOpenChange,
  criteria,
  strongCount,
  weakCount,
  isStreaming,
  caseId,
  onBuildCase,
  onAddMoreInfo,
  criteriaNames,
  threshold = 3,
}: ResultsModalProps) {
  const meetsThreshold = strongCount >= threshold;
  const noneCount = criteria.length - strongCount - weakCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[90vh] sm:w-[90vw] sm:max-w-[90vw] overflow-hidden flex flex-col",
          "bg-card",
          "border-border"
        )}
        showCloseButton={false}
      >
        {/* Header */}
        <DialogHeader className="shrink-0 pb-6 border-b border-stone-200 dark:border-stone-800">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                EB-1A Evaluation Results
              </DialogTitle>
              <DialogDescription className="mt-1.5 text-stone-500 dark:text-stone-400">
                Comprehensive analysis across the 10 USCIS criteria
              </DialogDescription>
            </div>
            <DialogClose asChild>
              <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </DialogClose>
          </div>
        </DialogHeader>

        {/* Summary Section */}
        <div className="shrink-0 py-6 border-b border-stone-200 dark:border-stone-800">
          <div className="flex items-center justify-between gap-8">
            {/* Score Rings */}
            <div className="flex items-center gap-6">
              <ScoreRing value={strongCount} max={10} label="Strong" color="text-emerald-500" />
              <ScoreRing value={weakCount} max={10} label="Weak" color="text-amber-500" />
              <ScoreRing value={noneCount} max={10} label="None" color="text-stone-400" />
            </div>

            {/* Threshold Status */}
            <div className={cn(
              "flex-1 max-w-md p-4 rounded-xl border",
              meetsThreshold
                ? "bg-emerald-500/10 border-emerald-500/30"
                : "bg-amber-500/10 border-amber-500/30"
            )}>
              <div className="flex items-start gap-3">
                <div className={cn(
                  "shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                  meetsThreshold ? "bg-emerald-500/20" : "bg-amber-500/20"
                )}>
                  {meetsThreshold ? (
                    <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 9v4m0 4h.01" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className={cn(
                    "text-sm font-semibold",
                    meetsThreshold ? "text-emerald-800 dark:text-emerald-300" : "text-amber-800 dark:text-amber-300"
                  )}>
                    {meetsThreshold ? "Threshold Met" : "Below Threshold"}
                  </p>
                  <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                    {meetsThreshold
                      ? `You demonstrate strong evidence in ${threshold}+ criteria`
                      : `Consider strengthening ${threshold - strongCount} more ${threshold - strongCount === 1 ? "criterion" : "criteria"}`
                    }
                  </p>
                </div>
              </div>
            </div>

            {isStreaming && (
              <div className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-full bg-muted">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-xs font-medium text-stone-600 dark:text-stone-400">
                  {criteria.length}/10 analyzed
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Criteria Cards */}
        <div className="flex-1 overflow-y-auto py-6 -mx-6 px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {criteria.map((c, idx) => (
              <CriterionCardEnhanced
                key={idx}
                criterionName={getCriterionName(c.criterionId, criteriaNames)}
                strength={c.strength}
                reason={c.reason}
                evidence={c.evidence}
                index={idx}
              />
            ))}
            {isStreaming && (
              <div className="flex items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed border-border bg-muted/50">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-sm text-stone-500 dark:text-stone-400">
                  Analyzing criterion {criteria.length + 1} of 10...
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 pt-6 border-t border-stone-200 dark:border-stone-800 flex justify-between items-center">
          <DialogClose asChild>
            <Button
              variant="ghost"
              className="text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
            >
              Close
            </Button>
          </DialogClose>

          {!isStreaming && (
            meetsThreshold ? (
              <Button
                onClick={onBuildCase}
                className="px-6 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Build Case
                <svg className="w-4 h-4 ml-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14m-7-7l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Button>
            ) : (
              <Button
                onClick={onAddMoreInfo}
                className="px-6 bg-amber-500 hover:bg-amber-600 text-white"
              >
                Add More Info
                <svg className="w-4 h-4 ml-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14m-7-7h14" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Button>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
