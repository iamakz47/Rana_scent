"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { allow, clientIp } from "@/lib/rate-limit";
import { appOrigin } from "@/features/admin/auth/origin";
import { emailSchema, newPasswordSchema, passwordSchema } from "@/features/admin/auth/schemas";
import { governorates, normalizeKuwaitPhone } from "@/features/checkout/schema";
import { sendAccountEmail } from "@/features/notifications/account-email";
import { accountsEnabled } from "./config";
import { getCustomer, safeAccountPath } from "./dal";

// Customer account actions. Every response is a stable error key the form
// translates; nothing here reveals whether an email has an account.

export type FormState = { error?: string; ok?: boolean; message?: string };

function localeOf(formData: FormData): Locale {
  const value = String(formData.get("locale") ?? "");
  return isLocale(value) ? value : "ar";
}

async function confirmUrl(locale: Locale, tokenHash: string, type: "email" | "recovery", next: string) {
  const origin = await appOrigin();
  const params = new URLSearchParams({ token_hash: tokenHash, type, next });
  return `${origin}${localePath(locale, "/account/confirm")}?${params}`;
}

// Sends a one-time confirmation link. The magic-link token type confirms the
// email when it is used, so it works both for new and unconfirmed accounts.
async function sendVerification(email: string, locale: Locale, next = "/account") {
  const { data } = await createServiceClient().auth.admin.generateLink({ type: "magiclink", email });
  const hash = data?.properties?.hashed_token;
  if (hash) await sendAccountEmail("account_verification", email, locale, await confirmUrl(locale, hash, "email", next));
}

export async function register(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!accountsEnabled()) return { error: "unavailable" };
  const locale = localeOf(formData);
  const parsed = z
    .object({
      full_name: z.string().trim().min(1).max(120),
      email: emailSchema,
      password: passwordSchema,
      confirm: z.string(),
      marketing: z.boolean(),
    })
    .safeParse({
      full_name: formData.get("full_name"),
      email: formData.get("email"),
      password: formData.get("password"),
      confirm: formData.get("confirm"),
      marketing: formData.get("marketing") === "on",
    });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { error: field === "full_name" ? "name" : field === "email" ? "email" : "weak" };
  }
  if (parsed.data.password !== parsed.data.confirm) return { error: "mismatch" };

  const ip = await clientIp();
  if (!(await allow("register-ip", ip, 10, 3600)) || !(await allow("register-email", parsed.data.email, 3, 3600))) {
    return { error: "rate_limited" };
  }

  const service = createServiceClient();
  const created = await service.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: false,
    user_metadata: { full_name: parsed.data.full_name, signup: "storefront" },
  });
  if (created.data.user) {
    await service
      .from("profiles")
      .update({ full_name: parsed.data.full_name, preferred_locale: locale, marketing_opt_in: parsed.data.marketing })
      .eq("id", created.data.user.id);
    await sendVerification(parsed.data.email, locale);
  } else if (created.error?.code === "email_exists" || created.error?.status === 422) {
    // Same response as a new sign-up; the owner of the address is told instead.
    const origin = await appOrigin();
    await sendAccountEmail("account_exists", parsed.data.email, locale, `${origin}${localePath(locale, "/account/login")}`);
  } else {
    return { error: "generic" };
  }
  return { ok: true };
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!accountsEnabled()) return { error: "unavailable" };
  const locale = localeOf(formData);
  const parsed = z
    .object({ email: emailSchema, password: z.string().min(1).max(72) })
    .safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "invalid" };

  const ip = await clientIp();
  if (!(await allow("login-ip", ip, 30, 900)) || !(await allow("login-email", parsed.data.email, 8, 900))) {
    return { error: "rate_limited" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error?.code === "email_not_confirmed") {
    // Only reachable with the right password, so this reveals nothing.
    if (await allow("verify-email", parsed.data.email, 3, 3600)) await sendVerification(parsed.data.email, locale);
    return { error: "verify", message: "verifyNeeded" };
  }
  if (error || !data.user) return { error: error?.status === 429 ? "rate_limited" : "invalid" };
  if (!data.user.email_confirmed_at) {
    await supabase.auth.signOut();
    if (await allow("verify-email", parsed.data.email, 3, 3600)) await sendVerification(parsed.data.email, locale);
    return { error: "verify", message: "verifyNeeded" };
  }
  redirect(localePath(locale, safeAccountPath(String(formData.get("next") ?? ""))));
}

export async function signOut(formData: FormData): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(localePath(localeOf(formData), "/"));
}

export async function requestReset(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!accountsEnabled()) return { error: "unavailable" };
  const locale = localeOf(formData);
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return { error: "email" };
  const ip = await clientIp();
  if (!(await allow("reset-ip", ip, 10, 3600))) return { error: "rate_limited" };
  // Silently capped per address; the response is the same either way.
  if (await allow("reset-email", email.data, 3, 3600)) {
    const { data } = await createServiceClient().auth.admin.generateLink({ type: "recovery", email: email.data });
    const hash = data?.properties?.hashed_token;
    if (hash) {
      await sendAccountEmail("password_reset", email.data, locale, await confirmUrl(locale, hash, "recovery", "/account/reset-password"));
    }
  }
  return { ok: true };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) {
    return { error: parsed.error.issues.some((i) => i.message === "mismatch") ? "mismatch" : "weak" };
  }
  const customer = await getCustomer();
  if (!customer) return { error: "session" };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.code === "weak_password" ? "weak" : error.code === "reauthentication_needed" ? "session" : "generic" };
  return { ok: true, message: "passwordSaved" };
}

