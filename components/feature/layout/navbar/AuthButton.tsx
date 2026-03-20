"use client";

//import lib
import { User } from "lucide-react";

//import actions
import { signOut } from "@/Actions/Auth";

// import components
import { Button } from "@/components/ui/button";
import Link from "next/link";

type AuthButtonProps = {
  isLoggedIn?: boolean;
};

export default function AuthButton({ isLoggedIn = false }: AuthButtonProps) {
  async function handleUserClick() {
    if (isLoggedIn) await signOut();
  }

  return (
    <Link href="/login">
      <Button variant="ghost" size="icon" aria-label="User" onClick={handleUserClick} className={`hover:bg-accent ${isLoggedIn ? "text-green-600 hover:text-red-600" : ""}`}>
        <User className="h-4 w-4" />
      </Button>
    </Link>
  );
}
