"use client";

import { useDropzone } from "react-dropzone";
import { useCallback } from "react";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "text/plain": [".txt"],
};

export function validateFileSize(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `File too large. Max size is 10MB, got ${(file.size / (1024 * 1024)).toFixed(1)}MB`;
  }
  return null;
}

export function validateFileType(file: File): string | null {
  const validTypes = Object.keys(ACCEPTED_TYPES);
  const validExtensions = [".pdf", ".docx", ".txt"];
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));

  if (!validTypes.includes(file.type) && !validExtensions.includes(ext)) {
    return "Invalid file type. Please upload a PDF, DOCX, or TXT file";
  }
  return null;
}

interface DropzoneProps {
  onFileSelect: (file: File) => void;
  onError: (error: string) => void;
  selectedFile: File | null;
}

export function Dropzone({ onFileSelect, onError, selectedFile }: DropzoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: unknown[]) => {
      if (rejectedFiles.length > 0) {
        onError("Invalid file. Please upload a PDF, DOCX, or TXT file under 10MB");
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
  });

  return (
    <div
      {...getRootProps()}
      className={`flex min-h-[200px] cursor-pointer items-center justify-center rounded-md border-2 border-dashed transition-colors ${
        isDragActive
          ? "border-black bg-zinc-100 dark:border-white dark:bg-zinc-800"
          : "border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600"
      }`}
    >
      <input {...getInputProps()} />
      <div className="text-center px-4">
        {selectedFile ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            <span className="font-medium">{selectedFile.name}</span>
            <br />
            <span className="text-xs">Drop a new file to replace</span>
          </p>
        ) : isDragActive ? (
          <p className="text-sm font-medium text-black dark:text-white">
            Drop your resume here
          </p>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Drag and drop your resume here, or click to browse
            <br />
            <span className="text-xs">PDF, DOCX, or TXT (max 10MB)</span>
          </p>
        )}
      </div>
    </div>
  );
}
