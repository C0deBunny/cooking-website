// import lib
import { Check, ChefHat, Info, ListOrdered, Lock, Utensils } from "lucide-react";
import { cn } from "@/lib/utils";

// import components
import { Card } from "@/components/ui/card";

// import types
import type { LucideIcon } from "lucide-react";

/**
 * The four step headings, and the only place completeness is shown.
 *
 * Steps 1–3 are always reachable — someone who wants to fill in the method first should be able
 * to. Review is the exception: it is locked until all three parse, because there is nothing to
 * review otherwise and its Save button would fail against the same schema.
 *
 * The ✓ on each of the first three is that step's `safeParse(...).success`, passed in. There is
 * no second notion of "complete" anywhere in the wizard.
 */

export const STEPS: { title: string; icon: LucideIcon }[] = [
  { title: "Details", icon: Info },
  { title: "Ingredients", icon: Utensils },
  { title: "Steps", icon: ListOrdered },
  { title: "Review & Publish", icon: ChefHat },
];

export default function Stepper({ step, complete, onGo }: { step: number; complete: boolean[]; onGo: (step: number) => void }) {
  const allComplete = complete.every(Boolean);

  return (
    <Card className="mb-6 grid gap-4 px-6 py-5 sm:grid-cols-2 lg:grid-cols-4">
      {STEPS.map((entry, index) => {
        const isReview = index === 3;
        const isLocked = isReview && !allComplete;
        const isComplete = !isReview && complete[index];
        const isCurrent = step === index;
        const Icon = entry.icon;

        const status = isLocked ? "Locked" : isComplete ? "Complete" : isReview ? "Ready" : isCurrent ? "In progress" : "Not started";

        return (
          <button
            key={entry.title}
            type="button"
            disabled={isLocked}
            onClick={() => onGo(index)}
            aria-current={isCurrent ? "step" : undefined}
            className="flex min-w-0 items-start gap-3 rounded-xl p-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-full border border-transparent bg-muted text-muted-foreground transition-colors",
                isCurrent && "bg-primary text-primary-foreground",
                isComplete && !isCurrent && "border-difficulty-easy/35 bg-difficulty-easy-bg text-difficulty-easy"
              )}
            >
              <Icon className="size-4" />
            </span>

            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-bold">
                <span className="truncate">{entry.title}</span>
                {isComplete ? <Check className="size-3.5 shrink-0 text-difficulty-easy" /> : null}
              </span>

              <span className={cn("flex items-center gap-1 text-xs text-muted-foreground", isComplete && "text-difficulty-easy")}>
                {isLocked ? <Lock className="size-3" /> : null}
                {status}
              </span>
            </span>
          </button>
        );
      })}
    </Card>
  );
}
