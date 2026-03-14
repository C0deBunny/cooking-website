import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-semibold">Admin Page</h1>
      <p className="mt-2">Welcome to the admin dashboard.</p>
      <p className="mt-2 text-sm text-gray-600">Logged in as: {user.email}</p>
    </main>
  );
}
