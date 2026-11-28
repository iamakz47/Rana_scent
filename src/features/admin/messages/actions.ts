"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { localePath } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { actionDictionary, actionLocale, dbErrorMessage } from "@/features/admin/action-locale";
import { authorize } from "@/features/admin/auth/dal";
import type { ActionResult } from "@/features/admin/ui/form";

// Marks a contact message new, read or archived. The database checks the
// customers.read permission (owner, admin, manager, support) again.
export async function setMessageStatus(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  if (!(await authorize("customers.read"))) return { status: "error", message: t.common.noPermissionAction };
  const parsed = z
    .object({ id: z.uuid(), status: z.enum(["new", "read", "archived"]) })
    .safeParse({ id: formData.get("message_id"), status: formData.get("status") });
  if (!parsed.success) return { status: "error", message: t.common.error };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_contact_message_status", { p_id: parsed.data.id, p_status: parsed.data.status });
  if (error) return { status: "error", message: dbErrorMessage(error, t) };
  revalidatePath(localePath(actionLocale(formData), "/admin/messages"));
  return { status: "ok", message: t.p8.messages.updated };
}
