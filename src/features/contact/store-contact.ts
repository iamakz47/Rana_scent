import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { HOMEPAGE_TAG } from "@/features/catalog/cache-tags";
import { isSupabaseConfigured } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/public";
import type { StoreContact } from "./channels";

const empty: StoreContact = { email: "", phone: "", whatsapp: "", instagram: "" };

// The shop's contact details from Admin → Settings. Saving settings refreshes
// HOMEPAGE_TAG, so changes show without a redeploy.
export async function getStoreContact(): Promise<StoreContact> {
  "use cache";
  cacheTag(HOMEPAGE_TAG);
  cacheLife("hours");
  if (!isSupabaseConfigured()) return empty;
  const { data, error } = await createPublicClient()
    .from("store_settings")
    .select("contact_email, contact_phone, whatsapp_number, instagram_handle")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return empty;
  return { email: data.contact_email, phone: data.contact_phone, whatsapp: data.whatsapp_number, instagram: data.instagram_handle };
}
