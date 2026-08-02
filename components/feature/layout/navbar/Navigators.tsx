// import lib
import { getCurrentUser } from "@/lib/auth/queries";

// import components
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import Image from "next/image";

export default async function Navigators() {
  const user = await getCurrentUser();
  const isLoggedIn = !!user;

  return (
    <div className="flex items-center gap-4">
      <Link href="/" className="mr-6 flex items-center gap-2">
        <Image src="/logo.png" alt="Chique's Swiet Mofo" width={128} height={128} className="mr-1 h-10 w-auto" />
        <span className="text-lg font-semibold leading-none">{"Chique's Swiet Mofo"}</span>
      </Link>

      <Separator orientation="vertical" className="mx-2 h-6 border-l border-border" />

      <Link href="/" className="text-sm hover:underline">
        Home
      </Link>

      <Separator orientation="vertical" className="mx-2 h-6 border-l border-border" />

      <Link href="/recipes" className="text-sm hover:underline">
        Recipes
      </Link>

      {isLoggedIn && (
        <>
          <Separator orientation="vertical" className="mx-2 h-6 border-l border-border" />

          {/* /admin/manage, not /admin — see the note in app/admin/page.tsx. A client-side nav
              to the redirect-only /admin fails in production. */}
          <Link href="/admin/manage" className="text-sm hover:underline">
            Admin
          </Link>
        </>
      )}

      {/* The component gallery. Not behind isLoggedIn — /dev isn't auth-gated, it simply stops
          existing in production, and NODE_ENV is inlined at build time so this whole branch is
          dropped from the production bundle. */}
      {process.env.NODE_ENV !== "production" && (
        <>
          <Separator orientation="vertical" className="mx-2 h-6 border-l border-border" />

          <Link href="/dev" className="text-sm hover:underline">
            Dev
          </Link>
        </>
      )}
    </div>
  );
}
