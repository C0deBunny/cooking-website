// import lib
import { SECTIONS } from "./sections";

export default function DevNav() {
  return (
    <nav aria-label="Gallery sections" className="sticky top-0 z-40 -mx-6 mb-10 border-b border-foreground/10 bg-background/80 px-6 py-3 backdrop-blur">
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {SECTIONS.map((section) => (
          <li key={section.id}>
            <a href={`#${section.id}`} className="text-sm text-foreground/60 underline-offset-4 transition-colors hover:text-foreground hover:underline">
              {section.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
