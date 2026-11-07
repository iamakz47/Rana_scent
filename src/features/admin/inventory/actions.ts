"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { CATALOG_TAG } from "@/features/catalog/cache-tags";
import { actionDictionary, dbErrorMessage } from "@/features/admin/action-locale";
import { authorize } from "@/features/admin/auth/dal";
import type { ActionResult } from "@/features/admin/ui/form";

const adjustSchema = z.object({
  variant_id: z.uuid(),
  change: z.coerce.number().int().min(-100000).max(100000).refine((n) => n !== 0),
  reason: z.enum(["initial", "restock", "adjustment", "correction", "damage"]),
  note: z.string().trim().max(300),
});

export async function adjustStock(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  if (!(await authorize("inventory.adjust"))) return { status: "error", message: t.common.noPermissionAction };
  const parsed = adjustSchema.safeParse({
    variant_id: formData.get("variant_id"),
    change: formData.get("change"),
    reason: formData.get("reason"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return { status: "error", message: t.inventory.changeHint };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("adjust_inventory", {
    target_variant: parsed.data.variant_id,
    quantity_change: parsed.data.change,
    reason: parsed.data.reason,
    note: parsed.data.note,
  });
  if (error) return { status: "error", message: error.code === "23514" ? t.inventory.negative : dbErrorMessage(error, t) };
  updateTag(CATALOG_TAG);
  return { status: "ok", message: `${t.inventory.adjustedOk} ${t.inventory.onHand}: ${data}` };
}

export async function setThreshold(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  if (!(await authorize("inventory.adjust"))) return { status: "error", message: t.common.noPermissionAction };
  const parsed = z
    .object({ variant_id: z.uuid(), threshold: z.coerce.number().int().min(0).max(100000) })
    .safeParse({ variant_id: formData.get("variant_id"), threshold: formData.get("threshold") });
  if (!parsed.success) return { status: "error", message: t.common.error };
  const supabase = await createClient();
  const { error } = await supabase
    .from("inventory")
    .update({ low_stock_threshold: parsed.data.threshold })
    .eq("variant_id", parsed.data.variant_id);
  if (error) return { status: "error", message: dbErrorMessage(error, t) };
  updateTag(CATALOG_TAG);
  return { status: "ok", message: t.inventory.thresholdSaved };
}
