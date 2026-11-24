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
import { getAdminProduct } from "@/features/admin/data/catalog";
import { parseSpecs, readProductForm, slugFromName, toPayload } from "./schema";
import { readProductDetails } from "./details-schema";

function refreshStorefront() {
  updateTag(CATALOG_TAG);
  updateTag(HOMEPAGE_TAG);
}

export async function saveProduct(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  if (!(await authorize("catalog.write"))) return { status: "error", message: t.common.noPermissionAction };

  const parsed = readProductForm(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { status: "error", message: t.common.error, fieldErrors };
  }
  const specs = parseSpecs(parsed.data.specs_ar, parsed.data.specs_en);
  if (specs === null) return { status: "error", message: t.products.specsHint, fieldErrors: { specs: "specs" } };
  const details = readProductDetails(formData, parsed.data.type);
  if (Object.keys(details.errors).length) {
    return { status: "error", message: t.common.error, fieldErrors: details.errors };
  }

  const supabase = await createClient();
  // An offer is never edited (or converted) through the product editor.
  if (parsed.data.id) {
    const { data: existing } = await supabase.from("products").select("type").eq("id", parsed.data.id).maybeSingle();
    if (existing?.type === "bundle") return { status: "error", message: t.common.noPermissionAction };
  }
  const { data: id, error } = await supabase.rpc("save_product", {
    payload: {
      ...toPayload(parsed.data, specs),
      device_specs: details.device_specs,
      info_sections: details.info_sections,
      free_fragrances: details.free_fragrances,
      free_fragrance_eligible: details.free_fragrance_eligible,
    },
  });
  if (error || !id) return { status: "error", message: dbErrorMessage(error, t, t.products.slugTaken) };

  // Stock per variant (colour), through the audited stock adjustment.
  let warning = "";
  const wanted = parsed.data.variants.filter((v) => v.stock !== null);
  if (wanted.length) {
    if (!(await authorize("inventory.adjust"))) {
      warning = t.p6.stockNotChanged;
    } else {
      const { data: rows } = await supabase.from("product_variants").select("id, sku, inventory(on_hand)").eq("product_id", id);
      for (const v of wanted) {
        const row = rows?.find((r) => r.sku === v.sku);
        if (!row) continue;
        const onHand = row.inventory?.on_hand ?? 0;
        const change = (v.stock ?? onHand) - onHand;
        if (change === 0) continue;
        const { error: stockError } = await supabase.rpc("adjust_inventory", {
          target_variant: row.id,
          quantity_change: change,
          reason: onHand === 0 && change > 0 ? "initial" : "correction",
          note: "Product editor",
        });
        if (stockError) warning = t.p6.stockNotChanged;
      }
    }
  }

  // "Save and publish".
  let published = false;
  if (formData.get("intent") === "publish") {
    if (!(await authorize("catalog.publish"))) {
      warning = t.products.publishRole;
    } else {
      const { error: publishError } = await supabase.from("products").update({ status: "published" }).eq("id", id);
      if (publishError) warning = publishError.code === "23514" ? t.products.publishNeedsVariant : dbErrorMessage(publishError, t);
      else published = true;
    }
  }

  refreshStorefront();
  if (!parsed.data.id) redirect(localePath(actionLocale(formData), `/admin/products/${id}?created=${published ? "published" : "1"}`));
  if (warning) return { status: "error", message: `${t.products.savedOk} ${warning}` };
  return { status: "ok", message: published ? t.products.publishedOk : t.products.savedOk };
}

