import { z } from "zod";

// NEXT_PUBLIC_* values must be read with literal property access so Next.js
// can inline them into client bundles.
const publicEnv = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
    NEXT_PUBLIC_SITE_URL: z.url().optional(),
  })
  .parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || undefined,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  });

// Absolute origin used for canonical and alternate-language URLs. Falls back to
// the Vercel production domain, then to localhost for local development.
export function getSiteUrl(): URL {
  if (publicEnv.NEXT_PUBLIC_SITE_URL) return new URL(publicEnv.NEXT_PUBLIC_SITE_URL);

  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelHost) return new URL(`https://${vercelHost}`);

  return new URL("http://localhost:3000");
}

// Search engines are kept out until launch: set SITE_INDEXING=true to allow.
export function isIndexingEnabled(): boolean {
  return process.env.SITE_INDEXING === "true";
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL && publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function getSupabaseEnv() {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.example).",
    );
  }
  return { url, publishableKey };
}
