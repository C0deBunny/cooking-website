"use server";

// import lib
import { createClient } from "../../lib/supabase/server-client";
import { redirect } from "next/navigation";

export default async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error("Failed to sign out: " + error.message);
  }

  redirect("/");
}
