"use server";

import { redirect } from "next/navigation";
import { localePath } from "@/i18n/config";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { actionLocale } from "@/features/admin/action-locale";
import { appOrigin } from "./origin";
import { safeAdminPath } from "./permissions";
import { emailSchema, newPasswordSchema, signInSchema } from "./schemas";

export type AuthFormState = { error?: string; ok?: boolean };

function authErrorCode(error: { status?: number; code?: string } | null): string {
  if (!error) return "generic";
  if (error.status === 429 || error.code === "over_request_rate_limit") return "rate_limited";
  return "invalid";
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return { error: "unconfigured" };
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !data.user) return { error: authErrorCode(error) };

  // Signing in is not enough: the account must be active staff. The same
  // message is used for wrong passwords and non-staff so the form never
  // reveals which emails have accounts.
  const { data: member } = await supabase
    .from("staff_members")
    .select("is_active")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (!member?.is_active) {
    await supabase.auth.signOut();
    return { error: "invalid" };
  }

  redirect(localePath(actionLocale(formData), safeAdminPath(parsed.data.next)));
}

export async function signOut(formData: FormData): Promise<void> {
  const locale = actionLocale(formData);
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect(localePath(locale, "/admin/login"));
}

export async function requestPasswordReset(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return { error: "unconfigured" };
  const email = emailSchema.safeParse(formData.get("email"));
  // Always report success so the form can't be used to discover accounts.
  if (!email.success) return { ok: true };

  const locale = actionLocale(formData);
  const supabase = await createClient();
  const next = encodeURIComponent("/admin/reset-password");
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${await appOrigin()}${localePath(locale, "/admin/auth/confirm")}?next=${next}`,
  });
  if (error?.status === 429) return { error: "rate_limited" };
  return { ok: true };
}

export async function updatePassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return { error: "unconfigured" };
  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    const mismatch = parsed.error.issues.some((issue) => issue.message === "mismatch");
    return { error: mismatch ? "mismatch" : "weak" };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return { error: "session" };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.code === "weak_password" ? "weak" : authErrorCode(error) };
  return { ok: true };
}
