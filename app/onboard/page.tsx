"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Dropzone } from "./_components/dropzone";
import { ResultsModal, type Strength } from "./_components/results-modal";
import { SurveyModal } from "./_components/survey-modal";
import type { SurveyData } from "./_lib/survey-schema";

interface CriterionResultData {
  criterionId: string;
  strength: Strength;
  reason: string;
  evidence: string[];
}

interface AnalysisResult {
  criteria: CriterionResultData[];
  strongCount: number;
  weakCount: number;
}

function countStrengths(criteria: CriterionResultData[]) {
  return criteria.reduce(
    (acc, c) => {
      if (c.strength === "Strong") acc.strong++;
      else if (c.strength === "Weak") acc.weak++;
      return acc;
    },
    { strong: 0, weak: 0 }
  );
}

// Convert new extraction format to legacy criteria format
function extractionToCriteria(data: Record<string, unknown>): CriterionResultData[] {
  const criteriaSummary = data.criteria_summary as Array<{
    criterion_id: string;
    strength: Strength;
    summary: string;
    key_evidence: string[];
  }> | undefined;

  if (criteriaSummary && criteriaSummary.length > 0) {
    return criteriaSummary.map((s) => ({
      criterionId: s.criterion_id,
      strength: s.strength,
      reason: s.summary,
      evidence: s.key_evidence ?? [],
    }));
  }

  // Fallback to legacy format if available
  if (data.criteria) {
    return data.criteria as CriterionResultData[];
  }

  return [];
}

const STEPS = [
  { number: "01", label: "Upload your resume or CV", detail: "We accept PDF, DOCX, TXT, and more" },
  { number: "02", label: "Quick intake survey", detail: "Pre-filled from your resume, confirm details" },
  { number: "03", label: "AI evaluates 10 criteria", detail: "Each criterion rated Strong, Weak, or None" },
  { number: "04", label: "Review results and build case", detail: "Strengthen weak areas with guidance" },
];

