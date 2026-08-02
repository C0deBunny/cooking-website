// import lib
import { createClient } from "@supabase/supabase-js";

// import types
import type { Database } from "@/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase URL and Key must be provided in environment variables.");
}

export function createPublicClient() {
  return createClient<Database>(supabaseUrl, supabaseKey);
}
