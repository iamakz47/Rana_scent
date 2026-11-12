import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/env";

export type MediaRef = { bucket: string; path: string };

// Public URL for a media asset. "static" assets ship in /public; uploads are
// served from the public Supabase Storage bucket "media".
export function mediaUrl(asset: MediaRef): string {
  if (asset.bucket === "static") return `/${asset.path}`;
  if (!isSupabaseConfigured()) return "";
  return `${getSupabaseEnv().url}/storage/v1/object/public/media/${asset.path}`;
}
