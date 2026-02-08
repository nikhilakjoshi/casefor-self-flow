"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, SkipForward, Check, Loader2 } from "lucide-react"
import { SURVEY_SECTIONS, SECTION_LABELS, type SurveySection } from "../_lib/survey-schema"

interface SurveyShellProps {
  currentStep: number
  skippedSections: SurveySection[]
  saveStatus: "idle" | "saving" | "saved" | "error"
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
  onSkipAll: () => void
  onComplete: () => void
  isLastStep: boolean
  children: React.ReactNode
}

export function SurveyShell({
  currentStep,
  skippedSections,
  saveStatus,
  onNext,
  onPrev,
  onSkip,
  onSkipAll,
  onComplete,
  isLastStep,
  children,
}: SurveyShellProps) {
  const currentSection = SURVEY_SECTIONS[currentStep]

  return (
    <div className="flex flex-col h-full">
      {/* Progress header */}
      <div className="shrink-0 px-6 py-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Complete Your Profile</h2>
            <p className="text-sm text-muted-foreground">
              Step {currentStep + 1} of {SURVEY_SECTIONS.length}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {saveStatus === "saving" && (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving...
              </>
            )}
            {saveStatus === "saved" && (
              <>
                <Check className="h-3 w-3 text-green-500" />
                Saved
              </>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1">
          {SURVEY_SECTIONS.map((section, idx) => {
            const isActive = idx === currentStep
            const isCompleted = idx < currentStep && !skippedSections.includes(section)
            const isSkipped = skippedSections.includes(section)

            return (
              <div
                key={section}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  isActive && "bg-primary",
                  isCompleted && "bg-green-500",
                  isSkipped && "bg-muted-foreground/30",
                  !isActive && !isCompleted && !isSkipped && "bg-muted"
                )}
              />
            )
          })}
        </div>
        <p className="text-sm font-medium mt-2">
          {SECTION_LABELS[currentSection]}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">{children}</div>

      {/* Footer navigation */}
      <div className="shrink-0 px-6 py-4 border-t bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onPrev}
              disabled={currentStep === 0}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            <Button variant="ghost" size="sm" onClick={onSkip} className="gap-1 text-muted-foreground">
              <SkipForward className="h-4 w-4" />
              Skip
            </Button>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onSkipAll}>
              Skip all
            </Button>
            {isLastStep ? (
              <Button size="sm" onClick={onComplete} className="gap-1">
                <Check className="h-4 w-4" />
                Complete
              </Button>
            ) : (
              <Button size="sm" onClick={onNext} className="gap-1">
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
