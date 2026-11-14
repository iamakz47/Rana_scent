"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { localePath } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { actionDictionary, actionLocale, dbErrorMessage } from "@/features/admin/action-locale";
import { authorize } from "@/features/admin/auth/dal";
import { parseKwdToFils } from "@/features/admin/format";
import type { ActionResult } from "@/features/admin/ui/form";

const categories = ["inventory", "shipping", "marketing", "packaging", "software", "fees", "salaries", "rent", "other"] as const;

export async function addExpense(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = actionDictionary(formData);
  if (!(await authorize("finance.write"))) return { status: "error", message: t.common.noPermissionAction };
  const amount = parseKwdToFils(formData.get("amount"));
  const parsed = z
    .object({
      category: z.enum(categories),
      description: z.string().trim().min(1).max(300),
      vendor: z.string().trim().max(120),
      incurred_on: z.iso.date(),
    })
    .safeParse({
      category: formData.get("category"),
      description: formData.get("description"),
      vendor: formData.get("vendor") ?? "",
      incurred_on: formData.get("incurred_on"),
    });
  if (!parsed.success || amount === null || amount <= 0) return { status: "error", message: t.common.error };
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({ ...parsed.data, amount_fils: amount });
  if (error) return { status: "error", message: dbErrorMessage(error, t) };
  revalidatePath(localePath(actionLocale(formData), "/admin/finance"));
  return { status: "ok", message: t.commerce.finance.expenseSaved };
}
