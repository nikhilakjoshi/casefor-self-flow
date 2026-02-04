"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CriterionCard, type Strength } from "./criterion-card";
import { EB1A_CRITERIA } from "@/lib/eb1a-criteria";

interface CriterionResultData {
  criterionId: string;
  strength: Strength;
  reason: string;
  evidence: string[];
}

interface ResultsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  criteria: CriterionResultData[];
  strongCount: number;
  weakCount: number;
}

function getCriterionName(criterionId: string): string {
  const criterion = EB1A_CRITERIA.find((c) => c.id === criterionId);
  return criterion?.name ?? criterionId;
}

export function ResultsModal({
  open,
  onOpenChange,
  criteria,
  strongCount,
  weakCount,
}: ResultsModalProps) {
  const meetsThreshold = strongCount >= 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>EB-1A Evaluation Results</DialogTitle>
          <DialogDescription>
            Analysis of your resume against the 10 EB-1A criteria
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="font-medium text-green-700 dark:text-green-400">
                {strongCount} Strong
              </span>
            </div>
            <div>
              <span className="font-medium text-yellow-700 dark:text-yellow-400">
                {weakCount} Weak
              </span>
            </div>
            <div>
              <span className="font-medium text-zinc-600 dark:text-zinc-400">
                {10 - strongCount - weakCount} None
              </span>
            </div>
          </div>
          <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
            USCIS requires{" "}
            <span className="font-medium">at least 3 criteria</span> with strong
            evidence.{" "}
            {meetsThreshold ? (
              <span className="text-green-700 dark:text-green-400">
                You meet this threshold.
              </span>
            ) : (
              <span className="text-yellow-700 dark:text-yellow-400">
                Consider strengthening {3 - strongCount} more criteria.
              </span>
            )}
          </p>
        </div>

        <div className="mt-4 space-y-3">
          {criteria.map((c) => (
            <CriterionCard
              key={c.criterionId}
              criterionName={getCriterionName(c.criterionId)}
              strength={c.strength}
              reason={c.reason}
              evidence={c.evidence}
            />
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
