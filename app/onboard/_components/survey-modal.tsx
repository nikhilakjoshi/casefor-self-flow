"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useSurvey } from "../_lib/use-survey";
import { SurveyShell } from "./survey-shell";
import { SurveyStepPersonal } from "./survey-step-personal";
import { SurveyStepBackground } from "./survey-step-background";
import { SurveyStepIntent } from "./survey-step-intent";
import { SurveyStepAwards } from "./survey-step-awards";
import { SurveyStepStanding } from "./survey-step-standing";
import { SurveyStepContributions } from "./survey-step-contributions";
import { SurveyStepLeadership } from "./survey-step-leadership";
import { SurveyStepEvidence } from "./survey-step-evidence";
import { SURVEY_SECTIONS } from "../_lib/survey-schema";
import type { SurveyData, SurveySection } from "../_lib/survey-schema";

interface SurveyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  initialData?: SurveyData;
  onComplete?: () => void;
}

export function SurveyModal({
  open,
  onOpenChange,
  caseId,
  initialData = {},
  onComplete,
}: SurveyModalProps) {
  const handleComplete = () => {
    onOpenChange(false);
    onComplete?.();
  };

  const {
    currentStep,
    totalSteps,
    data,
    skippedSections,
    saveStatus,
    updateSection,
    skipSection,
    skipAll,
    nextStep,
    prevStep,
    completeSurvey,
  } = useSurvey({
    caseId,
    initialData,
    onComplete: handleComplete,
  });

  const currentSection = SURVEY_SECTIONS[currentStep];

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <SurveyStepPersonal
            data={data.personal ?? {}}
            onChange={(updates) => updateSection("personal", updates)}
          />
        );
      case 1:
        return (
          <SurveyStepBackground
            data={data.background ?? {}}
            onChange={(updates) => updateSection("background", updates)}
          />
        );
      case 2:
        return (
          <SurveyStepIntent
            data={data.intent ?? {}}
            onChange={(updates) => updateSection("intent", updates)}
          />
        );
      case 3:
        return (
          <SurveyStepAwards
            data={data.awards ?? {}}
            onChange={(updates) => updateSection("awards", updates)}
          />
        );
      case 4:
        return (
          <SurveyStepStanding
            data={data.standing ?? {}}
            onChange={(updates) => updateSection("standing", updates)}
          />
        );
      case 5:
        return (
          <SurveyStepContributions
            data={data.contributions ?? {}}
            onChange={(updates) => updateSection("contributions", updates)}
          />
        );
      case 6:
        return (
          <SurveyStepLeadership
            data={data.leadership ?? {}}
            onChange={(updates) => updateSection("leadership", updates)}
          />
        );
      case 7:
        return (
          <SurveyStepEvidence
            data={data.evidence ?? {}}
            onChange={(updates) => updateSection("evidence", updates)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3/5 w-full h-[90vh] p-0 gap-0 flex flex-col">
        <SurveyShell
          currentStep={currentStep}
          skippedSections={skippedSections}
          saveStatus={saveStatus}
          onNext={nextStep}
          onPrev={prevStep}
          onSkip={() => skipSection(currentSection)}
          onSkipAll={skipAll}
          onComplete={completeSurvey}
          isLastStep={currentStep === totalSteps - 1}
        >
          {renderStep()}
        </SurveyShell>
      </DialogContent>
    </Dialog>
  );
}
