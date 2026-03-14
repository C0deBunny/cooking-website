import Navbar from "./Navbar";
import { createClient } from "@/lib/supabase/server";

export default async function NavbarServer() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <Navbar isLoggedIn={!!user} />;
}
