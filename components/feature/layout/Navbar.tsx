"use client";

// import components
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "./Theme-toggle";
import Image from "next/image";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";

type NavbarProps = {
  isLoggedIn?: boolean;
};

export default function Navbar({ isLoggedIn = true }: NavbarProps) {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-4">
          <Link href="/" className="mr-6 flex items-center gap-2">
            <Image src="/logo.png" alt="Chique's Swiet Mofo" width={128} height={128} className="h-10 w-auto mr-1" />
            <span className="text-lg font-semibold leading-none">{`Chique's Swiet Mofo`}</span>
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

          <Link href="/login">
            <Button variant="ghost" size="icon" aria-label="Login" className="hover:bg-accent">
              <User className={`h-4 w-4 ${isLoggedIn ? "text-green-600" : ""}`} />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
