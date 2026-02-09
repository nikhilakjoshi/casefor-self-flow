"use client";

import { useDropzone } from "react-dropzone";
import { useCallback } from "react";
import { cn } from "@/lib/utils";

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
      className={cn(
        "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all duration-200 min-h-[260px] p-8",
        isLoading
          ? "cursor-wait border-border bg-muted/30"
          : isDragActive
            ? "cursor-copy border-primary bg-primary/5"
            : "cursor-pointer border-border hover:border-primary/40 hover:bg-muted/20"
      )}
    >
      <input {...getInputProps()} />

      {isLoading ? (
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <svg className="w-12 h-12 animate-spin" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="3" className="text-border" />
              <path
                d="M44 24c0-11.046-8.954-20-20-20"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                className="text-primary"
              />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              Extracting profile data...
            </p>
            <p className="mt-1 text-xs text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]">
              {selectedFile?.name}
            </p>
          </div>
        </div>
      ) : selectedFile ? (
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">Drop a new file to replace</p>
          </div>
        </div>
      ) : isDragActive ? (
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-primary">Drop your file here</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center">
            <svg className="w-7 h-7 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm text-foreground">
              <span className="font-medium">Drop your file here</span> or click to browse
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              PDF, DOCX, TXT, MD, CSV, XLS, XLSX -- max 10MB
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
