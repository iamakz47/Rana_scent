"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { localePath } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { CATALOG_TAG, HOMEPAGE_TAG } from "@/features/catalog/cache-tags";
import { actionDictionary, actionLocale, dbErrorMessage } from "@/features/admin/action-locale";
import { authorize } from "@/features/admin/auth/dal";
import type { ActionResult } from "@/features/admin/ui/form";

const text = (max: number) => z.string().trim().max(max);

const categorySchema = z.object({
  id: z.union([z.uuid(), z.literal("")]),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(60),
  product_type: z.union([z.enum(["diffuser", "refill", "accessory", "bundle"]), z.literal("")]),
  name_ar: z.string().trim().min(1).max(80),
  name_en: z.string().trim().min(1).max(80),
  description_ar: text(400),
  description_en: text(400),
  image_id: z.union([z.uuid(), z.literal("")]),
  position: z.coerce.number().int().min(0).max(32000),
  is_visible: z.boolean(),
  show_on_home: z.boolean(),
  seo_title_ar: text(70),
  seo_title_en: text(70),
  seo_description_ar: text(170),
  seo_description_en: text(170),
});

function refresh() {
  updateTag(CATALOG_TAG);
  updateTag(HOMEPAGE_TAG);
}

export async function saveCategory(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  if (!(await authorize("catalog.write"))) return { status: "error", message: t.common.noPermissionAction };
  const str = (key: string) => (typeof formData.get(key) === "string" ? (formData.get(key) as string) : "");
  const parsed = categorySchema.safeParse({
    ...Object.fromEntries(
      ["id", "slug", "product_type", "name_ar", "name_en", "description_ar", "description_en", "image_id", "position",
        "seo_title_ar", "seo_title_en", "seo_description_ar", "seo_description_en"].map((key) => [key, str(key)]),
    ),
    is_visible: formData.get("is_visible") === "on",
    show_on_home: formData.get("show_on_home") === "on",
  });
  if (!parsed.success) return { status: "error", message: t.common.error };
  const { id, ...fields } = parsed.data;
  const row = { ...fields, product_type: fields.product_type || null, image_id: fields.image_id || null };

  const supabase = await createClient();
  const result = id
    ? await supabase.from("categories").update(row).eq("id", id).select("id").single()
    : await supabase.from("categories").insert(row).select("id").single();
  if (result.error) return { status: "error", message: dbErrorMessage(result.error, t, t.products.slugTaken) };
  refresh();
  if (!id) redirect(localePath(actionLocale(formData), "/admin/categories"));
  return { status: "ok", message: t.categories.savedOk };
}

export async function setCategoryArchived(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  if (!(await authorize("catalog.write"))) return { status: "error", message: t.common.noPermissionAction };
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { status: "error", message: t.common.error };
  const archive = formData.get("archive") === "1";
  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq("id", id.data);
  if (error) return { status: "error", message: dbErrorMessage(error, t) };
  refresh();
  return { status: "ok", message: archive ? t.categories.archivedOk : t.categories.restoredOk };
}

export async function reorderCategories(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  if (!(await authorize("catalog.write"))) return { status: "error", message: t.common.noPermissionAction };
  const ids = z.array(z.uuid()).max(200).safeParse(formData.getAll("ids"));
  if (!ids.success) return { status: "error", message: t.common.error };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder", { target_table: "categories", ids: ids.data });
  if (error) return { status: "error", message: dbErrorMessage(error, t) };
  refresh();
  return { status: "ok", message: t.common.saved };
}
