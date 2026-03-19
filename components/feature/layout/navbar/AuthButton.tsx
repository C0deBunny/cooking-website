"use client";

import { User } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signOut } from "@/Actions/Auth";

type AuthButtonProps = {
  isLoggedIn?: boolean;
};

export default function AuthButton({ isLoggedIn = false }: AuthButtonProps) {
  // TODO remove this
  const router = useRouter();

  async function handleUserClick() {
    if (isLoggedIn) {
      await signOut();
    } else {
      router.push("/login");
    }
  }

  return (
    <Button variant="ghost" size="icon" aria-label="User" onClick={handleUserClick} className={`hover:bg-accent ${isLoggedIn ? "text-green-600 hover:text-red-600" : ""}`}>
      <User className="h-4 w-4" />
    </Button>
  );
}
