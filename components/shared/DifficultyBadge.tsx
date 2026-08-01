// import lib
import { cn } from "@/lib/utils";

// import components
import { Badge } from "@/components/ui/badge";

// import types
import type { RecipeDifficulty } from "@/types/recipes";

/**
 * The one place difficulty colour is decided.
 *
 * It wraps the `ui` Badge rather than replacing it so the shape, height and focus ring stay
 * whatever shadcn regenerates them as; only the colours are ours. The three pairs are dedicated
 * `--difficulty-*` tokens and not aliases of --secondary / --primary / --destructive — see
 * decision 4. Returns null for null so callers can render it unconditionally.
 *
 * A fourth difficulty would need a token pair here as well as an enum value in the database.
 * `Record<RecipeDifficulty, string>` is what makes that a compile error rather than an
 * unstyled badge: add a value to the enum, regenerate the types, and this map stops satisfying
 * its own type.
 */
const STYLES: Record<RecipeDifficulty, string> = {
  easy: "bg-difficulty-easy-bg text-difficulty-easy border-difficulty-easy/30",
  medium: "bg-difficulty-medium-bg text-difficulty-medium border-difficulty-medium/30",
  hard: "bg-difficulty-hard-bg text-difficulty-hard border-difficulty-hard/30",
};

export default function DifficultyBadge({ difficulty, className }: { difficulty: RecipeDifficulty | null; className?: string }) {
  if (!difficulty) return null;

  // No colour dot inside the pill — it was built in the mockup and read as noise.
  return (
    <Badge variant="outline" className={cn("capitalize", STYLES[difficulty], className)}>
      {difficulty}
    </Badge>
  );
}
