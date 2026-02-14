'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'
import { parseCsvToRows } from '@/lib/csv-utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Upload, AlertCircle, Check } from 'lucide-react'

const RECOMMENDER_FIELDS: { value: string; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'title', label: 'Title' },
  { value: 'organization', label: 'Organization' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'linkedIn', label: 'LinkedIn' },
  { value: 'countryRegion', label: 'Country/Region' },
  { value: 'bio', label: 'Bio' },
  { value: 'credentials', label: 'Credentials' },
  { value: 'relationshipType', label: 'Relationship Type' },
]

interface ColumnMapping {
  csvColumn: string
  field: string | null
}

interface MappedRecommender {
  name: string | null
  title: string | null
  organization: string | null
  email: string | null
  phone: string | null
  linkedIn: string | null
  countryRegion: string | null
  bio: string | null
  credentials: string | null
  relationshipType: string | null
  relationshipContext: string | null
}

interface CsvImportModalProps {
  caseId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}

type Step = 'upload' | 'preview' | 'confirm'

export function CsvImportModal({
  caseId,
  open,
  onOpenChange,
  onImported,
}: CsvImportModalProps) {
  const [step, setStep] = useState<Step>('upload')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<ColumnMapping[]>([])
  const [recommenders, setRecommenders] = useState<MappedRecommender[]>([])
  const [isMapping, setIsMapping] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setStep('upload')
    setHeaders([])
    setRows([])
    setMapping([])
    setRecommenders([])
    setIsMapping(false)
    setIsImporting(false)
    setError(null)
  }, [])

  const handleClose = useCallback(
    (open: boolean) => {
      if (!open) reset()
      onOpenChange(open)
    },
    [onOpenChange, reset]
  )

  const onDrop = useCallback(
    async (accepted: File[]) => {
      const file = accepted[0]
      if (!file) return

      setError(null)

      try {
        const text = await file.text()
        const parsed = parseCsvToRows(text)

        if (parsed.rows.length > 50) {
          setError('Maximum 50 rows allowed per import')
          return
        }

        if (parsed.rows.length === 0) {
          setError('CSV has no data rows')
          return
        }

        setHeaders(parsed.headers)
        setRows(parsed.rows)

        // Call map API
        setIsMapping(true)
        setStep('preview')

        const res = await fetch(
          `/api/case/${caseId}/recommenders/import`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'map',
              headers: parsed.headers,
              rows: parsed.rows,
            }),
          }
        )

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to map columns')
        }

        const result = await res.json()
        setMapping(result.mapping)
        setRecommenders(result.recommenders)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse CSV')
        setStep('upload')
      } finally {
        setIsMapping(false)
      }
    },
    [caseId]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
    disabled: isMapping,
  })

  const handleMappingChange = useCallback(
    (csvColumn: string, newField: string) => {
      setMapping((prev) =>
        prev.map((m) =>
          m.csvColumn === csvColumn
            ? { ...m, field: newField === '_none' ? null : newField }
            : m
        )
      )

      // Re-apply mapping to recommenders from raw rows
      setRecommenders((prev) => {
        const colIdx = headers.indexOf(csvColumn)
        if (colIdx === -1) return prev

        const fieldKey = newField === '_none' ? null : newField

        return prev.map((rec, i) => {
          const row = rows[i]
          if (!row) return rec

          // Clear old field that was mapped to this column
          const oldMapping = mapping.find((m) => m.csvColumn === csvColumn)
          const updated = { ...rec }
          if (oldMapping?.field && oldMapping.field !== fieldKey) {
            ;(updated as Record<string, string | null>)[oldMapping.field] = null
          }

          // Set new field
          if (fieldKey && row[colIdx]) {
            ;(updated as Record<string, string | null>)[fieldKey] = row[colIdx]
          }

          return updated
        })
      })
    },
    [headers, rows, mapping]
  )

  const validRecommenders = recommenders.filter(
    (r) => r.name && r.name.trim() !== '' && r.title && r.title.trim() !== ''
  )

  const invalidCount = recommenders.length - validRecommenders.length

  const handleImport = useCallback(async () => {
    setIsImporting(true)
    try {
      const payload = validRecommenders.map((r) => ({
        name: r.name!,
        title: r.title!,
        relationshipType: r.relationshipType || 'OTHER',
        relationshipContext: r.relationshipContext || `Recommender: ${r.name}`,
        email: r.email || null,
        phone: r.phone || null,
        linkedIn: r.linkedIn || null,
        countryRegion: r.countryRegion || null,
        organization: r.organization || null,
        bio: r.bio || null,
        credentials: r.credentials || null,
      }))

      const res = await fetch(
        `/api/case/${caseId}/recommenders/import`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', recommenders: payload }),
        }
      )

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to import')
      }

      const result = await res.json()
      toast.success(`Imported ${result.created} recommenders`)
      handleClose(false)
      onImported()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setIsImporting(false)
    }
  }, [caseId, validRecommenders, handleClose, onImported])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === 'upload' && 'Import CSV'}
            {step === 'preview' && 'Map Columns'}
            {step === 'confirm' && 'Confirm Import'}
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Upload a CSV file with recommender data'}
            {step === 'preview' &&
              'Review AI column mapping and adjust if needed'}
            {step === 'confirm' &&
              `Ready to import ${validRecommenders.length} recommenders`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="py-4">
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium">
                  Drop a CSV file here or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Max 50 rows. Column names can be anything -- AI will map them.
                </p>
              </div>
              {error && (
                <div className="mt-3 flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Preview + Map */}
          {step === 'preview' && (
            <div className="py-4 space-y-4">
              {isMapping ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Mapping columns with AI...
                  </p>
                </div>
              ) : (
                <>
                  {/* Column mapping */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Column Mapping
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {mapping.map((m) => (
                        <div
                          key={m.csvColumn}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span className="truncate min-w-0 flex-1 text-muted-foreground">
                            {m.csvColumn}
                          </span>
                          <Select
                            value={m.field ?? '_none'}
                            onValueChange={(val) =>
                              handleMappingChange(m.csvColumn, val)
                            }
                          >
                            <SelectTrigger className="w-40 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none">-- skip --</SelectItem>
                              {RECOMMENDER_FIELDS.map((f) => (
                                <SelectItem key={f.value} value={f.value}>
                                  {f.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Preview table */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Preview (first 5 rows)
                    </p>
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            {headers.map((h, i) => (
                              <th
                                key={i}
                                className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.slice(0, 5).map((row, i) => (
                            <tr key={i} className="border-b last:border-0">
                              {row.map((cell, j) => (
                                <td
                                  key={j}
                                  className="px-3 py-2 whitespace-nowrap max-w-[200px] truncate"
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Validation warnings */}
                  {invalidCount > 0 && (
                    <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {invalidCount} row{invalidCount !== 1 ? 's' : ''} missing
                      required fields (name, title) and will be skipped
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 'confirm' && (
            <div className="py-4 space-y-3">
              <div className="rounded-lg border p-4 space-y-2">
                {validRecommenders.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-sm py-1"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="font-medium">{r.name}</span>
                    <span className="text-muted-foreground">--</span>
                    <span className="text-muted-foreground">{r.title}</span>
                    {r.organization && (
                      <span className="text-muted-foreground">
                        @ {r.organization}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {invalidCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {invalidCount} row{invalidCount !== 1 ? 's' : ''} skipped due
                  to missing required fields
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 'preview' && !isMapping && (
            <>
              <Button variant="outline" onClick={reset}>
                Back
              </Button>
              <Button
                onClick={() => setStep('confirm')}
                disabled={validRecommenders.length === 0}
              >
                Continue ({validRecommenders.length} valid)
              </Button>
            </>
          )}
          {step === 'confirm' && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep('preview')}
                disabled={isImporting}
              >
                Back
              </Button>
              <Button onClick={handleImport} disabled={isImporting}>
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  `Import ${validRecommenders.length} recommenders`
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
