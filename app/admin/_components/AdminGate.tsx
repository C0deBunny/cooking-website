// import lib
import { requireUser } from "@/lib/auth/queries";

/**
 * Server-side gate for /admin. Renders nothing — it exists for its side effect: requireUser()
 * sends anonymous visitors home instead of letting them sit on the admin UI.
 *
 * It must stay inside a Suspense boundary. `cacheComponents` is on, and a cookie read that
 * blocks the root shell fails the build with StaticGenBailoutError. The trade: the static shell
 * is flushed before the gate resolves, so an anonymous visitor briefly sees the admin chrome
 * before the redirect lands. Nothing in that shell is private, and writes are guarded
 * independently — row-level security is the real boundary, and every action under here calls
 * requireUser() before touching the database.
 */
export default async function AdminGate() {
  await requireUser();

  return null;
}
