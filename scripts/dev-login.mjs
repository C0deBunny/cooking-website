/**
 * Signs the Playwright MCP browser in as the owner, so a browser pass over `/admin` can start
 * itself instead of waiting on a human to type a password.
 *
 * Run it by *filename* rather than by pasting its body:
 *
 *   browser_run_code_unsafe({ filename: "C:/Coding/cooking-website/scripts/dev-login.mjs" })
 *
 * **That is the whole point of the file existing.** It reads `.credentials.local`, which is
 * gitignored and is not one of the filenames Next loads, and it returns nothing but a status
 * string — so the password reaches the form without ever passing through a conversation, a tool
 * result, a snapshot or a screenshot. Anything that reads those values back out and prints them
 * undoes it: never `console.log` them, never return them, and never inline them into a `code`
 * argument.
 *
 * Not a "use server" concern and not app code — nothing imports this, and the app cannot read the
 * file it reads.
 */
/* eslint-disable @typescript-eslint/no-unused-expressions -- the file *is* the function: the MCP
   tool evaluates its contents and calls the result, so a bare expression is the required shape and
   an `export default` would not be callable that way. */
async (page) => {
  const CREDENTIALS = "file:///C:/Coding/cooking-website/.credentials.local";

  /**
   * ⚠ Read by navigating the browser to the file, not with `node:fs`. The MCP tool evaluates this
   * in a bare `vm` context whose only global is `page` — no `require`, no `process`, and dynamic
   * `import()` throws `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`. The browser is the only thing in
   * reach that can open a file, so it opens it.
   *
   * The values stay inside this function either way, which is the property that matters. The tab is
   * navigated straight off the file below, so no later snapshot or screenshot can catch it sitting
   * there.
   */
  await page.goto(CREDENTIALS);
  const raw = await page.evaluate(() => document.body.innerText);

  /** Minimal dotenv: `KEY=value` lines, `#` comments, blanks ignored. */
  const config = Object.fromEntries(
    raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()])
  );

  const base = config.BASE_URL || "http://localhost:3000";

  // Reported as a status rather than thrown, so the caller learns the file is empty without the
  // failure arriving as a stack trace quoting the line it was parsing.
  if (!config.LOGIN_EMAIL || !config.LOGIN_PASSWORD) {
    return `no credentials: fill LOGIN_EMAIL and LOGIN_PASSWORD in ${CREDENTIALS}`;
  }

  await page.goto(`${base}/login`);
  await page.fill("#email", config.LOGIN_EMAIL);
  await page.fill("#password", config.LOGIN_PASSWORD);
  await page.click('button[type="submit"]');

  // The form is a server action that redirects, so the URL changing is the success signal. Swallowed
  // on timeout because the check below is the real verdict — a wrong password simply leaves the page
  // where it is, with its own error on screen.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 }).catch(() => {});

  // Proves the *session* rather than the redirect: /admin/create is behind the gate, so landing on
  // it is the only thing that means the cookie is real.
  await page.goto(`${base}/admin/create`);

  return page.url().includes("/admin/create") ? "signed in" : `still signed out — landed on ${page.url()}`;
}
