"use client";

// import lib
import * as React from "react";
import { DynamicIcon, iconNames } from "lucide-react/dynamic";
import { toast } from "sonner";

// import components
import { Section } from "./Section";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { SearchIcon, XIcon } from "lucide-react";

/**
 * Rendering all ~1,950 icons at once means ~1,950 lazy chunk requests, which makes the dev server
 * crawl. Cap what's painted and say so in the header rather than truncating silently.
 */
const RENDER_LIMIT = 180;

/** "chef-hat" → "ChefHat", the name you actually import. No lucide icon starts with a digit, so this always yields a valid identifier. */
function toPascalCase(name: string) {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

export default function IconBrowser() {
  const [query, setQuery] = React.useState("");
  // Keeps typing responsive — the grid re-renders against the lagging value.
  const deferredQuery = React.useDeferredValue(query);

  const matches = React.useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase().replace(/\s+/g, "-");
    if (!needle) return iconNames;
    return iconNames.filter((name) => name.includes(needle));
  }, [deferredQuery]);

  const shown = matches.slice(0, RENDER_LIMIT);

  async function copyImport(name: string) {
    const line = `import { ${toPascalCase(name)} } from "lucide-react";`;
    try {
      await navigator.clipboard.writeText(line);
      toast.success(`Copied ${toPascalCase(name)}`, { description: line });
    } catch {
      toast.error("Could not reach the clipboard", { description: line });
    }
  }

  return (
    <Section
      id="icons"
      title="Icons"
      hint={`All ${iconNames.length.toLocaleString("en-US")} Lucide icons, loaded on demand via DynamicIcon. Click one to copy its import line — but import icons by name in real code, since DynamicIcon skips tree-shaking.`}
    >
      <div className="flex flex-col gap-4">
        <InputGroup className="max-w-sm">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search 1,951 icons — try chef, timer, wheat" aria-label="Search icons" />
          {query ? (
            <InputGroupAddon align="inline-end">
              <InputGroupButton size="icon-xs" aria-label="Clear search" onClick={() => setQuery("")}>
                <XIcon />
              </InputGroupButton>
            </InputGroupAddon>
          ) : null}
        </InputGroup>

        <p className="text-xs text-foreground/50" aria-live="polite">
          {matches.length === 0
            ? `No icon matches "${deferredQuery}".`
            : matches.length > RENDER_LIMIT
              ? `Showing ${RENDER_LIMIT} of ${matches.length.toLocaleString("en-US")} matches — narrow the search to see the rest.`
              : `${matches.length} ${matches.length === 1 ? "match" : "matches"}.`}
        </p>

        {shown.length > 0 ? (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {shown.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => copyImport(name)}
                  title={`Copy import for ${toPascalCase(name)}`}
                  className="flex w-full flex-col items-center gap-2 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3 transition-colors outline-none hover:border-foreground/20 hover:bg-foreground/5 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <DynamicIcon name={name} className="size-5 text-foreground/80" aria-hidden />
                  <span className="w-full truncate text-center font-mono text-[0.65rem] text-foreground/50">{name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Section>
  );
}
