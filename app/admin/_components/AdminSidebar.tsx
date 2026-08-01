"use client";

// import lib
import { usePathname } from "next/navigation";
import type { PointerEvent } from "react";

// import components
import Link from "next/link";
import { ChefHat, LayoutList, Plus } from "lucide-react";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

/** Add a destination here and it appears in the rail — nothing else needs touching. */
const items = [
  { href: "/admin/manage", label: "Manage Recipes", icon: LayoutList },
  { href: "/admin/create", label: "Create Recipes", icon: Plus },
];

/**
 * Click ripple. Ripples are appended to a dedicated empty layer rather than to the link
 * itself, so React never has to reconcile around DOM it did not create.
 *
 * The radius reaches the farthest corner from the click point, which keeps the circle
 * covering the row wherever it lands. Each ripple removes itself on animationend, so
 * nothing accumulates. Styling and the reduced-motion opt-out live in app/globals.css.
 */
function spawnRipple(event: PointerEvent<HTMLElement>) {
  const layer = event.currentTarget.querySelector<HTMLElement>("[data-ripple-layer]");
  if (!layer) return;

  const rect = layer.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const radius = Math.hypot(Math.max(x, rect.width - x), Math.max(y, rect.height - y));

  const ripple = document.createElement("span");
  ripple.className = "sidebar-ripple";
  ripple.style.width = `${radius * 2}px`;
  ripple.style.height = `${radius * 2}px`;
  ripple.style.left = `${x - radius}px`;
  ripple.style.top = `${y - radius}px`;
  ripple.addEventListener("animationend", () => ripple.remove());

  layer.appendChild(ripple);
}

/**
 * The /admin rail. Client-side only because it needs usePathname() to mark the active item;
 * everything it renders is otherwise static.
 *
 * collapsible="none" is deliberate: the default ("offcanvas") positions itself fixed at h-svh,
 * which would slide under the navbar and across the footer. "none" renders a plain in-flow
 * column instead, which is what sitting inside the site chrome needs.
 *
 * Two states share one token upstream — sidebarMenuButtonVariants sets the same
 * bg-sidebar-accent for hover: and for data-active:, so colour alone cannot tell them apart.
 * The active row is therefore marked by two things hover does not get: font-semibold and a
 * full-height orange bar on the rail's left edge. That is what lets --sidebar-accent stay as
 * quiet as it is.
 *
 * Rows are full-bleed (px-0 on the group, rounded-none on the button) so the highlight spans
 * the rail edge to edge and the former gutters are clickable.
 */
export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="none" className="border-r border-sidebar-border select-none">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-2 text-sm font-bold">
          <ChefHat className="size-4" />
          Admin
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="px-0">
          <SidebarGroupLabel className="px-3">Recipes</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    className="relative rounded-none px-3 py-2 data-active:font-semibold data-active:before:absolute data-active:before:inset-y-0 data-active:before:left-0 data-active:before:w-1 data-active:before:bg-primary"
                  >
                    <Link href={item.href} onPointerDown={spawnRipple}>
                      {/* Ripple host. Kept first so the base style's [&>span:last-child]:truncate still targets the label. */}
                      <span data-ripple-layer aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" />
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
