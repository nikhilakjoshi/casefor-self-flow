"use client";

import { useState, useCallback } from "react";
import { Dropzone } from "./_components/dropzone";
import { ResultsModal, type Strength } from "./_components/results-modal";

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

export default function OnboardPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    setError(null);
    setSelectedFile(file);
    setIsLoading(true);
    setIsStreaming(true);
    setAnalysisResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error ?? "Analysis failed");
        setIsLoading(false);
        setIsStreaming(false);
        return;
      }

      // Capture case ID from response header
      const responseCaseId = response.headers.get("X-Case-Id");
      if (responseCaseId) {
        setCaseId(responseCaseId);
      }

      // Open modal immediately to show streaming results
      setIsModalOpen(true);
      setIsLoading(false);

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
              if (data?.criteria) {
                const counts = countStrengths(data.criteria);
                setAnalysisResult({
                  criteria: data.criteria,
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
      setIsLoading(false);
      setIsStreaming(false);
    }
  }, []);

  const handleError = (errorMsg: string) => {
    setError(errorMsg);
    setSelectedFile(null);
  };

  const handleRetry = () => {
    setError(null);
    setAnalysisResult(null);
    setCaseId(null);
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


  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <main className="w-full max-w-xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            EB-1A Eligibility Screening
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Upload your resume to analyze your eligibility for the EB-1A visa category
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-8">
          <Dropzone
            onFileSelect={handleFileSelect}
            onError={handleError}
            selectedFile={selectedFile}
            isLoading={isLoading}
          />

          {error && (
            <div className="mt-4 flex items-center justify-between rounded-md bg-destructive/10 px-3 py-2">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              <button
                type="button"
                onClick={handleRetry}
                className="ml-4 text-sm font-medium text-red-700 underline hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </main>

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
      />
    </div>
  );
}
