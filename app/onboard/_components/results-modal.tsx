"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
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
  onCriterionUpdate?: (criterionId: string, data: CriterionResultData) => void;
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
  criterionId,
  criterionName,
  strength,
  reason,
  evidence,
  index,
  caseId,
  onUpdate,
}: {
  criterionId: string;
  criterionName: string;
  strength: Strength;
  reason: string;
  evidence?: string[];
  index: number;
  caseId?: string;
  onUpdate?: (data: CriterionResultData) => void;
}) {
  const config = getStrengthConfig(strength);
  const [isExpanded, setIsExpanded] = useState(false);
  const [additionalContext, setAdditionalContext] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const analyzeWithContext = useCallback(async (context: string, file?: File) => {
    if (!caseId) return;
    setIsAnalyzing(true);

    try {
      const formData = new FormData();
      formData.append("criterionId", criterionId);
      if (context) formData.append("context", context);
      if (file) formData.append("file", file);

      const res = await fetch(`/api/case/${caseId}/criterion`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        // Ensure we use the local criterionId, not from response
        onUpdate?.({
          criterionId: criterionId,
          strength: data.strength as Strength,
          reason: data.reason,
          evidence: data.evidence ?? [],
        });
        setAdditionalContext("");
        setIsExpanded(false);
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error("Analysis failed:", errorData);
      }
    } catch (err) {
      console.error("Analysis failed:", err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [caseId, criterionId, onUpdate]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setIsDragOver(false);
    if (acceptedFiles.length > 0) {
      analyzeWithContext(additionalContext, acceptedFiles[0]);
    }
  }, [additionalContext, analyzeWithContext]);

  const { getRootProps, getInputProps, open } = useDropzone({
    onDrop,
    onDragEnter: () => setIsDragOver(true),
    onDragLeave: () => setIsDragOver(false),
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
    },
    maxFiles: 1,
    noClick: true,
    noKeyboard: true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (additionalContext.trim()) {
      analyzeWithContext(additionalContext.trim());
    }
  };

  return (
    <div
      {...getRootProps()}
      className={cn(
        "group relative rounded-xl border p-5 transition-all duration-300",
        "hover:shadow-md",
        isDragOver ? "ring-2 ring-primary ring-offset-2" : "",
        isAnalyzing ? "opacity-70" : "",
        config.bg,
        config.border
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <input {...getInputProps()} />

      {/* Loading overlay */}
      {isAnalyzing && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-xl z-10">
          <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-background shadow-sm">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-medium">Analyzing...</span>
          </div>
        </div>
      )}

      {/* Drop overlay */}
      {isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/10 rounded-xl z-10 border-2 border-dashed border-primary">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="mt-2 text-sm font-medium text-primary">Drop to add evidence</p>
          </div>
        </div>
      )}

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
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "shrink-0 px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full",
              config.badge
            )}
          >
            {strength}
          </span>
        </div>
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

      {/* Add evidence section */}
      {caseId && (
        <div className="mt-4 pt-4 border-t border-stone-200/60 dark:border-stone-700/40">
          {!isExpanded ? (
            <button
              onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }}
              className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14m-7-7h14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Add evidence for this criterion
            </button>
          ) : (
            <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()} className="space-y-3">
              <textarea
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Describe additional evidence, achievements, or context for this criterion..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                rows={3}
                autoFocus
              />
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); open(); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-muted transition-colors"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Upload file
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsExpanded(false);
                      setAdditionalContext("");
                    }}
                    className="px-3 py-1.5 text-xs font-medium rounded-md hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!additionalContext.trim() || isAnalyzing}
                    onClick={(e) => e.stopPropagation()}
                    className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    Analyze
                  </button>
                </div>
              </div>
            </form>
          )}
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
  onCriterionUpdate,
}: ResultsModalProps) {
  const meetsThreshold = strongCount >= threshold;
  const noneCount = criteria.length - strongCount - weakCount;

  const handleCriterionUpdate = useCallback((data: CriterionResultData) => {
    onCriterionUpdate?.(data.criterionId, data);
  }, [onCriterionUpdate]);

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

            {/* Threshold Status - only shown when met */}
            {meetsThreshold && (
              <div className="flex-1 max-w-md p-4 rounded-xl border bg-emerald-500/10 border-emerald-500/30">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-emerald-500/20">
                    <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                      Threshold Met
                    </p>
                    <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                      You demonstrate strong evidence in {threshold}+ criteria
                    </p>
                  </div>
                </div>
              </div>
            )}

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
                key={c.criterionId}
                criterionId={c.criterionId}
                criterionName={getCriterionName(c.criterionId, criteriaNames)}
                strength={c.strength}
                reason={c.reason}
                evidence={c.evidence}
                index={idx}
                caseId={caseId}
                onUpdate={handleCriterionUpdate}
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
