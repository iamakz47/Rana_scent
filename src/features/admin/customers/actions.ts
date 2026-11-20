"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { localePath } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, isServiceConfigured } from "@/lib/supabase/service";
import { actionDictionary, actionLocale, dbErrorMessage } from "@/features/admin/action-locale";
import { authorize } from "@/features/admin/auth/dal";
import type { ActionResult } from "@/features/admin/ui/form";

// Completes or rejects a customer's account deletion request. The database
// (with the staff member's own session) checks permissions, anonymises the
// profile, removes addresses and detaches orders; the login itself is then
// removed with the service role.
export async function resolveDeletion(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  if (!(await authorize("customers.read")) || !(await authorize("orders.write"))) {
    return { status: "error", message: t.common.noPermissionAction };
  }
  const parsed = z
    .object({ id: z.uuid(), complete: z.enum(["1", "0"]), note: z.string().trim().max(500) })
    .safeParse({ id: formData.get("request_id"), complete: formData.get("complete"), note: formData.get("note") ?? "" });
  if (!parsed.success) return { status: "error", message: t.common.error };
  const supabase = await createClient();
  const { data: userId, error } = await supabase.rpc("resolve_account_deletion", {
    p_request: parsed.data.id,
    p_complete: parsed.data.complete === "1",
    p_note: parsed.data.note,
  });
  if (error) return { status: "error", message: dbErrorMessage(error, t) };
  revalidatePath(localePath(actionLocale(formData), "/admin/customers"));
  if (parsed.data.complete === "1" && userId) {
    if (!isServiceConfigured()) return { status: "ok", message: t.p4.deletionAuthWarning };
    const { error: authError } = await createServiceClient().auth.admin.deleteUser(String(userId));
    if (authError) return { status: "ok", message: t.p4.deletionAuthWarning };
  }
  return { status: "ok", message: t.p4.deletionDone };
}
