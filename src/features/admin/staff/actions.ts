"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { localePath } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { createInviteClient, isInviteConfigured } from "@/lib/supabase/admin";
import { actionDictionary, actionLocale } from "@/features/admin/action-locale";
import { appOrigin } from "@/features/admin/auth/origin";
import { authorize } from "@/features/admin/auth/dal";
import { assignableRoles, staffRoles } from "@/features/admin/auth/permissions";
import { emailSchema } from "@/features/admin/auth/schemas";
import type { AdminDictionary } from "@/features/admin/i18n/en";
import type { ActionResult } from "@/features/admin/ui/form";

function staffError(error: { code?: string; message?: string } | null, t: AdminDictionary): string {
  const message = error?.message ?? "";
  if (message.includes("at least one active owner")) return t.staff.lastOwner;
  if (message.includes("own staff access")) return t.staff.self;
  if (message.includes("owner and admin")) return t.staff.ownerOnly;
  if (error?.code === "P0002") return t.staff.notFound;
  if (error?.code === "42501") return t.common.noPermissionAction;
  return t.common.error;
}

const assignSchema = z.object({
  email: emailSchema,
  role: z.enum(staffRoles),
  display_name: z.string().trim().max(80),
});

function readAssign(formData: FormData) {
  return assignSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
    display_name: formData.get("display_name") ?? "",
  });
}

export async function assignRole(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  const actor = await authorize("staff.write");
  if (!actor) return { status: "error", message: t.common.noPermissionAction };
  const parsed = readAssign(formData);
  if (!parsed.success) return { status: "error", message: t.common.error };
  if (!assignableRoles(actor.role).includes(parsed.data.role)) return { status: "error", message: t.staff.ownerOnly };
  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_staff_role", {
    target_email: parsed.data.email,
    target_role: parsed.data.role,
    name: parsed.data.display_name,
  });
  if (error) return { status: "error", message: staffError(error, t) };
  revalidatePath(localePath(actionLocale(formData), "/admin/staff"));
  return { status: "ok", message: t.staff.assignedOk };
}

// Sends a Supabase invitation (the only use of the secret key), then assigns
// the role through the inviter's own session so RLS and the escalation guard
// decide whether the assignment is allowed.
export async function inviteStaff(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  const actor = await authorize("staff.write");
  if (!actor) return { status: "error", message: t.common.noPermissionAction };
  if (!isInviteConfigured()) return { status: "error", message: t.staff.invitePending };
  const parsed = readAssign(formData);
  if (!parsed.success) return { status: "error", message: t.common.error };
  if (!assignableRoles(actor.role).includes(parsed.data.role)) return { status: "error", message: t.staff.ownerOnly };

  const locale = actionLocale(formData);
  const next = encodeURIComponent("/admin/reset-password");
  const invite = await createInviteClient().auth.admin.inviteUserByEmail(parsed.data.email, {
    redirectTo: `${await appOrigin()}${localePath(locale, "/admin/auth/confirm")}?next=${next}`,
  });
  if (invite.error || !invite.data.user) return { status: "error", message: t.common.error };

  const supabase = await createClient();
  const { error } = await supabase.from("staff_members").insert({
    user_id: invite.data.user.id,
    role: parsed.data.role,
    display_name: parsed.data.display_name,
  });
  if (error) return { status: "error", message: staffError(error, t) };
  revalidatePath(localePath(locale, "/admin/staff"));
  return { status: "ok", message: t.staff.invitedOk };
}

const memberSchema = z.object({
  user_id: z.uuid(),
  intent: z.enum(["role", "deactivate", "reactivate", "remove"]),
  role: z.enum(staffRoles).optional(),
});

export async function updateMember(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  const actor = await authorize("staff.write");
  if (!actor) return { status: "error", message: t.common.noPermissionAction };
  const parsed = memberSchema.safeParse({
    user_id: formData.get("user_id"),
    intent: formData.get("intent"),
    role: formData.get("role") || undefined,
  });
  if (!parsed.success) return { status: "error", message: t.common.error };
  if (parsed.data.user_id === actor.userId) return { status: "error", message: t.staff.self };
  const supabase = await createClient();
  const table = supabase.from("staff_members");
  const { intent, user_id, role } = parsed.data;
  const result =
    intent === "remove"
      ? await table.delete().eq("user_id", user_id)
      : intent === "role"
        ? await table.update({ role: role! }).eq("user_id", user_id)
        : await table.update({ is_active: intent === "reactivate" }).eq("user_id", user_id);
  if (result.error) return { status: "error", message: staffError(result.error, t) };
  revalidatePath(localePath(actionLocale(formData), "/admin/staff"));
  return { status: "ok", message: intent === "remove" ? t.staff.removedOk : t.staff.updatedOk };
}
