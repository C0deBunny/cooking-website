// import lib
import { getCurrentUser } from "@/lib/auth/queries";

// import components
import Link from "next/link";
import Image from "next/image";

export default async function Navigators() {
  const user = await getCurrentUser();
  const isLoggedIn = !!user;

  return (
    <>
      <Link href="/" className="mr-6 flex items-center gap-2">
        <Image src="/logo.png" alt="Chique's Swiet Mofo" width={128} height={128} className="h-10 w-auto mr-1" />
        <span className="text-lg font-semibold text-foreground leading-none">{`Chique's Swiet Mofo`}</span>
      </Link>

      <div className="flex items-center gap-6">
        <Link href="/" className="hover:underline">
          Home
        </Link>

        <Link href="/recipes" className="hover:underline">
          Recipes
        </Link>

        {isLoggedIn && (
          /* /admin/manage, not /admin — see the note in app/admin/page.tsx. A client-side nav
             to the redirect-only /admin fails in production. */
          <Link href="/admin/manage" className="hover:underline">
            Admin
          </Link>
        )}
      </div>
    </>
  );
}
