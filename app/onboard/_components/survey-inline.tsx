"use client";

import { useSurvey } from "../_lib/use-survey";
import { SurveyShell } from "./survey-shell";
import { SurveyStepBackground } from "./survey-step-background";
import { SurveyStepIntent } from "./survey-step-intent";
import { SurveyStepAwards } from "./survey-step-awards";
import { SurveyStepStanding } from "./survey-step-standing";
import { SurveyStepContributions } from "./survey-step-contributions";
import { SurveyStepLeadership } from "./survey-step-leadership";
import { SurveyStepEvidence } from "./survey-step-evidence";
import { SURVEY_SECTIONS } from "../_lib/survey-schema";
import type { SurveyData } from "../_lib/survey-schema";

interface SurveyInlineProps {
  caseId: string;
  initialData?: SurveyData;
  onComplete?: () => void;
}

export function SurveyInline({
  caseId,
  initialData = {},
  onComplete,
}: SurveyInlineProps) {
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
    onComplete,
  });

  const currentSection = SURVEY_SECTIONS[currentStep];

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <SurveyStepBackground
            data={data.background ?? {}}
            onChange={(updates) => updateSection("background", updates)}
            caseId={caseId}
          />
        );
      case 1:
        return (
          <SurveyStepIntent
            data={data.intent ?? {}}
            onChange={(updates) => updateSection("intent", updates)}
          />
        );
      case 2:
        return (
          <SurveyStepAwards
            data={data.awards ?? {}}
            onChange={(updates) => updateSection("awards", updates)}
          />
        );
      case 3:
        return (
          <SurveyStepStanding
            data={data.standing ?? {}}
            onChange={(updates) => updateSection("standing", updates)}
          />
        );
      case 4:
        return (
          <SurveyStepContributions
            data={data.contributions ?? {}}
            onChange={(updates) => updateSection("contributions", updates)}
          />
        );
      case 5:
        return (
          <SurveyStepLeadership
            data={data.leadership ?? {}}
            onChange={(updates) => updateSection("leadership", updates)}
          />
        );
      case 6:
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
  );
}
