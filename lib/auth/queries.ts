// import lib
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server-client";

/**
 * Reads the signed-in user. Wrapped in React's cache() so the navbar, the footer and any
 * page can all ask independently while only one request reaches Supabase per render.
 *
 * Deliberately not a server action — this is a read, and "use server" would both expose it
 * as an endpoint and defeat cache().
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // No session is the normal anonymous case, not a failure worth throwing over.
  if (error) {
    return null;
  }

  return user ?? null;
});

/** Same read, but for owner-only surfaces: sends anonymous visitors home instead of returning null. */
export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  return user;
}
