"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import type { SurveyData, SurveySection } from "./survey-schema"
import { SURVEY_SECTIONS } from "./survey-schema"

interface UseSurveyOptions {
  caseId: string
  initialData?: SurveyData
  onComplete?: () => void
}

type SaveStatus = "idle" | "saving" | "saved" | "error"

export function useSurvey({ caseId, initialData = {}, onComplete }: UseSurveyOptions) {
  const [currentStep, setCurrentStep] = useState(0)
  const [data, setData] = useState<SurveyData>(initialData)
  const [skippedSections, setSkippedSections] = useState<SurveySection[]>([])
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const pendingUpdates = useRef<SurveyData>({})
  const saveTimeout = useRef<NodeJS.Timeout | undefined>(undefined)

  // Sync data when initialData changes (e.g., after extraction)
  useEffect(() => {
    if (Object.keys(initialData).length > 0) {
      setData(initialData)
    }
  }, [initialData])

  const save = useCallback(async (updates: SurveyData, immediate = false) => {
    pendingUpdates.current = {
      ...pendingUpdates.current,
      ...updates,
    }

    if (saveTimeout.current) clearTimeout(saveTimeout.current)

    const doSave = async () => {
      setSaveStatus("saving")
      try {
        const res = await fetch(`/api/case/${caseId}/survey`, {
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
      saveTimeout.current = setTimeout(doSave, 2000)
    }
  }, [caseId])

  const updateSection = useCallback(
    <K extends keyof SurveyData>(section: K, sectionData: SurveyData[K]) => {
      setData((prev) => {
        const updated = { ...prev, [section]: { ...prev[section], ...sectionData } }
        save({ [section]: updated[section] })
        return updated
      })
    },
    [save]
  )

  const skipSection = useCallback(
    (section: SurveySection) => {
      setSkippedSections((prev) => {
        if (prev.includes(section)) return prev
        const updated = [...prev, section]
        fetch(`/api/case/${caseId}/survey`, {
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

  const triggerReanalysis = useCallback(async () => {
    try {
      await fetch(`/api/case/${caseId}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    } catch (err) {
      console.error("Reanalysis failed:", err)
    }
  }, [caseId])

  const skipAll = useCallback(async () => {
    const remaining = SURVEY_SECTIONS.slice(currentStep) as SurveySection[]
    const updated = [...skippedSections, ...remaining.filter((s) => !skippedSections.includes(s))]
    setSkippedSections(updated)

    await fetch(`/api/case/${caseId}/survey`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skippedSections: updated, intakeStatus: "SKIPPED" }),
    })
    // Trigger reanalysis to merge survey data
    triggerReanalysis()
    onComplete?.()
  }, [caseId, currentStep, skippedSections, onComplete, triggerReanalysis])

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev >= SURVEY_SECTIONS.length - 1) {
        return prev
      }
      return prev + 1
    })
  }, [])

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(0, prev - 1))
  }, [])

  const completeSurvey = useCallback(async () => {
    await save(data, true)
    await fetch(`/api/case/${caseId}/survey`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intakeStatus: skippedSections.length > 0 ? "PARTIAL" : "COMPLETED" }),
    })
    // Trigger reanalysis to merge survey data
    triggerReanalysis()
    onComplete?.()
  }, [caseId, data, save, skippedSections.length, onComplete, triggerReanalysis])

  useEffect(() => {
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
    }
  }, [])

  return {
    currentStep,
    totalSteps: SURVEY_SECTIONS.length,
    data,
    skippedSections,
    saveStatus,
    updateSection,
    skipSection,
    skipAll,
    nextStep,
    prevStep,
    completeSurvey,
    setCurrentStep,
  }
}
