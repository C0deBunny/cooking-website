// import actions
import { getCurrentUser } from "@/Actions/Auth";

// import components
import Link from "next/link";
import Image from "next/image";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "../Theme-toggle";
import AuthButton from "./AuthButton";
import { Suspense } from "react";
import { User } from "lucide-react";

export default async function Navbar() {
  const user = await getCurrentUser();
  const isLoggedIn = !!user;

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
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

              <Link href="/admin" className="text-sm hover:underline">
                Admin
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 pr-1">
          <ThemeToggle />
          <Suspense fallback={<User className="h-4 w-4" />}>
            <AuthButton isLoggedIn={isLoggedIn} />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
