'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { cn } from '@/lib/utils'
import { Upload, X, Check, AlertCircle, Loader2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface UploadZoneProps {
  caseId: string
  onUploadComplete?: () => void
  onClose?: () => void
}

type FileStatus = 'pending' | 'uploading' | 'analyzing' | 'success' | 'error'

interface FileUploadState {
  file: File
  status: FileStatus
  progress: number
  error?: string
}

interface BatchUploadResponse {
  results: Array<{
    fileName: string
    success: boolean
    chunksCreated?: number
    analysisStatus?: 'queued' | 'completed' | 'failed'
    error?: string
  }>
  totalSuccess: number
  totalFailed: number
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getStatusIcon(status: FileStatus) {
  switch (status) {
    case 'pending':
      return <FileText className="w-4 h-4 text-stone-400" />
    case 'uploading':
    case 'analyzing':
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
    case 'success':
      return <Check className="w-4 h-4 text-emerald-500" />
    case 'error':
      return <AlertCircle className="w-4 h-4 text-red-500" />
  }
}

function getStatusColor(status: FileStatus): string {
  switch (status) {
    case 'pending':
      return 'bg-stone-100 dark:bg-stone-800'
    case 'uploading':
      return 'bg-blue-50 dark:bg-blue-950'
    case 'analyzing':
      return 'bg-amber-50 dark:bg-amber-950'
    case 'success':
      return 'bg-emerald-50 dark:bg-emerald-950'
    case 'error':
      return 'bg-red-50 dark:bg-red-950'
  }
}

export function UploadZone({ caseId, onUploadComplete, onClose }: UploadZoneProps) {
  const [fileStates, setFileStates] = useState<FileUploadState[]>([])
  const [uploading, setUploading] = useState(false)
  const [summary, setSummary] = useState<{ success: number; failed: number } | null>(null)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return

    const newStates: FileUploadState[] = acceptedFiles.map((file) => ({
      file,
      status: 'pending' as FileStatus,
      progress: 0,
    }))

    setFileStates((prev) => [...prev, ...newStates])
    setSummary(null)
  }, [])

  const removeFile = useCallback((index: number) => {
    setFileStates((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const uploadFiles = useCallback(async () => {
    const pendingFiles = fileStates.filter((fs) => fs.status === 'pending')
    if (pendingFiles.length === 0) return

    setUploading(true)
    setSummary(null)

    // Mark all pending as uploading
    setFileStates((prev) =>
      prev.map((fs) =>
        fs.status === 'pending' ? { ...fs, status: 'uploading' as FileStatus } : fs
      )
    )

    try {
      const formData = new FormData()
      pendingFiles.forEach((fs) => {
        formData.append('files', fs.file)
      })

      const res = await fetch(`/api/case/${caseId}/upload`, {
        method: 'POST',
        body: formData,
      })

      const data: BatchUploadResponse = await res.json()

      // Update file states based on response
      setFileStates((prev) =>
        prev.map((fs) => {
          if (fs.status !== 'uploading') return fs

          const result = data.results.find((r) => r.fileName === fs.file.name)
          if (!result) {
            return { ...fs, status: 'error' as FileStatus, error: 'No response for file' }
          }

          if (result.success) {
            return {
              ...fs,
              status: 'success' as FileStatus,
              progress: 100,
            }
          } else {
            return {
              ...fs,
              status: 'error' as FileStatus,
              error: result.error || 'Upload failed',
            }
          }
        })
      )

      setSummary({ success: data.totalSuccess, failed: data.totalFailed })

      if (data.totalSuccess > 0) {
        onUploadComplete?.()
      }
    } catch (err) {
      // Mark all uploading as error
      setFileStates((prev) =>
        prev.map((fs) =>
          fs.status === 'uploading'
            ? { ...fs, status: 'error' as FileStatus, error: err instanceof Error ? err.message : 'Upload failed' }
            : fs
        )
      )
    } finally {
      setUploading(false)
    }
  }, [caseId, fileStates, onUploadComplete])

  const clearCompleted = useCallback(() => {
    setFileStates((prev) => prev.filter((fs) => fs.status !== 'success'))
    setSummary(null)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md', '.markdown'],
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    maxFiles: 10,
    disabled: uploading,
  })

  const hasPending = fileStates.some((fs) => fs.status === 'pending')
  const hasCompleted = fileStates.some((fs) => fs.status === 'success')

  return (
    <div className="p-4 border-b border-border bg-muted/50">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-stone-900 dark:text-stone-100">
          Upload Documents
        </h4>
        {onClose && (
          <Button variant="ghost" size="icon-xs" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-ring bg-muted'
            : 'border-border hover:border-ring',
          uploading && 'pointer-events-none opacity-50'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="w-6 h-6 mx-auto text-stone-400" />
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
          {isDragActive ? 'Drop files here' : 'Drag & drop or click (up to 10 files)'}
        </p>
        <p className="mt-1 text-xs text-stone-400">
          PDF, DOC, DOCX, TXT, MD, CSV, XLS, XLSX
        </p>
      </div>

      {/* File list */}
      {fileStates.length > 0 && (
        <div className="mt-3 space-y-2">
          {fileStates.map((fs, index) => (
            <div
              key={`${fs.file.name}-${index}`}
              className={cn(
                'flex items-center gap-2 p-2 rounded-md text-sm',
                getStatusColor(fs.status)
              )}
            >
              {getStatusIcon(fs.status)}
              <div className="flex-1 min-w-0">
                <p className="truncate text-stone-700 dark:text-stone-300">
                  {fs.file.name}
                </p>
                <p className="text-xs text-stone-500">
                  {formatFileSize(fs.file.size)}
                  {fs.error && (
                    <span className="text-red-600 dark:text-red-400 ml-2">
                      {fs.error}
                    </span>
                  )}
                </p>
              </div>
              {fs.status === 'pending' && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeFile(index)
                  }}
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className="mt-3 text-xs text-stone-600 dark:text-stone-400">
          {summary.success > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400">
              {summary.success} uploaded
            </span>
          )}
          {summary.success > 0 && summary.failed > 0 && <span> / </span>}
          {summary.failed > 0 && (
            <span className="text-red-600 dark:text-red-400">
              {summary.failed} failed
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      {fileStates.length > 0 && (
        <div className="mt-3 flex gap-2">
          {hasPending && (
            <Button
              size="sm"
              onClick={uploadFiles}
              disabled={uploading}
              className="flex-1"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Uploading...
                </>
              ) : (
                `Upload ${fileStates.filter((fs) => fs.status === 'pending').length} file(s)`
              )}
            </Button>
          )}
          {hasCompleted && (
            <Button variant="outline" size="sm" onClick={clearCompleted}>
              Clear completed
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
