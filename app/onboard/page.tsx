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
            <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {selectedFile && (
            <div className="mt-4">
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={isLoading}
                className="w-full rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                {isLoading ? "Analyzing..." : "Analyze Resume"}
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
