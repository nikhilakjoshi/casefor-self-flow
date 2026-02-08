"use client"

import { Sheet, SheetContent } from "@/components/ui/sheet"
import { useIntake } from "../_lib/use-intake"
import { IntakeShell } from "./intake-shell"
import { IntakeStepBackground } from "./intake-step-background"
import { IntakeStepAchievements } from "./intake-step-achievements"
import { IntakeStepImmigration } from "./intake-step-immigration"
import { IntakeStepPreferences } from "./intake-step-preferences"
import type { IntakeData, IntakeSection } from "../_lib/intake-schema"

interface IntakeSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  caseId: string
  initialData?: IntakeData
  onComplete?: () => void
}

export function IntakeSheet({
  open,
  onOpenChange,
  caseId,
  initialData = {},
  onComplete,
}: IntakeSheetProps) {
  const handleComplete = () => {
    onOpenChange(false)
    onComplete?.()
  }

  const {
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
  } = useIntake({
    caseId,
    initialData,
    onComplete: handleComplete,
  })

  const sections: IntakeSection[] = ["background", "achievements", "immigration", "preferences"]
  const currentSection = sections[currentStep]

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <IntakeStepBackground
            data={data.background ?? {}}
            onChange={(updates) => updateSection("background", updates)}
          />
        )
      case 1:
        return (
          <IntakeStepAchievements
            data={data.achievements ?? {}}
            onChange={(updates) => updateSection("achievements", updates)}
          />
        )
      case 2:
        return (
          <IntakeStepImmigration
            data={data.immigration ?? {}}
            onChange={(updates) => updateSection("immigration", updates)}
          />
        )
      case 3:
        return (
          <IntakeStepPreferences
            data={data.preferences ?? {}}
            onChange={(updates) => updateSection("preferences", updates)}
          />
        )
      default:
        return null
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl p-0"
        showCloseButton={false}
      >
        <IntakeShell
          currentStep={currentStep}
          skippedSections={skippedSections}
          saveStatus={saveStatus}
          onNext={nextStep}
          onPrev={prevStep}
          onSkip={() => skipSection(currentSection)}
          onSkipRemaining={skipRemaining}
          onComplete={completeIntake}
          isLastStep={currentStep === 3}
        >
          {renderStep()}
        </IntakeShell>
      </SheetContent>
    </Sheet>
  )
}
