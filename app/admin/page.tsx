// import lib
import { redirect } from "next/navigation";

/**
 * /admin has no content of its own — the rail's first destination is the landing page.
 * Reads no request data, so this stays prerenderable under cacheComponents.
 */
export default function AdminPage() {
  redirect("/admin/create");
}
