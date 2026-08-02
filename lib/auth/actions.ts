"use server";

// import lib
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server-client";
import { loginSchema, type LoginState } from "@/lib/auth/schema";

// Only async functions may be exported from a "use server" file — the schema and the
// LoginState type live in ./schema.ts for that reason.

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Please enter a valid email and password." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  // Deliberately vague: don't reveal whether the address exists.
  if (error) {
    return { error: "Invalid email or password." };
  }

  // Straight to the real destination, not via /admin. /admin is a redirect-only page, and
  // chaining a second hop off a server action's redirect breaks on Vercel: the edge collapses
  // the hop while serving the action response, emitting a Location (/admin/manage) that
  // disagrees with x-action-redirect (/admin), and the router's follow-up request 403s.
  // Reproduces only in production — next dev has no edge layer resolving redirects.
  redirect("/admin/manage");
}

export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error("Failed to sign out: " + error.message);
  }

  redirect("/");
}
