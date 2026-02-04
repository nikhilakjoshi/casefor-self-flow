import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type Strength = "Strong" | "Weak" | "None";

interface CriterionCardProps {
  criterionName: string;
  strength: Strength;
  reason: string;
  evidence: string[];
}

function getStrengthStyles(strength: Strength): string {
  switch (strength) {
    case "Strong":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "Weak":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "None":
      return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  }
}

export function CriterionCard({
  criterionName,
  strength,
  reason,
  evidence,
}: CriterionCardProps) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium">{criterionName}</h3>
        <Badge className={cn("shrink-0", getStrengthStyles(strength))}>
          {strength}
        </Badge>
      </div>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{reason}</p>
      {evidence.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-500">
            Evidence
          </p>
          <ul className="space-y-1.5">
            {evidence.map((quote, idx) => (
              <li
                key={idx}
                className="border-l-2 border-zinc-300 pl-3 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
              >
                &ldquo;{quote}&rdquo;
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
