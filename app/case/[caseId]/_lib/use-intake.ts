"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import type { IntakeData, IntakeSection } from "./intake-schema"

interface UseIntakeOptions {
  caseId: string
  initialData?: IntakeData
  onComplete?: () => void
}

type SaveStatus = "idle" | "saving" | "saved" | "error"

export function useIntake({ caseId, initialData = {}, onComplete }: UseIntakeOptions) {
  const [currentStep, setCurrentStep] = useState(0)
  const [data, setData] = useState<IntakeData>(initialData)
  const [skippedSections, setSkippedSections] = useState<IntakeSection[]>([])
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const pendingUpdates = useRef<IntakeData>({})
  const saveTimeout = useRef<NodeJS.Timeout | undefined>(undefined)

  const save = useCallback(async (updates: IntakeData, immediate = false) => {
    // Merge pending updates
    pendingUpdates.current = {
      ...pendingUpdates.current,
      ...updates,
    }

    // Debounce saves unless immediate
    if (saveTimeout.current) clearTimeout(saveTimeout.current)

    const doSave = async () => {
      setSaveStatus("saving")
      try {
        const res = await fetch(`/api/case/${caseId}/intake`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: pendingUpdates.current }),
        })
        if (res.ok) {
          pendingUpdates.current = {}
          setSaveStatus("saved")
          setTimeout(() => setSaveStatus("idle"), 2000)
        } else {
          setSaveStatus("error")
        }
      } catch {
        setSaveStatus("error")
      }
    }

    if (immediate) {
      await doSave()
    } else {
      saveTimeout.current = setTimeout(doSave, 1000)
    }
  }, [caseId])

  const updateSection = useCallback(
    <K extends keyof IntakeData>(section: K, sectionData: IntakeData[K]) => {
      setData((prev) => {
        const updated = { ...prev, [section]: { ...prev[section], ...sectionData } }
        save({ [section]: updated[section] })
        return updated
      })
    },
    [save]
  )

  const skipSection = useCallback(
    (section: IntakeSection) => {
      setSkippedSections((prev) => {
        if (prev.includes(section)) return prev
        const updated = [...prev, section]
        // Save skipped sections to backend
        fetch(`/api/case/${caseId}/intake`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skippedSections: updated }),
        })
        return updated
      })
      nextStep()
    },
    [caseId]
  )

  const skipRemaining = useCallback(async () => {
    const remaining: IntakeSection[] = ["background", "achievements", "immigration", "preferences"]
      .slice(currentStep) as IntakeSection[]
    const updated = [...skippedSections, ...remaining.filter((s) => !skippedSections.includes(s))]
    setSkippedSections(updated)

    await fetch(`/api/case/${caseId}/intake`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skippedSections: updated, intakeStatus: "SKIPPED" }),
    })
    onComplete?.()
  }, [caseId, currentStep, skippedSections, onComplete])

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev >= 3) {
        // Last step - complete intake
        fetch(`/api/case/${caseId}/intake`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intakeStatus: "COMPLETED" }),
        }).then(() => onComplete?.())
        return prev
      }
      return prev + 1
    })
  }, [caseId, onComplete])

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(0, prev - 1))
  }, [])

  const completeIntake = useCallback(async () => {
    // Save any pending updates immediately
    await save(data, true)
    await fetch(`/api/case/${caseId}/intake`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intakeStatus: skippedSections.length > 0 ? "PARTIAL" : "COMPLETED" }),
    })
    onComplete?.()
  }, [caseId, data, save, skippedSections.length, onComplete])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
    }
  }, [])

  return {
    currentStep,
    data,
    skippedSections,
    saveStatus,
    updateSection,
    skipSection,
    skipRemaining,
    nextStep,
    prevStep,
    completeIntake,
    setCurrentStep,
  }
}
