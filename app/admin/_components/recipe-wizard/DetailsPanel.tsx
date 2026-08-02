// import lib
import { Link2, TriangleAlert } from "lucide-react";
import { cn, slugify } from "@/lib/utils";
import { digitsOnly, NO_DIFFICULTY } from "./draft";

// import components
import PanelNav from "./PanelNav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// import types
import type { Draft } from "./draft";

const TITLE_MAX = 100;
const DESCRIPTION_MAX = 160;

/**
 * The address line under the title, which is the whole of the slug UI.
 *
 * There is no slug field, on create or on edit: the address is derived from the title and
 * follows it forever (decision 9). That leaves three things this line has to be able to say.
 *
 * The third one is the reason it exists at all. `slugify()` keeps only `[a-z0-9]` after stripping
 * diacritics, so "Café" becomes `cafe` but "№1", an emoji or non-Latin script becomes `""` — and
 * `detailsSchema` requires `slug.min(1)`. Without a message here that is a filled-in title, a
 * step that will not tick, a Review step that stays locked, and nothing anywhere saying why.
 *
 * `takenSlug` reaches this from either of two places, and the line does not distinguish them: the
 * debounced check in `RecipeWizard` while the title is being typed, or a 23505 returned by a save
 * that raced it. It is the slug rather than a flag so the warning clears itself — see there.
 *
 * There is no "checking…" state on purpose. The check is advisory to the *user* as well: it is
 * either sure the address is taken or it says nothing, and a spinner on the address line would
 * invite waiting for an answer that may never come.
 */
function AddressLine({ title, takenSlug }: { title: string; takenSlug?: string }) {
  const slug = slugify(title);
  const hasTitle = title.trim().length > 0;

  const unsluggable = hasTitle && !slug;
  const taken = !!slug && slug === takenSlug;

  return (
    <p className={cn("mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-foreground/5 px-3 py-2 text-xs text-muted-foreground", (unsluggable || taken) && "bg-destructive/10 text-destructive")}>
      {unsluggable || taken ? <TriangleAlert className="size-3.5 shrink-0" /> : <Link2 className="size-3.5 shrink-0" />}

      {unsluggable ? (
        <>
          <span className="font-mono">No web address</span>
          <span>— this title has no letters or numbers to build one from</span>
        </>
      ) : (
        <>
          <span className="font-mono">/recipes/{slug || "…"}</span>
          <span>{taken ? "— already taken, choose a different title" : "— the address, taken from the title"}</span>
        </>
      )}
    </p>
  );
}

type Props = {
  draft: Draft;
  takenSlug?: string;
  onPatch: (patch: Partial<Draft>) => void;
  onNext: () => void;
};

export default function DetailsPanel({ draft, takenSlug, onPatch, onNext }: Props) {
  return (
    <Card className="py-6">
      <CardHeader>
        <CardTitle className="text-lg font-bold">Details</CardTitle>
        <CardDescription>The basics of your recipe.</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title">
              Title <span className="text-destructive">*</span>
            </Label>

            <div className="relative">
              <Input id="title" value={draft.title} maxLength={TITLE_MAX} onChange={(event) => onPatch({ title: event.target.value })} placeholder="Gestoofde bakbanaan" className="pr-16" />
              <span className="pointer-events-none absolute right-3 bottom-2 text-xs text-muted-foreground tabular-nums">
                {draft.title.length}/{TITLE_MAX}
              </span>
            </div>

            <AddressLine title={draft.title} takenSlug={takenSlug} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Short description</Label>

            <div className="relative">
              <Textarea
                id="description"
                rows={2}
                maxLength={DESCRIPTION_MAX}
                value={draft.description}
                onChange={(event) => onPatch({ description: event.target.value })}
                placeholder="One or two lines that show under the title."
                className="pr-16"
              />
              <span className="pointer-events-none absolute right-3 bottom-2 text-xs text-muted-foreground tabular-nums">
                {draft.description.length}/{DESCRIPTION_MAX}
              </span>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="difficulty">Difficulty</Label>
              <Select value={draft.difficulty} onValueChange={(value) => onPatch({ difficulty: value })}>
                <SelectTrigger id="difficulty" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_DIFFICULTY}>Not set</SelectItem>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Not type="number": the spinner would sit exactly where the suffix does, and
                inputMode="numeric" still brings up a numeric keypad. digitsOnly() is what keeps
                the step's ✓ honest — see decision 2. */}
            <MinutesField id="prep" label="Prep time" value={draft.prep_minutes} placeholder="15" onChange={(value) => onPatch({ prep_minutes: value })} />
            <MinutesField id="cook" label="Cook time" value={draft.cook_minutes} placeholder="30" onChange={(value) => onPatch({ cook_minutes: value })} />
          </div>
        </div>

        <PanelNav onNext={onNext} nextLabel="Next: Ingredients" />
      </CardContent>
    </Card>
  );
}

function MinutesField({ id, label, value, placeholder, onChange }: { id: string; label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input id={id} inputMode="numeric" value={value} placeholder={placeholder} onChange={(event) => onChange(digitsOnly(event.target.value))} className="pr-20" />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">minutes</span>
      </div>
    </div>
  );
}