export default function OnboardPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);

  // Survey state
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [surveyData, setSurveyData] = useState<SurveyData>({});
  const fileRef = useRef<File | null>(null);

  const startAnalysis = useCallback(async (file: File, targetCaseId: string) => {
    setIsStreaming(true);
    setAnalysisResult(null);
    setIsModalOpen(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/case/${targetCaseId}/analyze`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error ?? "Analysis failed");
        setIsStreaming(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setError("Failed to read response stream");
        setIsStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              // Handle new extraction format (criteria_summary) or legacy (criteria)
              const criteria = extractionToCriteria(data);
              if (criteria.length > 0) {
                const counts = countStrengths(criteria);
                setAnalysisResult({
                  criteria,
                  strongCount: counts.strong,
                  weakCount: counts.weak,
                });
              }
            } catch {
              // Ignore parse errors for partial JSON
            }
          }
        }
      }

      setIsStreaming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setIsStreaming(false);
    }
  }, []);

  const handleFileSelect = useCallback(async (file: File) => {
    setError(null);
    setSelectedFile(file);
    setIsLoading(true);
    fileRef.current = file;

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Phase 1: Quick extraction
      const response = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error ?? "Extraction failed");
        setIsLoading(false);
        return;
      }

      const { caseId: newCaseId, surveyData: extractedSurvey } = await response.json();
      setCaseId(newCaseId);
      setSurveyData(extractedSurvey || {});
      setIsLoading(false);

      // Open survey modal
      setSurveyOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setIsLoading(false);
    }
  }, []);

  const handleSurveyComplete = useCallback(() => {
    setSurveyOpen(false);
    if (caseId && fileRef.current) {
      startAnalysis(fileRef.current, caseId);
    }
  }, [caseId, startAnalysis]);

  const handleError = (errorMsg: string) => {
    setError(errorMsg);
    setSelectedFile(null);
  };

  const handleRetry = () => {
    setError(null);
    setAnalysisResult(null);
    setCaseId(null);
    setSurveyData({});
  };

  const handleBuildCase = () => {
    if (caseId) {
      window.location.href = `/case/${caseId}`;
    }
  };

  const handleAddMoreInfo = () => {
    if (caseId) {
      window.location.href = `/case/${caseId}`;
    }
  };

  const handleCriterionUpdate = useCallback((criterionId: string, data: CriterionResultData) => {
    setAnalysisResult((prev) => {
      if (!prev || !prev.criteria || prev.criteria.length === 0) {
        console.warn("No existing analysis to update");
        return prev;
      }

      // Create new criteria array with the updated criterion
      const updatedCriteria = prev.criteria.map((c) => {
        if (c.criterionId === criterionId) {
          return { ...data, criterionId }; // Ensure criterionId is preserved
        }
        return { ...c }; // Clone each criterion
      });

      const counts = countStrengths(updatedCriteria);

      return {
        criteria: updatedCriteria,
        strongCount: counts.strong,
        weakCount: counts.weak,
      };
    });
  }, []);


  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Grid background */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 sm:px-10 lg:px-16 py-5">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
            <svg className="w-4 h-4 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M4.5 12.75l6 6 9-13.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-lg font-semibold tracking-tight">CaseFor</span>
        </Link>
        <Link
          href="/login"
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
        >
          Sign In
        </Link>
      </nav>

      {/* Main content */}
      <div className="relative z-10 px-6 sm:px-10 lg:px-16 pt-12 sm:pt-20 lg:pt-28 pb-20">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">

            {/* Left: copy */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted/50 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
                  Eligibility Screening
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-[1.15] text-foreground">
                Start your EB-1A
                <br />
                <span className="text-primary">case evaluation</span>
              </h1>

              <p className="mt-4 text-base text-muted-foreground max-w-md leading-relaxed">
                Upload your resume and we will extract your profile, walk you through
                a quick intake survey, then evaluate your eligibility across all 10 criteria.
              </p>

              {/* Steps */}
              <div className="mt-10 space-y-6">
                {STEPS.map((step, i) => (
                  <div key={step.number} className="flex gap-4">
                    <span className="text-2xl font-bold text-primary/20 font-[family-name:var(--font-jetbrains-mono)] leading-none pt-0.5 shrink-0 w-8">
                      {step.number}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{step.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{step.detail}</p>
                      {i === 0 && (
                        <div className="mt-1.5 flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-primary/40" />
                          <span className="text-[10px] text-primary/60 font-medium">You are here</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: dropzone card */}
            <div className="lg:pt-8">
              <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <div className="mb-5">
                  <h2 className="text-sm font-semibold text-foreground">Upload your resume</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your data is processed securely and never shared
                  </p>
                </div>

                <Dropzone
                  onFileSelect={handleFileSelect}
                  onError={handleError}
                  selectedFile={selectedFile}
                  isLoading={isLoading}
                />

                {error && (
                  <div className="mt-4 flex items-center justify-between rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5">
                    <p className="text-sm text-destructive">{error}</p>
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="ml-4 text-sm font-medium text-destructive underline underline-offset-2 hover:text-destructive/80 shrink-0"
                    >
                      Try again
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Trust indicators */}
          <div className="mt-20 pt-10 border-t border-border">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl">
              {[
                { value: "10", label: "EB-1A criteria analyzed" },
                { value: "< 2min", label: "Initial screening" },
                { value: "Free", label: "To get started" },
              ].map((stat) => (
                <div key={stat.label} className="flex items-center gap-3">
                  <span className="text-lg font-bold text-primary font-[family-name:var(--font-jetbrains-mono)]">
                    {stat.value}
                  </span>
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <SurveyModal
        open={surveyOpen}
        onOpenChange={setSurveyOpen}
        caseId={caseId ?? ""}
        initialData={surveyData}
        onComplete={handleSurveyComplete}
      />

      <ResultsModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        criteria={analysisResult?.criteria ?? []}
        strongCount={analysisResult?.strongCount ?? 0}
        weakCount={analysisResult?.weakCount ?? 0}
        isStreaming={isStreaming}
        caseId={caseId ?? undefined}
        onBuildCase={handleBuildCase}
        onAddMoreInfo={handleAddMoreInfo}
        onCriterionUpdate={handleCriterionUpdate}
      />
    </div>
  );
}
