"use client";

// import lib
import { useCallback, useEffect, useRef, useState } from "react";
import { spawnRipple } from "@/lib/ripple";
import { SECTIONS } from "./sections";

// import components
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { Palette } from "lucide-react";

/** Navbar's pinned h-16. Both the sticky offset below and the measurement key off this number. */
const HEADER_H = 64;

/**
 * Below this share of the visible band, treat the screen as unowned. Two dead zones need it: the
 * tinted heading band at the top of the page, and the footer at the bottom, where the last section
 * can never win a majority. In both, fall back to the section whose top edge is nearest the header.
 */
const OWNERSHIP_FLOOR = 0.25;

/**
 * An #anchor jump fires its own scroll event (nothing sets scroll-behavior: smooth, so it is
 * instant). Ignoring scrolls for this long lets a click's highlight survive the jump it caused —
 * which matters because the clicked section is often *not* the viewport's largest once you land on
 * it. After the grace expires the next real scroll clears the pin and the spy takes over again.
 */
const JUMP_GRACE_MS = 250;

/**
 * Which section owns the screen, by share of the visible band rather than by
 * IntersectionObserver ratio — a ratio is a fraction of the *element*, so a tall section scrolled
 * halfway out would score lower than a short one fully in view. That is the wrong quantity here.
 */
function measureActive(): string {
  const top = HEADER_H;
  const bottom = window.innerHeight;
  const band = Math.max(1, bottom - top);

  // Annotated, not inferred: SECTIONS is `as const`, so the initializer would narrow these to the
  // literal "buttons" and reject every other id.
  let owner: string = SECTIONS[0].id;
  let ownerShare = 0;
  let nearest: string = SECTIONS[0].id;
  let nearestDistance = Infinity;

  for (const section of SECTIONS) {
    const el = document.getElementById(section.id);
    if (!el) continue;

    const rect = el.getBoundingClientRect();
    const share = (Math.min(rect.bottom, bottom) - Math.max(rect.top, top)) / band;
    if (share > ownerShare) {
      ownerShare = share;
      owner = section.id;
    }

    const distance = Math.abs(rect.top - top);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = section.id;
    }
  }

  return ownerShare < OWNERSHIP_FLOOR ? nearest : owner;
}

/**
 * The /dev rail. Same shape as the /admin rail — full-bleed, collapsible="none" so it stays in
 * flow, and only the nav block is sticky so bg-sidebar and border-r keep spanning to the footer.
 * See app/admin/_components/AdminSidebar.tsx for why the sticky cannot live inside SidebarContent.
 *
 * Active styling reuses the rail's vocabulary deliberately: hover and data-active share
 * bg-sidebar-accent upstream, so colour alone cannot separate them. font-semibold plus the left
 * primary bar are what hover does not get.
 *
 * hidden md:flex — the gallery is a local-only dev tool that 404s in production, so a 14rem column
 * on a phone is work for a viewport nobody loads.
 */
export default function DevNav() {
  const [active, setActive] = useState<string>(SECTIONS[0].id);
  const pinnedUntil = useRef(0);

  useEffect(() => {
    let frame = 0;

    const sync = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (pinnedUntil.current) {
          if (performance.now() < pinnedUntil.current) return;
          pinnedUntil.current = 0;
        }
        setActive(measureActive());
      });
    };

    sync();
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      cancelAnimationFrame(frame);
    };
  }, []);

  const pin = useCallback((id: string) => {
    setActive(id);
    pinnedUntil.current = performance.now() + JUMP_GRACE_MS;
  }, []);

  return (
    <Sidebar collapsible="none" className="hidden border-r border-sidebar-border select-none md:flex">
      <nav aria-label="Gallery sections" className="sticky top-16">
        <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Palette className="size-4" />
            Gallery
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup className="px-0">
            <SidebarGroupLabel className="px-3">Sections</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {SECTIONS.map((section) => (
                  <SidebarMenuItem key={section.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={active === section.id}
                      className="relative rounded-none px-3 py-2 data-active:font-semibold data-active:before:absolute data-active:before:inset-y-0 data-active:before:left-0 data-active:before:w-1 data-active:before:bg-primary"
                    >
                      <a href={`#${section.id}`} aria-current={active === section.id ? "true" : undefined} onPointerDown={spawnRipple} onClick={() => pin(section.id)}>
                        {/* Ripple host. Kept first so the base style's [&>span:last-child]:truncate still targets the label. */}
                        <span data-ripple-layer aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" />
                        <span>{section.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </nav>
    </Sidebar>
  );
}
