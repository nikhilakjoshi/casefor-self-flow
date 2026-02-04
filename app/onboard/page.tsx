"use client";

import { useState } from "react";
import { Dropzone } from "./_components/dropzone";
import { ResultsModal } from "./_components/results-modal";
import { processResume, type ProcessResumeResult } from "./actions";
import type { Strength } from "./_components/criterion-card";

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

export default function OnboardPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  const handleFileSelect = (file: File) => {
    setError(null);
    setSelectedFile(file);
  };

  const handleError = (errorMsg: string) => {
    setError(errorMsg);
    setSelectedFile(null);
  };

  const handleRetry = () => {
    setError(null);
    setAnalysisResult(null);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const result: ProcessResumeResult = await processResume(formData);

      if (!result.success || !result.evaluation) {
        setError(result.error ?? "Analysis failed");
        return;
      }

      setAnalysisResult({
        criteria: result.evaluation.criteria as CriterionResultData[],
        strongCount: result.strongCount ?? 0,
        weakCount: result.weakCount ?? 0,
      });
      setIsModalOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <main className="w-full max-w-xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            EB-1A Eligibility Screening
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Upload your resume to analyze your eligibility for the EB-1A visa category
          </p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
          <Dropzone
            onFileSelect={handleFileSelect}
            onError={handleError}
            selectedFile={selectedFile}
          />

          {error && (
            <div className="mt-4 flex items-center justify-between rounded-md bg-red-50 px-3 py-2 dark:bg-red-950/30">
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

          {selectedFile && (
            <div className="mt-4">
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={isLoading}
                className="w-full rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="h-4 w-4 animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Analyzing...
                  </span>
                ) : (
                  "Analyze Resume"
                )}
              </button>
            </div>
          )}
        </div>
      </main>

      {analysisResult && (
        <ResultsModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          criteria={analysisResult.criteria}
          strongCount={analysisResult.strongCount}
          weakCount={analysisResult.weakCount}
        />
      )}
    </div>
  );
}
