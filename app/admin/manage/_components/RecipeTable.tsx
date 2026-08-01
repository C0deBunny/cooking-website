"use client";

// import lib
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Plus, Search, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

// import components
import Link from "next/link";
import RecipeRow from "./RecipeRow";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

// import types
import type { Recipes } from "@/types/recipes";

/**
 * The one client boundary on this page. It owns the search box, the status filter, the sort and
 * the accordion, and it renders the rows — so everything below it is client by inheritance.
 *
 * That is a deliberate departure from "server components by default": three controls plus
 * per-row expansion is state, which is exactly the condition the convention names. Filtering and
 * sorting run over the rows already in memory rather than through the query, so every control is
 * instant. That assumption holds at a few dozen recipes and stops holding at a few hundred, at
 * which point filtering belongs in the query.
 *
 * The state is not in the URL, so filters do not survive a refresh and are not linkable. That is
 * recoverable later by seeding from searchParams and pushing back with history.replaceState,
 * without restructuring anything here.
 */

type StatusFilter = "all" | "published" | "draft";
type SortKey = "title" | "updated_at";
type SortDirection = "asc" | "desc";

function SortableHead({
  label,
  column,
  sortKey,
  direction,
  onSort,
  className,
}: {
  label: string;
  column: SortKey;
  sortKey: SortKey;
  direction: SortDirection;
  onSort: (column: SortKey) => void;
  className?: string;
}) {
  const active = sortKey === column;
  const Icon = !active ? ChevronsUpDown : direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        aria-label={`Sort by ${label}`}
        className="inline-flex items-center gap-1.5 rounded-md outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {label}
        <Icon className={cn("size-3.5", active ? "text-foreground" : "text-muted-foreground/60")} />
      </button>
    </TableHead>
  );
}

export default function RecipeTable({ recipes }: { recipes: Recipes }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [direction, setDirection] = useState<SortDirection>("desc");

  // A single id rather than a Set: opening a row closes whichever was open.
  const [openId, setOpenId] = useState<number | null>(null);

  const published = recipes.filter((recipe) => recipe.published).length;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const filtered = recipes.filter((recipe) => {
      if (status === "published" && !recipe.published) return false;
      if (status === "draft" && recipe.published) return false;

      return needle === "" || recipe.title.toLowerCase().includes(needle);
    });

    // Sorted on a copy — filter already returns a new array, but relying on that is fragile.
    return [...filtered].sort((a, b) => {
      const result = sortKey === "title" ? a.title.localeCompare(b.title) : a.updated_at.localeCompare(b.updated_at);
      return direction === "asc" ? result : -result;
    });
  }, [recipes, query, status, sortKey, direction]);

  function handleSort(column: SortKey) {
    if (column === sortKey) {
      setDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(column);
    // Text reads best A→Z; a date reads best newest-first. Neither is a good default for the other.
    setDirection(column === "title" ? "asc" : "desc");
  }

  function clearFilters() {
    setQuery("");
    setStatus("all");
  }

  // Nothing to manage at all is a different situation from nothing matching a filter, and wants
  // a different offer — create a recipe, versus undo what you just typed.
  if (recipes.length === 0) {
    return (
      <div className="grid place-items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
        <UtensilsCrossed className="size-7 text-muted-foreground" />
        <div>
          <h2 className="font-semibold">No recipes yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">Recipes you create show up here, drafts included.</p>
        </div>
        <Button asChild className="mt-1">
          <Link href="/admin/create">
            <Plus />
            Create your first recipe
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup type="single" variant="outline" value={status} onValueChange={(value) => value && setStatus(value as StatusFilter)} spacing={0}>
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="published">Published</ToggleGroupItem>
          <ToggleGroupItem value="draft">Drafts</ToggleGroupItem>
        </ToggleGroup>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search recipes…" aria-label="Search recipes by title" className="pl-8" />
        </div>

        <p className="ml-auto text-sm text-muted-foreground tabular-nums">
          {visible.length === recipes.length ? `${recipes.length} recipes · ${published} published · ${recipes.length - published} drafts` : `Showing ${visible.length} of ${recipes.length}`}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10" />
              <SortableHead label="Title" column="title" sortKey={sortKey} direction={direction} onSort={handleSort} />
              <TableHead className="w-32 text-center">Status</TableHead>
              <SortableHead label="Updated" column="updated_at" sortKey={sortKey} direction={direction} onSort={handleSort} className="w-32 pl-8" />
              <TableHead className="w-40" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {visible.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="py-12 text-center">
                  <p className="text-sm text-muted-foreground">No recipes match this search.</p>
                  <Button variant="outline" size="sm" onClick={clearFilters} className="mt-3">
                    Clear filters
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              visible.map((recipe) => <RecipeRow key={recipe.id} recipe={recipe} isOpen={openId === recipe.id} onToggle={() => setOpenId((current) => (current === recipe.id ? null : recipe.id))} />)
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
