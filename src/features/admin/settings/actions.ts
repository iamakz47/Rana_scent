"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { HOMEPAGE_TAG } from "@/features/catalog/cache-tags";
import { actionDictionary, dbErrorMessage } from "@/features/admin/action-locale";
import { authorize } from "@/features/admin/auth/dal";
import type { ActionResult } from "@/features/admin/ui/form";

const phone = z.union([z.literal(""), z.string().trim().regex(/^\+?[0-9 ]{7,20}$/)]);
const settingsSchema = z.object({
  contact_email: z.union([z.literal(""), z.email().max(254)]),
  contact_phone: phone,
  whatsapp_number: phone,
  instagram_handle: z.union([z.literal(""), z.string().trim().regex(/^[A-Za-z0-9._]{1,30}$/)]),
  default_low_stock_threshold: z.coerce.number().int().min(0).max(100000),
});

export async function saveSettings(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  if (!(await authorize("settings.write"))) return { status: "error", message: t.common.noPermissionAction };
  const value = (key: string) => (typeof formData.get(key) === "string" ? String(formData.get(key)).trim() : "");
  const parsed = settingsSchema.safeParse({
    contact_email: value("contact_email"),
    contact_phone: value("contact_phone"),
    whatsapp_number: value("whatsapp_number"),
    instagram_handle: value("instagram_handle").replace(/^@/, ""),
    default_low_stock_threshold: value("default_low_stock_threshold"),
  });
  if (!parsed.success) return { status: "error", message: t.common.error };
  const supabase = await createClient();
  const { error } = await supabase.from("store_settings").update(parsed.data).eq("id", 1);
  if (error) return { status: "error", message: dbErrorMessage(error, t) };
  updateTag(HOMEPAGE_TAG);
  return { status: "ok", message: t.settings.savedOk };
}
