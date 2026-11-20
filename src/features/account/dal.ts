import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { localePath, type Locale } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";

export type Customer = { id: string; email: string; verified: boolean };

// The signed-in user, verified with Supabase Auth (getUser re-checks the
// token with the server, so a forged cookie isn't trusted).
export const getCustomer = cache(async (): Promise<Customer | null> => {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return { id: data.user.id, email: data.user.email ?? "", verified: Boolean(data.user.email_confirmed_at) };
});

export async function requireCustomer(locale: Locale, next: string): Promise<Customer> {
  const customer = await getCustomer();
  if (!customer || !customer.verified) redirect(localePath(locale, `/account/login?next=${encodeURIComponent(next)}`));
  return customer;
}

// Only same-site account/order paths are allowed after sign-in.
export function safeAccountPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/account";
  return /^\/(account|checkout|order|cart)(\/|\?|$)/.test(value) ? value : "/account";
}
