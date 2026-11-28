import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { isSupabaseConfigured } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/public";
import { parsePageContent, type PageContent, type SitePageKey } from "./schema";

export const SITE_PAGES_TAG = "site-pages";

// The published content of a page, or null until the owner publishes it (or
// before the database is updated): the store then shows its built-in text.
export async function getPublishedPage(key: SitePageKey): Promise<PageContent | null> {
  "use cache";
  cacheTag(SITE_PAGES_TAG);
  cacheLife("hours");
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await createPublicClient().rpc("get_site_page", { p_key: key });
  if (error || !data) return null;
  return parsePageContent(data);
}
