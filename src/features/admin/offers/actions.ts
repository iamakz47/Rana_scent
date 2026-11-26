"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { localePath } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { CATALOG_TAG } from "@/features/catalog/cache-tags";
import { actionDictionary, actionLocale, dbErrorMessage } from "@/features/admin/action-locale";
import { authorize } from "@/features/admin/auth/dal";
import { parseKwdToFils } from "@/features/admin/format";
import type { ActionResult } from "@/features/admin/ui/form";
import { getAdminOffer, searchAdminCatalogProducts } from "@/features/admin/data/offers";
import type { CatalogSearchItem } from "./offer-editor";
import { duplicateItemIds, readOfferForm, toPayload } from "./schema";

// Offers and the storefront catalog both read from CATALOG_TAG (offers are
// products), so a save here must invalidate the same tag an admin product
// save does.
function refreshStorefront() {
  updateTag(CATALOG_TAG);
}

function offerErrorMessage(error: { code?: string; message?: string } | null, t: ReturnType<typeof actionDictionary>): string {
  if (error?.message && error.message in t.offers.errors) {
    return t.offers.errors[error.message as keyof typeof t.offers.errors];
  }
  return dbErrorMessage(error, t);
}

export async function saveOffer(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  if (!(await authorize("catalog.write"))) return { status: "error", message: t.common.noPermissionAction };

  const parsed = readOfferForm(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { status: "error", message: t.common.error, fieldErrors };
  }
  const priceFils = parseKwdToFils(parsed.data.price);
  if (priceFils === null) return { status: "error", message: t.offers.errors.offer_price_invalid, fieldErrors: { price: "price" } };
  if (duplicateItemIds(parsed.data.items)) {
    return { status: "error", message: t.offers.errors.offer_items_invalid, fieldErrors: { items: "items" } };
  }

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("save_offer", { payload: toPayload(parsed.data, priceFils) });
  if (error || !id) return { status: "error", message: offerErrorMessage(error, t) };

  // "Save and publish".
  let published = false;
  let warning = "";
  if (formData.get("intent") === "publish") {
    if (!(await authorize("catalog.publish"))) {
      warning = t.products.publishRole;
    } else {
      const { error: publishError } = await supabase.from("products").update({ status: "published" }).eq("id", id);
      if (publishError) warning = publishError.code === "23514" ? t.common.error : dbErrorMessage(publishError, t);
      else published = true;
    }
  }

  refreshStorefront();
  if (!parsed.data.id) redirect(localePath(actionLocale(formData), `/admin/offers/${id}?created=1`));
  if (warning) return { status: "error", message: `${t.offers.savedOk} ${warning}` };
  return { status: "ok", message: published ? t.common.publish : t.offers.savedOk };
}

// Copies an offer into a new, unpublished draft: texts, price, included
// products (with their quantities and locked colours) and the promotional
// image (shared, not copied). Any schedule is cleared: a duplicated offer
// should not inherit an expired or future window.
export async function duplicateOffer(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  if (!(await authorize("catalog.write"))) return { status: "error", message: t.common.noPermissionAction };
  const sourceId = z.uuid().safeParse(formData.get("entity_id"));
  if (!sourceId.success) return { status: "error", message: t.common.error };
  const row = await getAdminOffer(sourceId.data);
  if (!row) return { status: "error", message: t.common.error };

  const priceFils = parseKwdToFils(row.price) ?? 0;
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("save_offer", {
    payload: {
      id: null,
      name_ar: `${row.name_ar} (${t.p6.copySuffixAr})`.slice(0, 120),
      name_en: `${row.name_en} (${t.p6.copySuffixEn})`.slice(0, 120),
      description_ar: row.description_ar,
      description_en: row.description_en,
      price_fils: priceFils,
      allow_discount_stacking: row.allow_discount_stacking,
      starts_at: null,
      ends_at: null,
      media: row.media,
      items: row.items.map((item) => ({
        item_product_id: item.product_id,
        quantity: item.quantity,
        locked_variant_id: item.locked_variant_id || null,
      })),
    },
  });
  if (error || !id) return { status: "error", message: offerErrorMessage(error, t) };
  refreshStorefront();
  redirect(localePath(actionLocale(formData), `/admin/offers/${id}?duplicated=1`));
}

// The item picker's search-as-you-type source, called directly from the
// client editor (not a <form> action). Gated the same as the editor itself:
// only staff who could reach /admin/offers/new or /admin/offers/[id]'s
// editor can search for products to add to it.
export async function searchOfferCatalogProducts(query: string): Promise<CatalogSearchItem[]> {
  if (!(await authorize("catalog.write"))) return [];
  return searchAdminCatalogProducts(query);
}
