import type { NextConfig } from "next";

/**
 * Recipe photos come from Supabase Storage, and `next/image` throws on any remote host that is not
 * listed here — so this is not optional the moment a cover renders.
 *
 * Derived from the env var rather than hardcoded or wildcarded, for the same reason the database
 * stores paths and not URLs: one source, and it survives a project move. A `*.supabase.co`
 * wildcard would additionally let *any* Supabase project's images through this project's image
 * optimizer.
 *
 * The cost is that this file now reads env at build time, so a missing variable fails the build.
 * That is the posture the Supabase clients already take at import — `public-client.ts` throws at
 * module scope and the public pages prerender — so today's build already requires this variable.
 * Next loads `.env` files before importing this config, so `process.env` is populated here.
 * Decision 45.
 */
const supabaseHostname = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname;

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,

  images: {
    remotePatterns: [{ protocol: "https", hostname: supabaseHostname, pathname: "/storage/v1/object/public/**" }],
  },
};

export default nextConfig;
