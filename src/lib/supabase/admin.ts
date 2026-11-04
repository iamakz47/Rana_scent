import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";
import { getSecretKey } from "@/lib/server-env";
import type { Database } from "@/types/database";

// Privileged Auth client for sending staff invitations. Bypasses RLS, so it is
// used for exactly one thing (auth.admin.inviteUserByEmail) after the caller
// has been authorised by requireStaff("staff.write"). Role assignment itself
// always runs through the caller's own session so RLS and the escalation
// guard still apply.
export function isInviteConfigured(): boolean {
  return Boolean(getSecretKey());
}

export function createInviteClient() {
  const secretKey = getSecretKey();
  if (!secretKey) throw new Error("SUPABASE_SECRET_KEY is not configured");
  const { url } = getSupabaseEnv();
  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
