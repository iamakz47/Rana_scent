import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { isSupabaseConfigured } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/public";
import type { PolicyKey } from "./keys";

export const POLICY_TAG = "policies";

export type PublishedPolicy = {
  key: PolicyKey;
  title: { ar: string; en: string };
  body: { ar: string; en: string };
  published_at: string;
};

// Published policy text (null until the owner publishes it). Visitors never
// see drafts: the database function returns published columns only.
export async function getPublishedPolicy(key: PolicyKey): Promise<PublishedPolicy | null> {
  "use cache";
  cacheTag(POLICY_TAG);
  cacheLife("hours");
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await createPublicClient().rpc("get_policy", { p_key: key });
  if (error || !data) return null;
  return data as unknown as PublishedPolicy;
}
