// import lib
import { redirect } from "next/navigation";

/**
 * /admin has no content of its own — the rail's first destination is the landing page.
 * Reads no request data, so this stays prerenderable under cacheComponents.
 *
 * Don't link here from the app, and don't redirect here from a server action — link and
 * redirect to /admin/manage directly. This route only survives a hard load. In production
 * on Vercel, reaching it through the client router breaks:
 *
 *   - client-side <Link> nav  → "This page couldn't load", pageerror "Connection closed."
 *   - server action redirect  → 303 whose Location (/admin/manage) disagrees with
 *                               x-action-redirect (/admin), then a bare 403 text/plain on
 *                               the follow-up, and "An unexpected response was received
 *                               from the server."
 *
 * The edge resolves the redirect while serving the prerendered .rsc artifact, and what comes
 * back isn't an RSC payload the router can parse. A hard load is fine (200 → /admin/manage),
 * so the route stays for anyone typing the URL.
 *
 * Invisible in dev: next dev has no edge layer resolving redirects and no .rsc artifacts.
 */
export default function AdminPage() {
  redirect("/admin/manage");
}