// ---------------------------------------------------------------------------
// Profile, addresses, deletion (all through the customer's own session: RLS
// limits every change to their own rows)
// ---------------------------------------------------------------------------

function refreshAccount(formData: FormData) {
  revalidatePath(localePath(localeOf(formData), "/account"), "layout");
}

export async function saveProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const customer = await getCustomer();
  if (!customer?.verified) return { error: "session" };
  const name = z.string().trim().min(1).max(120).safeParse(formData.get("full_name"));
  if (!name.success) return { error: "name" };
  const rawPhone = String(formData.get("phone") ?? "").trim();
  const phone = rawPhone ? normalizeKuwaitPhone(rawPhone) : null;
  if (rawPhone && !phone) return { error: "phone" };
  const lang = String(formData.get("preferred_locale") ?? "ar");
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: name.data,
      phone,
      preferred_locale: lang === "en" ? "en" : "ar",
      marketing_opt_in: formData.get("marketing_opt_in") === "on",
    })
    .eq("id", customer.id);
  if (error) return { error: "generic" };
  // No revalidation: the form already shows what was saved, and keeping it
  // mounted keeps the confirmation visible.
  return { ok: true, message: "profileSaved" };
}

const addressSchema = z.object({
  id: z.union([z.uuid(), z.literal("")]),
  label: z.string().trim().max(40),
  recipient_name: z.string().trim().min(1).max(120),
  phone: z.string(),
  governorate: z.enum(governorates),
  area: z.string().trim().min(1).max(80),
  block: z.string().trim().min(1).max(20),
  street: z.string().trim().min(1).max(80),
  avenue: z.string().trim().max(40),
  building: z.string().trim().min(1).max(40),
  floor: z.string().trim().max(10),
  apartment: z.string().trim().max(20),
  notes: z.string().trim().max(300),
});

export async function saveAddress(_prev: FormState, formData: FormData): Promise<FormState> {
  const customer = await getCustomer();
  if (!customer?.verified) return { error: "session" };
  const field = (key: string) => String(formData.get(key) ?? "");
  const parsed = addressSchema.safeParse(
    Object.fromEntries(Object.keys(addressSchema.shape).map((key) => [key, field(key === "id" ? "address_id" : key)])),
  );
  if (!parsed.success) {
    const key = parsed.error.issues[0]?.path[0];
    return { error: key === "recipient_name" ? "name" : "generic", message: String(key ?? "") };
  }
  const phone = normalizeKuwaitPhone(parsed.data.phone);
  if (!phone) return { error: "phone" };
  const { id, ...values } = parsed.data;
  const supabase = await createClient();
  const result = id
    ? await supabase.from("customer_addresses").update({ ...values, phone }).eq("id", id).select("id")
    : await supabase.from("customer_addresses").insert({ ...values, phone, user_id: customer.id }).select("id");
  if (result.error) return { error: result.error.message === "address_limit" ? "address_limit" : "generic" };
  if (!result.data?.length) return { error: "generic" };
  if (formData.get("make_default") === "on") {
    await supabase.rpc("set_default_address", { p_address: result.data[0].id });
  }
  refreshAccount(formData);
  return { ok: true, message: "addressSaved" };
}

export async function deleteAddress(_prev: FormState, formData: FormData): Promise<FormState> {
  const customer = await getCustomer();
  if (!customer?.verified) return { error: "session" };
  const id = z.uuid().safeParse(formData.get("address_id"));
  if (!id.success) return { error: "generic" };
  const supabase = await createClient();
  const { error } = await supabase.from("customer_addresses").delete().eq("id", id.data);
  if (error) return { error: "generic" };
  refreshAccount(formData);
  return { ok: true, message: "addressDeleted" };
}

export async function makeDefaultAddress(_prev: FormState, formData: FormData): Promise<FormState> {
  const customer = await getCustomer();
  if (!customer?.verified) return { error: "session" };
  const id = z.uuid().safeParse(formData.get("address_id"));
  if (!id.success) return { error: "generic" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_default_address", { p_address: id.data });
  if (error) return { error: "generic" };
  refreshAccount(formData);
  return { ok: true, message: "addressSaved" };
}

export async function requestDeletion(_prev: FormState, formData: FormData): Promise<FormState> {
  const customer = await getCustomer();
  if (!customer?.verified) return { error: "session" };
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_account_deletion", { p_reason: reason });
  if (error) return { error: error.message === "staff_account" ? "staff_account" : "generic" };
  return { ok: true, message: "deleteRequested" };
}

export async function withdrawDeletion(_prev: FormState, formData: FormData): Promise<FormState> {
  const customer = await getCustomer();
  if (!customer?.verified) return { error: "session" };
  const supabase = await createClient();
  await supabase.rpc("withdraw_account_deletion");
  refreshAccount(formData);
  return { ok: true };
}

// Links a guest order to the signed-in customer. The database requires the
// order's secret token AND the account's verified email to match the order.
export async function claimOrder(_prev: FormState, formData: FormData): Promise<FormState> {
  const customer = await getCustomer();
  if (!customer?.verified) return { error: "session" };
  const parsed = z
    .object({ n: z.coerce.number().int().positive(), t: z.uuid() })
    .safeParse({ n: formData.get("n"), t: formData.get("t") });
  if (!parsed.success) return { error: "claim" };
  if (!(await allow("claim", customer.id, 20, 3600))) return { error: "rate_limited" };
  const supabase = await createClient();
  const { data } = await supabase.rpc("claim_guest_order", { p_number: parsed.data.n, p_token: parsed.data.t });
  if (data !== true) return { error: "claim" };
  return { ok: true, message: "claimOk" };
}
