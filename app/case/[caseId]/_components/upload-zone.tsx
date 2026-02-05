'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { cn } from '@/lib/utils'
import { Upload, X, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface UploadZoneProps {
  caseId: string
  onUploadComplete?: () => void
  onClose?: () => void
}

export function UploadZone({ caseId, onUploadComplete, onClose }: UploadZoneProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return

      const file = acceptedFiles[0]
      setUploading(true)
      setError(null)
      setProgress(0)

      try {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch(`/api/case/${caseId}/upload`, {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Upload failed')
        }

        setProgress(100)
        onUploadComplete?.()
        onClose?.()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setUploading(false)
      }
    },
    [caseId, onUploadComplete, onClose]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
    disabled: uploading,
  })

  return (
    <div className="p-4 border-b border-border bg-muted/50">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-stone-900 dark:text-stone-100">
          Upload Document
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
          'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-ring bg-muted'
            : 'border-border hover:border-ring',
          uploading && 'pointer-events-none opacity-50'
        )}
      >
        <input {...getInputProps()} />

        {uploading ? (
          <div className="space-y-2">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-foreground transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-stone-500">Uploading...</p>
          </div>
        ) : (
          <>
            <Upload className="w-8 h-8 mx-auto text-stone-400" />
            <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
              {isDragActive ? 'Drop file here' : 'Drag & drop or click to upload'}
            </p>
            <p className="mt-1 text-xs text-stone-400">
              PDF, DOC, DOCX, or TXT
            </p>
          </>
        )}
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}
