"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { localePath } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { actionDictionary, actionLocale, dbErrorMessage } from "@/features/admin/action-locale";
import { authorize } from "@/features/admin/auth/dal";
import type { ActionResult } from "@/features/admin/ui/form";
import { policyKeys } from "@/features/policies/keys";
import { POLICY_TAG } from "@/features/policies/data";

// Policy edits run with the staff member's own session; the database checks
// settings.write (owner, admin) for drafts, publishing and unpublishing.
function refresh(formData: FormData, key: string) {
  const locale = actionLocale(formData);
  revalidatePath(localePath(locale, "/admin/policies"));
  revalidatePath(localePath(locale, `/admin/policies/${key}`));
}

export async function savePolicyDraft(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  if (!(await authorize("settings.write"))) return { status: "error", message: t.common.noPermissionAction };
  const parsed = z
    .object({
      key: z.enum(policyKeys),
      title_ar: z.string().trim().max(120),
      title_en: z.string().trim().max(120),
      body_ar: z.string().max(30000),
      body_en: z.string().max(30000),
    })
    .safeParse({
      key: formData.get("policy_key"),
      title_ar: formData.get("title_ar") ?? "",
      title_en: formData.get("title_en") ?? "",
      body_ar: formData.get("body_ar") ?? "",
      body_en: formData.get("body_en") ?? "",
    });
  if (!parsed.success) return { status: "error", message: t.common.error };
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_policy_draft", {
    p_key: parsed.data.key,
    p_title_ar: parsed.data.title_ar,
    p_title_en: parsed.data.title_en,
    p_body_ar: parsed.data.body_ar,
    p_body_en: parsed.data.body_en,
  });
  if (error) return { status: "error", message: dbErrorMessage(error, t) };
  refresh(formData, parsed.data.key);
  return { status: "ok", message: t.p5.policies.draftSaved };
}

export async function setPolicyPublished(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  if (!(await authorize("settings.write"))) return { status: "error", message: t.common.noPermissionAction };
  const key = z.enum(policyKeys).safeParse(formData.get("policy_key"));
  const publish = formData.get("intent") === "publish";
  if (!key.success) return { status: "error", message: t.common.error };
  const supabase = await createClient();
  const { error } = await supabase.rpc(publish ? "publish_policy" : "unpublish_policy", { p_key: key.data });
  if (error) {
    return { status: "error", message: error.message === "policy_incomplete" ? t.p5.policies.incomplete : dbErrorMessage(error, t) };
  }
  updateTag(POLICY_TAG);
  refresh(formData, key.data);
  return { status: "ok", message: publish ? t.p5.policies.publishedOk : t.p5.policies.unpublishedOk };
}
