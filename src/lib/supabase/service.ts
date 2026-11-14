import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";
import { getSecretKey } from "@/lib/server-env";
import type { Database } from "@/types/database";

// Service-role client for trusted server work only: recording verified
// payment results and reading orders by payment charge. Bypasses RLS, so it
// is never used with user-supplied filters it doesn't validate first.
export function isServiceConfigured(): boolean {
  return Boolean(getSecretKey());
}

export function createServiceClient() {
  const secretKey = getSecretKey();
  if (!secretKey) throw new Error("SUPABASE_SECRET_KEY is not configured");
  const { url } = getSupabaseEnv();
  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}
