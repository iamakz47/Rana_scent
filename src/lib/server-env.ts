import "server-only";
import { z } from "zod";

// Server-only configuration. None of these values may reach the browser:
// they are read without the NEXT_PUBLIC_ prefix, so Next.js never inlines
// them, and this module throws if imported from a Client Component.
const serverEnv = z
  .object({
    // Supabase secret key (sb_secret_…). Optional: only staff invitations by
    // email need it. Never used to grant roles; those go through RLS.
    SUPABASE_SECRET_KEY: z.string().min(20).optional(),
    // Where the storefront reads its catalog. "sample" keeps the Phase 1
    // preview data; "supabase" reads published rows. Defaults to sample until
    // the migrations are applied to the production project.
    CATALOG_SOURCE: z.enum(["sample", "supabase"]).default("sample"),
  })
  .parse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || undefined,
    CATALOG_SOURCE: process.env.CATALOG_SOURCE || undefined,
  });

export function getSecretKey(): string | undefined {
  return serverEnv.SUPABASE_SECRET_KEY;
}

export function getCatalogSource(): "sample" | "supabase" {
  return serverEnv.CATALOG_SOURCE;
}
