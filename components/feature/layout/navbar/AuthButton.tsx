"use client";

//import lib
import { User } from "lucide-react";

//import actions
import { signOut } from "@/lib/auth/actions";

// import components
import { Button } from "@/components/ui/button";

type AuthButtonProps = {
  isLoggedIn?: boolean;
};

export default function AuthButton({ isLoggedIn = false }: AuthButtonProps) {
  async function handleUserClick() {
    if (isLoggedIn) {
      await signOut();
    } else {
      window.location.href = "/login";
    }
  }

  return (
    // Raw palette colors, deliberately — not a missed token swap. Signed-in green and sign-out red
    // are a traffic-light metaphor with no semantic token behind it: there is no --success, and
    // --destructive means "this button destroys data", which signing out does not. Leaving them raw
    // keeps the theme honest rather than inventing a token for one icon. Revisit only if a real
    // --success pair lands for other reasons; don't add one just for this.
    <Button variant="ghost" size="icon" aria-label="User" onClick={handleUserClick} className={`hover:bg-accent ${isLoggedIn ? "text-green-600 hover:text-red-600" : ""}`}>
      <User className="h-4 w-4" />
    </Button>
  );
}
