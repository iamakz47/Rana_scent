"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { localePath } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { actionDictionary, actionLocale, dbErrorMessage } from "@/features/admin/action-locale";
import { authorize } from "@/features/admin/auth/dal";
import { parseKwdToFils } from "@/features/admin/format";
import type { ActionResult } from "@/features/admin/ui/form";

const optionalDate = z.union([z.literal(""), z.iso.datetime({ local: true })]);

export async function saveDiscountCode(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  if (!(await authorize("marketing.write"))) return { status: "error", message: t.common.noPermissionAction };
  const c = t.commerce.discounts;
  const get = (key: string) => String(formData.get(key) ?? "").trim();
  const parsed = z
    .object({
      id: z.union([z.uuid(), z.literal("")]),
      code: z.string().toUpperCase().regex(/^[A-Z0-9]{3,24}$/),
      kind: z.enum(["percentage", "fixed"]),
      value: z.string().min(1),
      minimum: z.string(),
      starts: optionalDate,
      ends: optionalDate,
      limit: z.union([z.literal(""), z.coerce.number().int().min(1).max(1_000_000)]),
      active: z.boolean(),
    })
    .safeParse({
      id: get("entity_id"),
      code: get("code"),
      kind: get("kind"),
      value: get("value"),
      minimum: get("minimum"),
      starts: get("starts"),
      ends: get("ends"),
      limit: get("limit"),
      active: formData.get("active") === "on",
    });
  if (!parsed.success) return { status: "error", message: c.invalid };
  const d = parsed.data;
  const value = d.kind === "percentage" ? Number(d.value) : parseKwdToFils(d.value);
  const minimum = d.minimum ? parseKwdToFils(d.minimum) : 0;
  if (value === null || !Number.isInteger(value) || value <= 0 || (d.kind === "percentage" && value > 100) || minimum === null) {
    return { status: "error", message: c.invalid };
  }
  // datetime-local values are Kuwait time (UTC+3, no DST).
  const toUtc = (local: string) => (local ? new Date(`${local}:00+03:00`).toISOString() : null);
  const row = {
    code: d.code,
    kind: d.kind,
    value,
    min_subtotal_fils: minimum,
    starts_at: toUtc(d.starts),
    ends_at: toUtc(d.ends),
    max_redemptions: d.limit === "" ? null : d.limit,
    is_active: d.active,
  };
  const supabase = await createClient();
  const { error } = d.id
    ? await supabase.from("discount_codes").update(row).eq("id", d.id)
    : await supabase.from("discount_codes").insert(row);
  if (error) return { status: "error", message: error.code === "23505" ? c.duplicate : error.code === "23514" ? c.invalid : dbErrorMessage(error, t) };
  revalidatePath(localePath(actionLocale(formData), "/admin/promotions"));
  return { status: "ok", message: c.saved };
}
