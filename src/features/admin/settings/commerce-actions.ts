"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { localePath } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { actionDictionary, actionLocale, dbErrorMessage } from "@/features/admin/action-locale";
import { authorize } from "@/features/admin/auth/dal";
import { parseKwdToFils } from "@/features/admin/format";
import type { ActionResult } from "@/features/admin/ui/form";

const governorates = ["capital", "hawalli", "farwaniya", "ahmadi", "jahra", "mubarak_al_kabeer"] as const;

function done(formData: FormData) {
  revalidatePath(localePath(actionLocale(formData), "/admin/settings"));
}

export async function saveCheckoutSettings(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  if (!(await authorize("settings.write"))) return { status: "error", message: t.common.noPermissionAction };
  const parsed = z
    .object({
      cod_enabled: z.boolean(),
      online_payments_enabled: z.boolean(),
      order_expiry_minutes: z.coerce.number().int().min(10).max(240),
      delivery_note_ar: z.string().trim().max(300),
      delivery_note_en: z.string().trim().max(300),
    })
    .safeParse({
      cod_enabled: formData.get("cod_enabled") === "on",
      online_payments_enabled: formData.get("online_payments_enabled") === "on",
      order_expiry_minutes: formData.get("order_expiry_minutes"),
      delivery_note_ar: formData.get("delivery_note_ar") ?? "",
      delivery_note_en: formData.get("delivery_note_en") ?? "",
    });
  if (!parsed.success) return { status: "error", message: t.common.error };
  const supabase = await createClient();
  const { error } = await supabase.from("store_settings").update(parsed.data).eq("id", 1);
  if (error) return { status: "error", message: dbErrorMessage(error, t) };
  done(formData);
  return { status: "ok", message: t.commerce.payments.saved };
}

export async function saveZone(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  if (!(await authorize("settings.write"))) return { status: "error", message: t.common.noPermissionAction };
  const parsed = z
    .object({
      id: z.union([z.uuid(), z.literal("")]),
      name_ar: z.string().trim().min(1).max(80),
      name_en: z.string().trim().min(1).max(80),
      governorates: z.array(z.enum(governorates)).min(1),
      areas: z.array(z.string().trim().min(1).max(80)).max(200),
      is_active: z.boolean(),
      position: z.coerce.number().int().min(0).max(1000),
    })
    .safeParse({
      id: String(formData.get("entity_id") ?? ""),
      name_ar: formData.get("name_ar"),
      name_en: formData.get("name_en"),
      governorates: formData.getAll("governorates"),
      areas: String(formData.get("areas") ?? "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      is_active: formData.get("is_active") === "on",
      position: formData.get("position") || 0,
    });
  if (!parsed.success) return { status: "error", message: t.common.error };
  const { id, ...row } = parsed.data;
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("shipping_zones").update(row).eq("id", id)
    : await supabase.from("shipping_zones").insert(row);
  if (error) return { status: "error", message: dbErrorMessage(error, t) };
  done(formData);
  return { status: "ok", message: t.commerce.delivery.zoneSaved };
}

export async function saveRate(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  if (!(await authorize("settings.write"))) return { status: "error", message: t.common.noPermissionAction };
  const price = parseKwdToFils(formData.get("price"));
  const freeOverRaw = String(formData.get("free_over") ?? "").trim();
  const freeOver = freeOverRaw ? parseKwdToFils(freeOverRaw) : null;
  const parsed = z
    .object({
      id: z.union([z.uuid(), z.literal("")]),
      zone_id: z.uuid(),
      name_ar: z.string().trim().min(1).max(80),
      name_en: z.string().trim().min(1).max(80),
      min_days: z.coerce.number().int().min(0).max(60),
      max_days: z.coerce.number().int().min(0).max(60),
      is_active: z.boolean(),
    })
    .refine((v) => v.max_days >= v.min_days)
    .safeParse({
      id: String(formData.get("rate_id") ?? ""),
      zone_id: formData.get("entity_id"),
      name_ar: formData.get("name_ar"),
      name_en: formData.get("name_en"),
      min_days: formData.get("min_days"),
      max_days: formData.get("max_days"),
      is_active: formData.get("is_active") === "on",
    });
  if (!parsed.success || price === null || (freeOverRaw && (freeOver === null || freeOver === 0))) {
    return { status: "error", message: t.common.error };
  }
  const { id, ...rest } = parsed.data;
  const row = { ...rest, price_fils: price, free_over_fils: freeOver };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("shipping_rates").update(row).eq("id", id)
    : await supabase.from("shipping_rates").insert(row);
  if (error) return { status: "error", message: dbErrorMessage(error, t) };
  done(formData);
  return { status: "ok", message: t.commerce.delivery.rateSaved };
}
