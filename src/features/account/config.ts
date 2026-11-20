import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { isServiceConfigured } from "@/lib/supabase/service";
import { isLiveCatalog } from "@/features/catalog/source";

// Customer accounts open together with online ordering (the live catalog),
// and need the server key to send account emails. Until then the account
// pages say "opening soon" and no account can be created.
export function accountsEnabled(): boolean {
  return isSupabaseConfigured() && isServiceConfigured() && isLiveCatalog();
}
