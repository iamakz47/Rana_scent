"use server";

import { updateTag } from "next/cache";
import sharp from "sharp";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { CATALOG_TAG, HOMEPAGE_TAG } from "@/features/catalog/cache-tags";
import { actionDictionary, dbErrorMessage } from "@/features/admin/action-locale";
import { authorize } from "@/features/admin/auth/dal";
import type { ActionResult } from "@/features/admin/ui/form";
import {
  isImageMime,
  isSafeMediaPath,
  MAX_UPLOAD_BYTES,
  mediaFolders,
  mediaPath,
  sniffImageType,
} from "./validation";

type Prepared = { status: "ok"; path: string; token: string } | { status: "error"; message: string };

// Step 1: authorise and validate the declared file, then hand the browser a
// one-time signed URL for a path generated here. Files never pass through
// this server (Vercel limits request bodies), and the client can't choose
// the path.
export async function prepareUpload(input: { locale: string; folder: string; type: string; size: number }): Promise<Prepared> {
  const form = new FormData();
  form.set("locale", input.locale);
  const t = actionDictionary(form);
  if (!(await authorize("media.write"))) return { status: "error", message: t.common.noPermissionAction };
  const folder = z.enum(mediaFolders).safeParse(input.folder);
  if (!folder.success) return { status: "error", message: t.common.error };
  if (!isImageMime(input.type)) return { status: "error", message: t.media.badType };
  if (!Number.isInteger(input.size) || input.size <= 0 || input.size > MAX_UPLOAD_BYTES) {
    return { status: "error", message: t.media.tooLarge };
  }
  const path = mediaPath(folder.data, crypto.randomUUID(), input.type);
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("media").createSignedUploadUrl(path);
  if (error || !data) return { status: "error", message: t.common.noPermissionAction };
  return { status: "ok", path, token: data.token };
}

// Step 2: re-read what was actually uploaded, verify it from its bytes, and
// register it (or swap it into an existing asset when replacing).
export async function registerUpload(input: {
  locale: string;
  path: string;
  altAr: string;
  altEn: string;
  replaceId?: string;
}): Promise<ActionResult> {
  const form = new FormData();
  form.set("locale", input.locale);
  const t = actionDictionary(form);
  if (!(await authorize("media.write"))) return { status: "error", message: t.common.noPermissionAction };
  if (!isSafeMediaPath(input.path)) return { status: "error", message: t.common.error };

  const supabase = await createClient();
  const storage = supabase.storage.from("media");
  const { data: blob, error: downloadError } = await storage.download(input.path);
  if (downloadError || !blob) return { status: "error", message: t.common.error };

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const mime = sniffImageType(bytes);
  const discard = async (message: string): Promise<ActionResult> => {
    await storage.remove([input.path]);
    return { status: "error", message };
  };
  if (bytes.byteLength > MAX_UPLOAD_BYTES) return discard(t.media.tooLarge);
  if (!mime || !input.path.endsWith(`.${{ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" }[mime]}`)) {
    return discard(t.media.badType);
  }
  let width: number | null = null;
  let height: number | null = null;
  try {
    const meta = await sharp(bytes).metadata();
    width = meta.width ?? null;
    height = meta.height ?? null;
  } catch {
    return discard(t.media.badType);
  }

  const altAr = input.altAr.trim().slice(0, 200);
  const altEn = input.altEn.trim().slice(0, 200);

  if (input.replaceId) {
    const id = z.uuid().safeParse(input.replaceId);
    if (!id.success) return discard(t.common.error);
    const { data: old } = await supabase.from("media_assets").select("bucket, path").eq("id", id.data).maybeSingle();
    if (!old || old.bucket !== "media") return discard(t.media.siteAssetHint);
    const { error } = await supabase
      .from("media_assets")
      .update({ path: input.path, mime_type: mime, size_bytes: bytes.byteLength, width, height })
      .eq("id", id.data);
    if (error) return discard(dbErrorMessage(error, t));
    await storage.remove([old.path]);
  } else {
    const { error } = await supabase.from("media_assets").insert({
      bucket: "media",
      path: input.path,
      mime_type: mime,
      size_bytes: bytes.byteLength,
      width,
      height,
      alt_ar: altAr,
      alt_en: altEn,
    });
    if (error) return discard(dbErrorMessage(error, t));
  }
  updateTag(CATALOG_TAG);
  updateTag(HOMEPAGE_TAG);
  return { status: "ok", message: t.media.uploadedOk };
}

export async function updateAlt(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  if (!(await authorize("media.write"))) return { status: "error", message: t.common.noPermissionAction };
  const parsed = z
    .object({ id: z.uuid(), alt_ar: z.string().trim().max(200), alt_en: z.string().trim().max(200) })
    .safeParse({ id: formData.get("id"), alt_ar: formData.get("alt_ar"), alt_en: formData.get("alt_en") });
  if (!parsed.success) return { status: "error", message: t.common.error };
  const supabase = await createClient();
  const { error } = await supabase
    .from("media_assets")
    .update({ alt_ar: parsed.data.alt_ar, alt_en: parsed.data.alt_en })
    .eq("id", parsed.data.id);
  if (error) return { status: "error", message: dbErrorMessage(error, t) };
  updateTag(CATALOG_TAG);
  updateTag(HOMEPAGE_TAG);
  return { status: "ok", message: t.media.altSaved };
}

export async function deleteMedia(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  if (!(await authorize("media.write"))) return { status: "error", message: t.common.noPermissionAction };
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { status: "error", message: t.common.error };
  const supabase = await createClient();
  const { data: usage } = await supabase.rpc("media_usage", { target: id.data });
  if ((usage ?? []).length > 0) return { status: "error", message: t.media.inUseCannotDelete };
  const { data: asset } = await supabase.from("media_assets").select("bucket, path").eq("id", id.data).maybeSingle();
  if (!asset) return { status: "error", message: t.common.error };
  if (asset.bucket !== "media") return { status: "error", message: t.media.siteAssetHint };
  // Row first: foreign keys refuse the delete if anything still uses it.
  const { error } = await supabase.from("media_assets").delete().eq("id", id.data);
  if (error) {
    return { status: "error", message: error.code === "23503" ? t.media.inUseCannotDelete : dbErrorMessage(error, t) };
  }
  await supabase.storage.from("media").remove([asset.path]);
  return { status: "ok", message: t.media.deletedOk };
}
