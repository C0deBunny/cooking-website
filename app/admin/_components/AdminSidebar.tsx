"use client";

// import lib
import { usePathname } from "next/navigation";

// import components
import Link from "next/link";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

/** Add a destination here and it appears in the rail — nothing else needs touching. */
const items = [
  { href: "/admin/manage", label: "Manage Recipes" },
  { href: "/admin/create", label: "Create Recipes" },
];

/**
 * The /admin rail. Client-side only because it needs usePathname() to mark the active item;
 * everything it renders is otherwise static.
 *
 * collapsible="none" is deliberate: the default ("offcanvas") positions itself fixed at h-svh,
 * which would slide under the navbar and across the footer. "none" renders a plain in-flow
 * column instead, which is what sitting inside the site chrome needs.
 */
export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="none" className="border-r border-sidebar-border">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <Link href={item.href}>{item.label}</Link>
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
