import Footer from "./Footer";
import { createClient } from "@/lib/supabase/server-client";

export default async function FooterServer() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <Footer isLoggedIn={!!user} />;
}
