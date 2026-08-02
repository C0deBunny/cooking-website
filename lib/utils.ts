import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Turns a title into a URL slug matching the `check` constraint on `recipes.slug`
 * (`^[a-z0-9]+(-[a-z0-9]+)*$`).
 *
 * NFD + stripping combining marks is what turns "Gestoofde Bakbanaan Crème" into
 * "gestoofde-bakbanaan-creme" rather than dropping the accented letters entirely.
 */
export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Relative for the past week, absolute after that.
 *
 * Two deliberate choices, both about the table being server-rendered and then hydrated.
 * Granularity stops at whole days, because anything finer would let the server and the browser
 * disagree between the two renders; and the locale is pinned rather than left to default,
 * because the server's default is not the visitor's.
 */
export function formatTimestamp(iso: string) {
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);

  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;

  return then.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
