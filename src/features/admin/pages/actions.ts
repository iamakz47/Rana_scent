"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { localePath } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { actionDictionary, actionLocale, dbErrorMessage } from "@/features/admin/action-locale";
import { authorize } from "@/features/admin/auth/dal";
import type { ActionResult } from "@/features/admin/ui/form";
import { SITE_PAGES_TAG } from "@/features/site-pages/data";
import { pageContentSchema, sitePageKeys } from "@/features/site-pages/schema";

// Page edits run with the staff member's own session; the database checks
// content.write (owner, admin, manager, editor) for drafts and publishing.
function refresh(formData: FormData, key: string) {
  const locale = actionLocale(formData);
  revalidatePath(localePath(locale, "/admin/pages"));
  revalidatePath(localePath(locale, `/admin/pages/${key}`));
}

// Validates the posted content and saves it as the draft. Returns an error
// message, or null when saved.
async function saveDraft(formData: FormData, t: ReturnType<typeof actionDictionary>): Promise<string | null> {
  const key = z.enum(sitePageKeys).safeParse(formData.get("page_key"));
  let raw: unknown = null;
  try {
    raw = JSON.parse(String(formData.get("content") ?? ""));
  } catch {
    raw = null;
  }
  const content = pageContentSchema.safeParse(raw);
  if (!key.success || !content.success) return t.p8.pages.invalid;
  // Only the FAQ keeps questions; empty questions are dropped.
  const value = {
    ...content.data,
    items: key.data === "faq" ? content.data.items.filter((item) => item.q.ar || item.q.en || item.a.ar || item.a.en) : [],
  };
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_site_page_draft", { p_key: key.data, p_content: value });
  if (error) return error.code === "PGRST202" ? t.p8.pages.unavailable : dbErrorMessage(error, t);
  return null;
}

export async function savePageDraft(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  if (!(await authorize("content.write"))) return { status: "error", message: t.common.noPermissionAction };
  const problem = await saveDraft(formData, t);
  if (problem) return { status: "error", message: problem };
  refresh(formData, String(formData.get("page_key")));
  return { status: "ok", message: t.p8.pages.draftSaved };
}

export async function setPagePublished(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  if (!(await authorize("content.write"))) return { status: "error", message: t.common.noPermissionAction };
  const key = z.enum(sitePageKeys).safeParse(formData.get("page_key"));
  if (!key.success) return { status: "error", message: t.common.error };
  const publish = formData.get("intent") === "publish";
  // Publishing what is on screen: the current text is saved first.
  if (publish && formData.get("content")) {
    const problem = await saveDraft(formData, t);
    if (problem) return { status: "error", message: problem };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc(publish ? "publish_site_page" : "unpublish_site_page", { p_key: key.data });
  if (error) {
    return { status: "error", message: error.message === "page_incomplete" ? t.p8.pages.incomplete : dbErrorMessage(error, t) };
  }
  updateTag(SITE_PAGES_TAG);
  refresh(formData, key.data);
  return { status: "ok", message: publish ? t.p8.pages.publishedOk : t.p8.pages.unpublishedOk };
}
