// import lib
import { publicImageUrl } from "@/lib/supabase/storage";

// import components
import Image from "next/image";
import { Card, CardContent, CardTitle, CardDescription } from "../ui/card";

/**
 * A recipe in the grid, now with a 1:1 media area.
 *
 * Square because that is what the bucket holds — every photo is cropped to a square by the person
 * who uploaded it, so this crops nothing and the card cannot disagree with the article about how a
 * photo is framed (decision 13).
 *
 * **A recipe with no cover gets a generated tile rather than a placeholder.** Every recipe that
 * existed before this feature has no cover, and there is no edit path that would let one gain a
 * cover — so a mixed grid is the state of the site rather than an edge case that shrinks over
 * time. A dashed placeholder would announce a gap to visitors six times over, and omitting the
 * media entirely leaves the grid ragged for as long as the library is mixed. The tile is tinted
 * from the slug so a given recipe always gets the same colour, and carries the title's first
 * letter (decision 23).
 */

/**
 * Slug → a stable tile colour.
 *
 * FNV-1a rather than the usual `hash * 31 + c`, and that is not cargo-culting: slugs are lowercase
 * ASCII plus hyphens, which is a range of about 27 values, and `*31` over so narrow an alphabet
 * leaves the last few characters dominating the result. Taken over the six recipes on the site it
 * put four of them within 40° of each other — a grid of near-identical purple squares. FNV-1a
 * avalanches properly and spreads the same six across the circle.
 *
 * Lightness and chroma vary from other bits of the same hash, over ranges wide enough to be seen.
 * Hue alone is not enough: two slugs landing 7° apart is ordinary luck, and at a fixed lightness
 * and chroma they are the same orange square twice. A first attempt varied all three too narrowly
 * and produced exactly that.
 *
 * **This does not guarantee distinct tiles and cannot.** Nothing coordinates across the grid — the
 * card knows its own slug and nothing else, which is the property that makes a recipe's colour
 * stable as others are added and removed. Sixteen lightness/chroma combinations spread over the
 * circle only make a near-collision rare and an exact one read as coincidence rather than as a bug.
 */
function tileColor(slug: string) {
  let hash = 0x811c9dc5;

  for (const character of slug) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  const hue = hash % 360;
  const lightness = 0.48 + ((hash >>> 9) % 4) * 0.06;
  const chroma = 0.05 + ((hash >>> 17) % 4) * 0.04;

  return `oklch(${lightness.toFixed(2)} ${chroma.toFixed(2)} ${hue})`;
}

export default function RecipeCard({ slug, title, description, cover }: { slug: string; title: string; description?: string | null; cover?: string | null }) {
  return (
    <Card className="overflow-hidden py-0">
      {cover ? (
        <Image src={publicImageUrl(cover)} alt="" width={600} height={600} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="aspect-square w-full object-cover" />
      ) : (
        // aria-hidden: the title is right below it, so a screen reader gains nothing from a
        // decorative letter it would otherwise read twice.
        <div aria-hidden className="flex aspect-square w-full items-center justify-center text-6xl font-bold text-white/80" style={{ backgroundColor: tileColor(slug) }}>
          {title.trim().charAt(0).toUpperCase()}
        </div>
      )}

      <CardContent className="py-5">
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardContent>
    </Card>
  );
}
