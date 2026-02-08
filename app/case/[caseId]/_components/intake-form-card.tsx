"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Check, Loader2 } from "lucide-react"

interface IntakeFormField {
  key: string
  label: string
  type: "text" | "number" | "boolean" | "textarea"
  placeholder?: string
}

interface IntakeFormCardProps {
  section: string
  fields: IntakeFormField[]
  prompt?: string
  caseId: string
  onSubmit?: (data: Record<string, unknown>) => void
}

export function IntakeFormCard({
  section,
  fields,
  prompt,
  caseId,
  onSubmit,
}: IntakeFormCardProps) {
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleChange = useCallback((key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true)
    try {
      // Save to intake API
      await fetch(`/api/case/${caseId}/intake`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { [section]: values },
        }),
      })
      setIsSubmitted(true)
      onSubmit?.(values)
    } catch (err) {
      console.error("Failed to submit intake form:", err)
    } finally {
      setIsSubmitting(false)
    }
  }, [caseId, section, values, onSubmit])

  if (isSubmitted) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20 p-4 max-w-md">
        <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
          <Check className="h-4 w-4" />
          <span className="text-sm font-medium">Information saved</span>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card p-4 max-w-md space-y-4">
      {prompt && <p className="text-sm text-muted-foreground">{prompt}</p>}

      <div className="space-y-3">
        {fields.map((field) => (
          <div key={field.key}>
            <label className="text-sm font-medium">{field.label}</label>
            {field.type === "boolean" ? (
              <div className="flex gap-2 mt-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(values[field.key] === true && "border-primary bg-primary/5")}
                  onClick={() => handleChange(field.key, true)}
                >
                  Yes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(values[field.key] === false && "border-primary bg-primary/5")}
                  onClick={() => handleChange(field.key, false)}
                >
                  No
                </Button>
              </div>
            ) : field.type === "textarea" ? (
              <textarea
                placeholder={field.placeholder}
                value={(values[field.key] as string) ?? ""}
                onChange={(e) => handleChange(field.key, e.target.value)}
                className="mt-1.5 w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            ) : (
              <Input
                type={field.type}
                placeholder={field.placeholder}
                value={(values[field.key] as string) ?? ""}
                onChange={(e) =>
                  handleChange(
                    field.key,
                    field.type === "number" ? Number(e.target.value) : e.target.value
                  )
                }
                className="mt-1.5"
              />
            )}
          </div>
        ))}
      </div>

      <Button
        size="sm"
        onClick={handleSubmit}
        disabled={isSubmitting || Object.keys(values).length === 0}
        className="w-full"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Saving...
          </>
        ) : (
          "Save"
        )}
      </Button>
    </div>
  )
}
