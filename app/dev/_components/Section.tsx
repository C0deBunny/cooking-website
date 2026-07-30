// import lib
import { cn } from "@/lib/utils";

/** One group of related primitives, targeted by the anchor nav. */
function Section({ id, title, hint, children }: { id: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-foreground/10 pt-10">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      {hint ? <p className="mt-1 max-w-2xl text-sm text-foreground/60">{hint}</p> : null}
      <div className="mt-6 flex flex-col gap-8">{children}</div>
    </section>
  );
}

/**
 * A single labelled specimen. `label` is the component name so the gallery doubles as an index of
 * what exists; `note` carries the caveat worth knowing when reaching for it.
 */
function Specimen({ label, note, className, children }: { label: string; note?: string; className?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h3 className="font-mono text-xs text-foreground/70">{label}</h3>
        {note ? <span className="text-xs text-foreground/40">{note}</span> : null}
      </div>
      <div className={cn("flex flex-wrap items-center gap-3 rounded-lg border border-foreground/10 bg-foreground/2 p-4", className)}>{children}</div>
    </div>
  );
}

export { Section, Specimen };
