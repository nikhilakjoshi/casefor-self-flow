"use client";

import { useState } from "react";

export default function OnboardPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          {/* Dropzone component will be added here */}
          <div className="flex min-h-[200px] items-center justify-center rounded-md border-2 border-dashed border-zinc-300 dark:border-zinc-700">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Dropzone placeholder - drag and drop your resume here
            </p>
          </div>

          {error && (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {selectedFile && (
            <div className="mt-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Selected: {selectedFile.name}
              </p>
              <button
                type="button"
                className="mt-4 w-full rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                Analyze Resume
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
