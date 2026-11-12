"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { localePath } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { HOMEPAGE_TAG } from "@/features/catalog/cache-tags";
import { actionDictionary, actionLocale, dbErrorMessage } from "@/features/admin/action-locale";
import { authorize } from "@/features/admin/auth/dal";
import type { ActionResult } from "@/features/admin/ui/form";

// Same rule as the database check: internal, locale-less paths only.
const internalPath = z.string().trim().regex(/^\/(?!\/)[A-Za-z0-9\-._~/?=&#%]*$/).max(200);
const optional = (max: number) => z.string().trim().max(max);

const sliderSettingsSchema = z.object({
  slider_autoplay: z.boolean(),
  slider_interval_seconds: z.coerce.number().int().min(2).max(30),
});

export async function saveSliderSettings(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  if (!(await authorize("content.write"))) return { status: "error", message: t.common.noPermissionAction };
  const parsed = sliderSettingsSchema.safeParse({
    slider_autoplay: formData.get("slider_autoplay") === "on",
    slider_interval_seconds: formData.get("slider_interval_seconds"),
  });
  if (!parsed.success) return { status: "error", message: t.homepage.intervalHint };
  const supabase = await createClient();
  const { error } = await supabase.from("store_settings").update(parsed.data).eq("id", 1);
  if (error) return { status: "error", message: dbErrorMessage(error, t) };
  updateTag(HOMEPAGE_TAG);
  return { status: "ok", message: t.homepage.sliderSaved };
}

const slideSchema = z
  .object({
    id: z.union([z.uuid(), z.literal("")]),
    status: z.enum(["draft", "published"]),
    is_enabled: z.boolean(),
    theme: z.enum(["light", "dark"]),
    title_ar: z.string().trim().min(1).max(90),
    title_en: z.string().trim().min(1).max(90),
    description_ar: optional(240),
    description_en: optional(240),
    primary_cta_label_ar: z.string().trim().min(1).max(32),
    primary_cta_label_en: z.string().trim().min(1).max(32),
    primary_cta_href: internalPath,
    secondary_cta_label_ar: optional(32),
    secondary_cta_label_en: optional(32),
    secondary_cta_href: z.union([internalPath, z.literal("")]),
    desktop_media_id: z.union([z.uuid(), z.literal("")]),
    mobile_media_id: z.union([z.uuid(), z.literal("")]),
    composition: z.union([z.enum(["diffusers", "refills", "accessories"]), z.literal("")]),
    accent: z.union([z.enum(["oud", "musk", "floral", "fresh", "woody"]), z.literal("")]),
    alt_ar: optional(160),
    alt_en: optional(160),
  })
  .refine((s) => s.composition !== "" || s.desktop_media_id !== "", { path: ["desktop_media_id"], message: "image" })
  .refine(
    (s) =>
      (s.secondary_cta_href === "" && !s.secondary_cta_label_ar && !s.secondary_cta_label_en) ||
      (s.secondary_cta_href !== "" && Boolean(s.secondary_cta_label_ar) && Boolean(s.secondary_cta_label_en)),
    { path: ["secondary_cta_href"], message: "secondary" },
  );

const slideFields = [
  "status", "theme", "title_ar", "title_en", "description_ar", "description_en",
  "primary_cta_label_ar", "primary_cta_label_en", "primary_cta_href", "secondary_cta_label_ar",
  "secondary_cta_label_en", "secondary_cta_href", "desktop_media_id", "mobile_media_id",
  "composition", "accent", "alt_ar", "alt_en",
] as const;

export async function saveSlide(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  if (!(await authorize("content.write"))) return { status: "error", message: t.common.noPermissionAction };
  const raw: Record<string, unknown> = {};
  for (const key of slideFields) raw[key] = typeof formData.get(key) === "string" ? formData.get(key) : "";
  raw.id = typeof formData.get("entity_id") === "string" ? formData.get("entity_id") : "";
  raw.is_enabled = formData.get("is_enabled") === "on";
  const parsed = slideSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { status: "error", message: fieldErrors.desktop_media_id ? t.homepage.compositionHint : t.common.error, fieldErrors };
  }
  const { id, ...s } = parsed.data;
  const row = {
    ...s,
    secondary_cta_label_ar: s.secondary_cta_href ? s.secondary_cta_label_ar : null,
    secondary_cta_label_en: s.secondary_cta_href ? s.secondary_cta_label_en : null,
    secondary_cta_href: s.secondary_cta_href || null,
    desktop_media_id: s.desktop_media_id || null,
    mobile_media_id: s.mobile_media_id || null,
    composition: s.composition || null,
    accent: s.accent || null,
  };
  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("homepage_slides").update(row).eq("id", id);
    if (error) return { status: "error", message: dbErrorMessage(error, t) };
  } else {
    const { data: last } = await supabase.from("homepage_slides").select("position").order("position", { ascending: false }).limit(1);
    const { error } = await supabase.from("homepage_slides").insert({ ...row, position: (last?.[0]?.position ?? -1) + 1 });
    if (error) return { status: "error", message: dbErrorMessage(error, t) };
  }
  updateTag(HOMEPAGE_TAG);
  redirect(localePath(actionLocale(formData), "/admin/homepage?saved=slide"));
}

export async function deleteSlide(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  if (!(await authorize("content.write"))) return { status: "error", message: t.common.noPermissionAction };
  const id = z.uuid().safeParse(formData.get("entity_id"));
  if (!id.success) return { status: "error", message: t.common.error };
  const supabase = await createClient();
  const { error } = await supabase.from("homepage_slides").delete().eq("id", id.data);
  if (error) return { status: "error", message: dbErrorMessage(error, t) };
  updateTag(HOMEPAGE_TAG);
  redirect(localePath(actionLocale(formData), "/admin/homepage?saved=deleted"));
}

export async function reorderSlides(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  if (!(await authorize("content.write"))) return { status: "error", message: t.common.noPermissionAction };
  const ids = z.array(z.uuid()).max(50).safeParse(formData.getAll("ids"));
  if (!ids.success) return { status: "error", message: t.common.error };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder", { target_table: "homepage_slides", ids: ids.data });
  if (error) return { status: "error", message: dbErrorMessage(error, t) };
  updateTag(HOMEPAGE_TAG);
  return { status: "ok", message: t.common.saved };
}

const sectionKeys = ["categories", "featured", "collections", "scent_library", "story", "finder", "sets"] as const;

export async function saveSections(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  if (!(await authorize("content.write"))) return { status: "error", message: t.common.noPermissionAction };
  const order = z.array(z.enum(sectionKeys)).length(sectionKeys.length).safeParse(formData.getAll("order"));
  if (!order.success || new Set(order.data).size !== sectionKeys.length) return { status: "error", message: t.common.error };
  const supabase = await createClient();
  for (const [position, key] of order.data.entries()) {
    const { error } = await supabase
      .from("homepage_sections")
      .update({ position, is_visible: formData.get(`visible_${key}`) === "on" })
      .eq("key", key);
    if (error) return { status: "error", message: dbErrorMessage(error, t) };
  }
  updateTag(HOMEPAGE_TAG);
  return { status: "ok", message: t.homepage.sectionsSaved };
}
