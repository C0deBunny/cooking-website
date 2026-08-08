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

/** Stable per slug, and spread over the hue circle so neighbouring recipes rarely collide. */
function tileHue(slug: string) {
  let hash = 0;

  for (const character of slug) {
    hash = (hash * 31 + character.charCodeAt(0)) % 360;
  }

  return hash;
}

export default function RecipeCard({ slug, title, description, cover }: { slug: string; title: string; description?: string | null; cover?: string | null }) {
  return (
    <Card className="overflow-hidden py-0">
      {cover ? (
        <Image src={publicImageUrl(cover)} alt="" width={600} height={600} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="aspect-square w-full object-cover" />
      ) : (
        // aria-hidden: the title is right below it, so a screen reader gains nothing from a
        // decorative letter it would otherwise read twice.
        <div aria-hidden className="flex aspect-square w-full items-center justify-center text-6xl font-bold text-white/80" style={{ backgroundColor: `oklch(0.55 0.12 ${tileHue(slug)})` }}>
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
