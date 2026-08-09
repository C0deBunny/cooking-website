// import lib
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// import types
import type { Database } from "@/types/database";

export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

  return createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // The empty catch is the standard SSR pattern — a server component cannot set a cookie,
        // and proxy.ts refreshes the session anyway — but it is now also load-bearing for
        // lib/images/sweep.ts. That runs inside after(), i.e. after the response has been
        // flushed, and a client created there throws on any attempt to write a cookie. Swallowing
        // it is what lets the sweep authenticate as the signed-in owner at all.
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {}
      },
    },
  });
}
