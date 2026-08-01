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