// Copies a product into a new, unpublished draft: texts, specifications,
// colours (with new SKUs), prices, photos (shared, not copied) and
// organisation. Stock is never copied: the copy starts at zero.
export async function duplicateProduct(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  if (!(await authorize("catalog.write"))) return { status: "error", message: t.common.noPermissionAction };
  const sourceId = z.uuid().safeParse(formData.get("entity_id"));
  if (!sourceId.success) return { status: "error", message: t.common.error };
  const row = await getAdminProduct(sourceId.data);
  // Offers have their own duplicate (it also copies what they include).
  if (!row || row.type === "bundle") return { status: "error", message: t.common.error };

  const tag = Math.random().toString(36).slice(2, 6).toUpperCase();
  const variants = [...row.product_variants].sort((a, b) => a.position - b.position);
  const skuMap = new Map(variants.map((v) => [v.id, `${v.sku.slice(0, 34)}-${tag}`]));
  const media = [...row.product_media].sort((a, b) => a.position - b.position);
  const variantOf = (m: object) => (m as { variant_id?: string | null }).variant_id ?? null;

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("save_product", {
    payload: {
      slug: `${row.slug.slice(0, 70)}-${tag.toLowerCase()}`.replace(/^-+/, "") || slugFromName(row.name_en),
      type: row.type,
      name_ar: `${row.name_ar} (${t.p6.copySuffixAr})`.slice(0, 120),
      name_en: `${row.name_en} (${t.p6.copySuffixEn})`.slice(0, 120),
      short_description_ar: row.short_description_ar,
      short_description_en: row.short_description_en,
      description_ar: row.description_ar,
      description_en: row.description_en,
      notes: row.notes,
      specs: row.specs,
      specs_confirmed: row.specs_confirmed,
      spaces: row.spaces,
      is_featured: false,
      is_new: row.is_new,
      position: row.position,
      category_id: row.product_categories.find((c) => c.is_primary)?.category_id ?? row.product_categories[0]?.category_id ?? null,
      seo_title_ar: "",
      seo_title_en: "",
      seo_description_ar: row.seo_description_ar,
      seo_description_en: row.seo_description_en,
      device_specs: row.device_specs,
      info_sections: row.info_sections,
      free_fragrances: row.free_fragrances ? String(row.free_fragrances) : "",
      free_fragrance_eligible: row.free_fragrance_eligible,
      variants: variants.map((v, index) => ({
        sku: skuMap.get(v.id),
        label_ar: v.label_ar,
        label_en: v.label_en,
        price_fils: v.price_fils,
        compare_at_fils: v.compare_at_fils,
        is_active: v.is_active,
        color_hex: (v as { color_hex?: string | null }).color_hex ?? "",
        position: index,
      })),
      media: media.map((m) => m.media_assets?.id).filter(Boolean),
      media_variants: media
        .filter((m) => variantOf(m) && m.media_assets?.id && skuMap.has(variantOf(m)!))
        .map((m) => ({ media_id: m.media_assets!.id, variant_sku: skuMap.get(variantOf(m)!) })),
      scents: [...row.product_scents].sort((a, b) => a.position - b.position).map((s) => s.scent_family_id),
      compatible: row.device_compatibility.map((d) => d.compatible_product_id),
    },
  });
  if (error || !id) return { status: "error", message: dbErrorMessage(error, t, t.products.slugTaken) };
  refreshStorefront();
  redirect(localePath(actionLocale(formData), `/admin/products/${id}?duplicated=1`));
}

const statusSchema = z.object({
  id: z.uuid(),
  status: z.enum(["draft", "published", "archived"]),
});

export async function setProductStatus(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  if (!(await authorize("catalog.publish"))) return { status: "error", message: t.products.publishRole };
  const parsed = statusSchema.safeParse({ id: formData.get("entity_id"), status: formData.get("status") });
  if (!parsed.success) return { status: "error", message: t.common.error };

  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ status: parsed.data.status }).eq("id", parsed.data.id);
  if (error) {
    const message = error.code === "23514" ? t.products.publishNeedsVariant : dbErrorMessage(error, t);
    return { status: "error", message };
  }
  refreshStorefront();
  const messages = { published: t.products.publishedOk, draft: t.products.unpublishedOk, archived: t.products.archivedOk };
  return { status: "ok", message: messages[parsed.data.status] };
}

export async function deleteProduct(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  if (!(await authorize("catalog.publish"))) return { status: "error", message: t.common.noPermissionAction };
  const id = z.uuid().safeParse(formData.get("entity_id"));
  if (!id.success) return { status: "error", message: t.common.error };

  const supabase = await createClient();
  const { data, error } = await supabase.from("products").delete().eq("id", id.data).neq("status", "published").select("id, type");
  if (error) {
    return { status: "error", message: error.code === "23503" ? t.products.cannotDelete : dbErrorMessage(error, t) };
  }
  if (!data?.length) return { status: "error", message: t.common.noPermissionAction };
  refreshStorefront();
  // An offer is a product (type='bundle') but lives under its own section.
  const back = data[0].type === "bundle" ? "/admin/offers" : "/admin/products";
  redirect(localePath(actionLocale(formData), back));
}
