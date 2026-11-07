import "server-only";
import { headers } from "next/headers";

// Origin for links in auth emails. Never taken from an arbitrary Host header:
// configured site URL first, then Vercel's own deployment URLs, then the
// request host only when it is local development. Supabase additionally
// rejects redirect URLs that are not on the project's allow-list.
export async function appOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return new URL(process.env.NEXT_PUBLIC_SITE_URL).origin;

  if (process.env.VERCEL_ENV === "preview") {
    const host = process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL;
    if (host) return `https://${host}`;
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;

  const host = (await headers()).get("host") ?? "";
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return `http://${host}`;
  return "http://localhost:3000";
}
