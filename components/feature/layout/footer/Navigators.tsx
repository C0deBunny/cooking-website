// import actions
import { getCurrentUser } from "@/Actions/Auth";

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
          <Link href="/admin" className="hover:underline">
            Admin
          </Link>
        )}
      </div>
    </>
  );
}
