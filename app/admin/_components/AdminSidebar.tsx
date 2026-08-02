"use client";

// import lib
import { usePathname } from "next/navigation";
import { spawnRipple } from "@/lib/ripple";

// import components
import Link from "next/link";
import { ChefHat, LayoutList, Plus, Tags } from "lucide-react";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

const groups = [
  {
    label: "Recipes",
    items: [
      { href: "/admin/manage", label: "Manage Recipes", icon: LayoutList },
      { href: "/admin/create", label: "Create Recipes", icon: Plus },
    ],
  },
  {
    label: "Tags",
    items: [{ href: "/admin/tags", label: "Manage Tags", icon: Tags }],
  },
];

/**
 * The /admin rail. Client-side only for usePathname(), to mark the active item.
 *
 * collapsible="none" is deliberate: the default ("offcanvas") positions itself fixed at h-svh,
 * which would slide under the navbar and across the footer. "none" renders a plain in-flow
 * column instead, which is what sitting inside the site chrome needs.
 *
 * sidebarMenuButtonVariants sets the same bg-sidebar-accent for hover: and for data-active:, so
 * colour alone cannot tell the two apart. The active row is therefore marked by two things hover
 * does not get: font-semibold and a full-height bar on the rail's left edge.
 *
 * Rows are full-bleed (px-0 on the group, rounded-none on the button) so the highlight spans
 * the rail edge to edge and the former gutters are clickable.
 *
 * The nav block is sticky, not the rail. Sticking the <Sidebar> itself would need a clamped height,
 * which would end its bg-sidebar and border-r at the fold and leave a tinted column that stops
 * mid-page. The wrapper also has to sit *outside* SidebarContent: that has overflow-auto, so a
 * sticky inside it would pin to its own scrollport instead of the viewport.
 * top-16 is the header's pinned height — see components/feature/layout/navbar/Navbar.tsx.
 */
export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="none" className="border-r border-sidebar-border select-none">
      <div className="sticky top-16">
        <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
          <div className="flex items-center gap-2 text-sm font-bold">
            <ChefHat className="size-4" />
            Admin
          </div>
        </SidebarHeader>

        <SidebarContent>
          {groups.map((group) => (
            <SidebarGroup key={group.label} className="px-0">
              <SidebarGroupLabel className="px-3">{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
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
          ))}
        </SidebarContent>
      </div>
    </Sidebar>
  );
}
