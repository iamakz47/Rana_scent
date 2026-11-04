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
import { parseSpecs, readProductForm, toPayload } from "./schema";

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

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("save_product", { payload: toPayload(parsed.data, specs) });
  if (error || !id) return { status: "error", message: dbErrorMessage(error, t, t.products.slugTaken) };

  refreshStorefront();
  if (!parsed.data.id) redirect(localePath(actionLocale(formData), `/admin/products/${id}?created=1`));
  return { status: "ok", message: t.products.savedOk };
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
  const { data, error } = await supabase.from("products").delete().eq("id", id.data).neq("status", "published").select("id");
  if (error) {
    return { status: "error", message: error.code === "23503" ? t.products.cannotDelete : dbErrorMessage(error, t) };
  }
  if (!data?.length) return { status: "error", message: t.common.noPermissionAction };
  refreshStorefront();
  redirect(localePath(actionLocale(formData), "/admin/products"));
}
