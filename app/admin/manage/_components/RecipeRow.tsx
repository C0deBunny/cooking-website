// import lib
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronRight, ExternalLink, Eye, EyeOff, SquarePen, Trash2, TriangleAlert } from "lucide-react";
import { cn, formatTimestamp } from "@/lib/utils";

// import actions
import { deleteRecipe, togglePublished } from "@/lib/recipes/actions";

// import components
import Link from "next/link";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// import types
import type { Recipe } from "@/types/recipes";

/**
 * One row, plus its detail row when open.
 *
 * Not a client boundary of its own — RecipeTable carries the "use client" and everything below
 * it is client by inheritance. Splitting the file is for readability only.
 *
 * Two things here are less arbitrary than they look. The action buttons stop propagation,
 * because they sit inside a row whose own click toggles the expand, and without it every publish
 * would also open the panel. And the chevron is a real <button> carrying aria-expanded rather
 * than a decorative icon: the row's onClick is a mouse convenience, and a clickable <tr> is not
 * focusable, not announced, and unreachable by keyboard.
 */

type Props = {
  recipe: Recipe;
  isOpen: boolean;
  onToggle: () => void;
};

/** null rather than a dash, so the caller decides how "not recorded" renders. */
function formatDuration(recipe: Recipe) {
  const parts: string[] = [];

  if (recipe.prep_minutes) parts.push(`${recipe.prep_minutes} min prep`);
  if (recipe.cook_minutes) parts.push(`${recipe.cook_minutes} min cook`);

  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];

  return `${parts.join(" · ")} (${(recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0)} min total)`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </>
  );
}

const NOT_SET = <span className="text-muted-foreground italic">Not set</span>;

export default function RecipeRow({ recipe, isOpen, onToggle }: Props) {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const detailId = `recipe-detail-${recipe.id}`;

  // Both destinations exist. A draft has no public page — RLS 404s it even for the owner — so it
  // points at the preview route, which reads with the authenticated client instead.
  const viewHref = recipe.published ? `/recipes/${recipe.slug}` : `/admin/preview/${recipe.slug}`;

  function handleTogglePublished() {
    startTransition(async () => {
      const result = await togglePublished(recipe.id, !recipe.published);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(recipe.published ? `"${recipe.title}" is back to a draft.` : `"${recipe.title}" is now live.`);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteRecipe(recipe.id);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setConfirmOpen(false);
      toast.success(`"${recipe.title}" was deleted.`);
    });
  }

  return (
    <>
      <TableRow onClick={onToggle} className="cursor-pointer">
        <TableCell className="w-10 pl-4">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
            aria-expanded={isOpen}
            aria-controls={isOpen ? detailId : undefined}
            aria-label={`${isOpen ? "Collapse" : "Expand"} details for ${recipe.title}`}
            className="grid size-6 place-items-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ChevronRight className={cn("size-4 transition-transform", isOpen && "rotate-90")} />
          </button>
        </TableCell>

        <TableCell className="font-medium">{recipe.title}</TableCell>

        <TableCell className="w-32 text-center">{recipe.published ? <Badge variant="secondary">Published</Badge> : <Badge variant="outline">Draft</Badge>}</TableCell>

        <TableCell className="w-32 pl-8 text-muted-foreground tabular-nums">{formatTimestamp(recipe.updated_at)}</TableCell>

        <TableCell className="w-40 pr-4">
          {/* One stopPropagation for the whole group rather than four. */}
          <div className="flex justify-end gap-0.5" onClick={(event) => event.stopPropagation()}>
            <Tooltip>
              <TooltipTrigger asChild>
                {/* Disabled buttons swallow pointer events, so the tooltip needs a wrapper to hang off. */}
                <span>
                  <Button variant="ghost" size="icon-sm" disabled aria-label="Edit recipe">
                    <SquarePen />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>The edit form isn&apos;t built yet</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={handleTogglePublished} disabled={isPending} aria-label={recipe.published ? "Unpublish recipe" : "Publish recipe"}>
                  {isPending ? <Spinner /> : recipe.published ? <EyeOff /> : <Eye />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{recipe.published ? "Unpublish" : "Publish"}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" asChild aria-label={recipe.published ? "View on site" : "Preview draft"}>
                  <Link href={viewHref}>
                    <ExternalLink />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{recipe.published ? "View on site" : "Preview draft"}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={() => setConfirmOpen(true)} disabled={isPending} aria-label="Delete recipe" className="hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
          </div>
        </TableCell>
      </TableRow>

      {isOpen && (
        <TableRow className="hover:bg-transparent">
          <TableCell id={detailId} colSpan={5} className="bg-muted/40 p-0 whitespace-normal">
            <div className="grid gap-x-12 gap-y-6 px-14 py-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <div className="space-y-4">
                <div>
                  <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Description</p>
                  <p className="text-sm">{recipe.description ?? NOT_SET}</p>
                </div>

                <div>
                  <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Notes</p>
                  <p className="text-sm">{recipe.notes ?? NOT_SET}</p>
                </div>

                {!recipe.published && (
                  <p className="inline-flex items-center gap-2 rounded-lg bg-destructive/10 px-2.5 py-1.5 text-xs font-medium text-destructive">
                    <TriangleAlert className="size-3.5" />
                    Draft — not visible to visitors
                  </p>
                )}
              </div>

              <dl className="grid grid-cols-[7rem_minmax(0,1fr)] content-start gap-x-4 gap-y-2">
                <Field label="Difficulty">{recipe.difficulty ? <span className="capitalize">{recipe.difficulty}</span> : NOT_SET}</Field>
                <Field label="Time">{formatDuration(recipe) ?? NOT_SET}</Field>
                <Field label="Serves">{recipe.servings ?? NOT_SET}</Field>
                <Field label="Created">{formatTimestamp(recipe.created_at)}</Field>
                <Field label="Updated">{formatTimestamp(recipe.updated_at)}</Field>
              </dl>
            </div>
          </TableCell>
        </TableRow>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <TriangleAlert className="text-destructive" />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete &ldquo;{recipe.title}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>Its ingredients and steps are deleted with it. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            {/* onClick, not onSelect: this is Radix's Close button, a plain <button>, so onSelect
                binds the DOM `select` event — which fires on text selection and never on a click.
                It typechecks (ButtonHTMLAttributes declares it) and silently does nothing.

                preventDefault is what keeps the dialog open while the delete runs, so a failure has
                somewhere to report back to instead of closing over its own error: Radix composes
                its own close handler behind ours and skips it when the event is defaultPrevented. */}
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
            >
              {isPending ? <Spinner /> : <Trash2 />}
              Delete recipe
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
