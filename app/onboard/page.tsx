"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Dropzone } from "./_components/dropzone";
import { ResultsPanel, type Strength } from "./_components/results-panel";
import { SurveyInline } from "./_components/survey-inline";
import { ExtractionProgressPanel } from "./_components/extraction-progress-panel";
import type { DetailedExtraction } from "@/lib/eb1a-extraction-schema";
import type { SurveyData } from "./_lib/survey-schema";

type Phase = "upload" | "survey" | "evaluating" | "results";
type StreamPhase = "connecting" | "extracting" | null;

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

function StepIndicators({ phase }: { phase: Phase }) {
  const phaseIndex = phase === "upload" ? 0 : phase === "survey" ? 1 : phase === "evaluating" ? 2 : 3;

  return (
    <div className="flex items-center gap-3 mb-8">
      {STEPS.map((step, i) => {
        const isActive = i === phaseIndex;
        const isCompleted = i < phaseIndex;

        return (
          <div key={step.number} className="flex items-center gap-2">
            {i > 0 && (
              <div className={`w-8 h-px ${isCompleted ? "bg-primary" : "bg-border"}`} />
            )}
            <div className="flex items-center gap-2">
              <span
                className={`
                  w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-[family-name:var(--font-jetbrains-mono)]
                  ${isActive ? "bg-primary text-primary-foreground" : ""}
                  ${isCompleted ? "bg-emerald-500 text-white" : ""}
                  ${!isActive && !isCompleted ? "bg-muted text-muted-foreground" : ""}
                `}
              >
                {isCompleted ? (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  step.number
                )}
              </span>
              <span className={`text-xs font-medium hidden sm:inline ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function OnboardPage() {
  const { data: session, status } = useSession();
  const [phase, setPhase] = useState<Phase>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [caseName, setCaseName] = useState<string | null>(null);
  const [surveyData, setSurveyData] = useState<SurveyData>({});
  const [streamingExtraction, setStreamingExtraction] = useState<Partial<DetailedExtraction>>({});
  const [streamPhase, setStreamPhase] = useState<StreamPhase>(null);
  const [showAuthCta, setShowAuthCta] = useState(false);
  const fileRef = useRef<File | null>(null);

  const startAnalysis = useCallback(async (file: File, targetCaseId: string) => {
    setIsStreaming(true);
    setAnalysisResult(null);
    setStreamingExtraction({});
    setStreamPhase("connecting");
    setPhase("evaluating");

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
        setStreamPhase(null);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setError("Failed to read response stream");
        setIsStreaming(false);
        setStreamPhase(null);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let receivedFirst = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            if (!receivedFirst) {
              receivedFirst = true;
              setStreamPhase("extracting");
            }
            try {
              const data = JSON.parse(line.slice(6));

              // Store raw partial extraction for progress panel
              setStreamingExtraction(data as Partial<DetailedExtraction>);

              // Extract criteria for results panel
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
      setStreamPhase(null);
      setPhase("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setIsStreaming(false);
      setStreamPhase(null);
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

      const response = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        try {
          const errorData = await response.json();
          setError(errorData.error ?? "Extraction failed");
        } catch {
          setError("Extraction failed. Please try again.");
        }
        setIsLoading(false);
        return;
      }

      const { caseId: newCaseId, caseName: newCaseName, surveyData: extractedSurvey } = await response.json();
      setCaseId(newCaseId);
      setCaseName(newCaseName || null);
      setSurveyData(extractedSurvey || {});
      setIsLoading(false);
      setPhase("survey");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setIsLoading(false);
    }
  }, []);

  const handleSkipToSurvey = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const response = await fetch("/api/cases/create-survey-only", {
        method: "POST",
      });
      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error ?? "Failed to create case");
        setIsLoading(false);
        return;
      }
      const { caseId: newCaseId, caseName: newCaseName } = await response.json();
      setCaseId(newCaseId);
      setCaseName(newCaseName || null);
      setSurveyData({});
      setIsLoading(false);
      setPhase("survey");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setIsLoading(false);
    }
  }, []);

  const handleSurveyComplete = useCallback(() => {
    if (caseId && fileRef.current) {
      startAnalysis(fileRef.current, caseId);
    } else if (caseId) {
      window.location.href = `/case/${caseId}`;
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
    setCaseName(null);
    setSurveyData({});
    setStreamingExtraction({});
    setPhase("upload");
  };

  const handleBuildCase = () => {
    if (!caseId) return;
    if (!session) {
      setShowAuthCta(true);
      return;
    }
    window.location.href = `/case/${caseId}`;
  };

  const handleAddMoreInfo = () => {
    if (!caseId) return;
    if (!session) {
      setShowAuthCta(true);
      return;
    }
    window.location.href = `/case/${caseId}`;
  };

  const handleCriterionUpdate = useCallback((criterionId: string, data: CriterionResultData) => {
    setAnalysisResult((prev) => {
      if (!prev || !prev.criteria || prev.criteria.length === 0) {
        return prev;
      }

      const updatedCriteria = prev.criteria.map((c) => {
        if (c.criterionId === criterionId) {
          return { ...data, criterionId };
        }
        return { ...c };
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
        {!session && status !== "loading" && (
          <Link
            href="/login"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
          >
            Sign In
          </Link>
        )}
      </nav>

      {/* Main content */}
      <div className="relative z-10 px-6 sm:px-10 lg:px-16 pt-6 pb-20">
        <div className={cn("mx-auto", phase === "evaluating" || phase === "results" ? "max-w-7xl" : "max-w-6xl")}>

          {/* Upload phase */}
          {phase === "upload" && (
            <>
              <StepIndicators phase={phase} />
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
                    {STEPS.map((step) => (
                      <div key={step.number} className="flex gap-4">
                        <span className="text-2xl font-bold text-primary/20 font-[family-name:var(--font-jetbrains-mono)] leading-none pt-0.5 shrink-0 w-8">
                          {step.number}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-foreground">{step.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{step.detail}</p>
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

                    <div className="mt-4 text-center">
                      <button
                        type="button"
                        onClick={handleSkipToSurvey}
                        disabled={isLoading}
                        className="text-sm font-medium text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors disabled:opacity-50"
                      >
                        {isLoading ? "Creating case..." : "Skip to Survey"}
                      </button>
                      <p className="text-[11px] text-muted-foreground/70 mt-1">
                        No resume? Fill out the survey manually
                      </p>
                    </div>

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
            </>
          )}

          {/* Survey phase */}
          {phase === "survey" && (
            <>
              <StepIndicators phase={phase} />
              <div className="max-w-3xl mx-auto">
                <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden" style={{ height: "calc(100vh - 180px)" }}>
                  <SurveyInline
                    caseId={caseId ?? ""}
                    initialData={surveyData}
                    onComplete={handleSurveyComplete}
                  />
                </div>
              </div>
            </>
          )}

          {/* Evaluating / Results phase */}
          {(phase === "evaluating" || phase === "results") && (
            <>
              <StepIndicators phase={phase} />
              {caseName && (
                <h2 className="text-lg font-semibold mb-4">{caseName}</h2>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Results: 3/4 */}
                <div className="lg:col-span-3">
                  <ResultsPanel
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

                {/* Progress sidebar: 1/4 */}
                <div className="lg:col-span-1">
                  <ExtractionProgressPanel
                    extraction={streamingExtraction}
                    isStreaming={isStreaming}
                    streamPhase={streamPhase}
                  />
                </div>
              </div>

              {/* Auth CTA for anonymous users */}
              {showAuthCta && !session && phase === "results" && (
                <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-6 max-w-xl mx-auto">
                  <h3 className="text-base font-semibold text-foreground mb-1">
                    Sign in to continue
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create an account or sign in to save your evaluation and build your case.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => signIn("google", { callbackUrl: `/case/${caseId}` })}
                      className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      Continue with Google
                    </button>
                    <Link
                      href={`/login?callbackUrl=${encodeURIComponent(`/case/${caseId}`)}`}
                      className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted transition-colors"
                    >
                      Sign in with email
                    </Link>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
