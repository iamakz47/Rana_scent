"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { localePath } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { actionDictionary, actionLocale, dbErrorMessage } from "@/features/admin/action-locale";
import { authorize } from "@/features/admin/auth/dal";
import { parseKwdToFils } from "@/features/admin/format";
import type { ActionResult } from "@/features/admin/ui/form";

const statuses = ["processing", "ready_for_delivery", "out_for_delivery", "delivered", "cancelled"] as const;

function refresh(formData: FormData, id: string) {
  const locale = actionLocale(formData);
  revalidatePath(localePath(locale, `/admin/orders/${id}`));
  revalidatePath(localePath(locale, "/admin/orders"));
}

export async function updateOrderStatus(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  if (!(await authorize("orders.write"))) return { status: "error", message: t.common.noPermissionAction };
  const parsed = z
    .object({ id: z.uuid(), status: z.enum(statuses) })
    .safeParse({ id: formData.get("entity_id"), status: formData.get("status") });
  if (!parsed.success) return { status: "error", message: t.common.error };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .select("id");
  if (error) {
    return { status: "error", message: error.code === "23514" ? t.commerce.orders.errors.transition : dbErrorMessage(error, t) };
  }
  if (!data?.length) return { status: "error", message: t.common.noPermissionAction };
  refresh(formData, parsed.data.id);
  return { status: "ok", message: t.commerce.orders.statusSaved };
}

export async function saveTracking(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  if (!(await authorize("orders.write"))) return { status: "error", message: t.common.noPermissionAction };
  const parsed = z
    .object({
      id: z.uuid(),
      courier: z.string().trim().max(80),
      tracking_number: z.string().trim().max(80),
      estimated_delivery: z.union([z.literal(""), z.iso.date()]),
    })
    .safeParse({
      id: formData.get("entity_id"),
      courier: formData.get("courier") ?? "",
      tracking_number: formData.get("tracking_number") ?? "",
      estimated_delivery: formData.get("estimated_delivery") ?? "",
    });
  if (!parsed.success) return { status: "error", message: t.common.error };
  const { id, ...fields } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ ...fields, estimated_delivery: fields.estimated_delivery || null })
    .eq("id", id);
  if (error) return { status: "error", message: dbErrorMessage(error, t) };
  refresh(formData, id);
  return { status: "ok", message: t.commerce.orders.trackingSaved };
}

export async function addOrderNote(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  const staff = await authorize("orders.write");
  if (!staff) return { status: "error", message: t.common.noPermissionAction };
  const parsed = z
    .object({ id: z.uuid(), body: z.string().trim().min(1).max(1000) })
    .safeParse({ id: formData.get("entity_id"), body: formData.get("body") });
  if (!parsed.success) return { status: "error", message: t.common.error };
  const supabase = await createClient();
  const { error } = await supabase
    .from("order_notes")
    .insert({ order_id: parsed.data.id, body: parsed.data.body, actor_id: staff.userId });
  if (error) return { status: "error", message: dbErrorMessage(error, t) };
  refresh(formData, parsed.data.id);
  return { status: "ok", message: t.commerce.orders.noteSaved };
}

export async function requestRefund(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  if (!((await authorize("orders.write")) || (await authorize("finance.write")))) {
    return { status: "error", message: t.common.noPermissionAction };
  }
  const id = z.uuid().safeParse(formData.get("entity_id"));
  const amount = parseKwdToFils(formData.get("amount"));
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  if (!id.success || amount === null) return { status: "error", message: t.commerce.orders.errors.refund_amount_invalid };
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_refund", { p_order: id.data, p_amount: amount, p_reason: reason });
  if (error) {
    return { status: "error", message: t.commerce.orders.errors[error.message] ?? dbErrorMessage(error, t) };
  }
  refresh(formData, id.data);
  return { status: "ok", message: t.commerce.orders.refundRequested };
}

export async function resolveRefund(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  if (!(await authorize("finance.write"))) return { status: "error", message: t.common.noPermissionAction };
  const parsed = z
    .object({ id: z.uuid(), approve: z.enum(["1", "0"]), provider: z.string().trim().max(80), order: z.uuid() })
    .safeParse({
      id: formData.get("refund_id"),
      approve: formData.get("approve"),
      provider: formData.get("provider_refund_id") ?? "",
      order: formData.get("entity_id"),
    });
  if (!parsed.success) return { status: "error", message: t.common.error };
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_refund", {
    p_request: parsed.data.id,
    p_approve: parsed.data.approve === "1",
    p_provider_refund_id: parsed.data.provider,
  });
  if (error) return { status: "error", message: dbErrorMessage(error, t) };
  refresh(formData, parsed.data.order);
  revalidatePath(localePath(actionLocale(formData), "/admin/finance"));
  return { status: "ok", message: t.commerce.orders.refundResolved };
}
