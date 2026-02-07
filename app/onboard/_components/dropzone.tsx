"use client";

import { useDropzone } from "react-dropzone";
import { useCallback } from "react";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "text/plain": [".txt"],
  "text/markdown": [".md", ".markdown"],
  "text/csv": [".csv"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
};

export function validateFileSize(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `File too large. Max size is 10MB, got ${(file.size / (1024 * 1024)).toFixed(1)}MB`;
  }
  return null;
}

export function validateFileType(file: File): string | null {
  const validTypes = Object.keys(ACCEPTED_TYPES);
  const validExtensions = [".pdf", ".docx", ".txt", ".md", ".markdown", ".csv", ".xls", ".xlsx"];
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));

  if (!validTypes.includes(file.type) && !validExtensions.includes(ext)) {
    return "Invalid file type. Please upload a PDF, DOCX, TXT, MD, CSV, XLS, or XLSX file";
  }
  return null;
}

interface DropzoneProps {
  onFileSelect: (file: File) => void;
  onError: (error: string) => void;
  selectedFile: File | null;
  isLoading?: boolean;
}

export function Dropzone({ onFileSelect, onError, selectedFile, isLoading }: DropzoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: unknown[]) => {
      if (rejectedFiles.length > 0) {
        onError("Invalid file. Please upload a PDF, DOCX, TXT, MD, CSV, XLS, or XLSX file under 10MB");
        return;
      }

      const file = acceptedFiles[0];
      if (!file) return;

      const sizeError = validateFileSize(file);
      if (sizeError) {
        onError(sizeError);
        return;
      }

      const typeError = validateFileType(file);
      if (typeError) {
        onError(typeError);
        return;
      }

      onFileSelect(file);
    },
    [onFileSelect, onError]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    disabled: isLoading,
  });

  return (
    <div
      {...getRootProps()}
      className={`flex min-h-[200px] items-center justify-center rounded-md border-2 border-dashed transition-colors ${
        isLoading
          ? "cursor-wait border-zinc-300 dark:border-zinc-700"
          : isDragActive
            ? "cursor-pointer border-foreground bg-muted"
            : "cursor-pointer border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600"
      }`}
    >
      <input {...getInputProps()} />
      <div className="text-center px-4">
        {isLoading ? (
          <div className="flex flex-col items-center gap-2">
            <svg
              className="h-6 w-6 animate-spin text-zinc-500"
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
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Analyzing {selectedFile?.name}...
            </p>
          </div>
        ) : selectedFile ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            <span className="font-medium">{selectedFile.name}</span>
            <br />
            <span className="text-xs">Drop a new file to replace</span>
          </p>
        ) : isDragActive ? (
          <p className="text-sm font-medium text-black dark:text-white">
            Drop your file here
          </p>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Drag and drop your file here, or click to browse
            <br />
            <span className="text-xs">PDF, DOCX, TXT, MD, CSV, XLS, XLSX (max 10MB)</span>
          </p>
        )}
      </div>
    </div>
  );
}
