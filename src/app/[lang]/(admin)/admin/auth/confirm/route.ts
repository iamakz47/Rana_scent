import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isLocale, localePath } from "@/i18n/config";
import { safeAdminPath } from "@/features/admin/auth/permissions";
import { createClient } from "@/lib/supabase/server";

const otpTypes = new Set<EmailOtpType>(["recovery", "invite", "email", "magiclink", "signup", "email_change"]);

// Landing point for password-recovery and invitation emails. Supports both the
// PKCE `code` flow and the `token_hash` email-template flow, then sends the
// user on to an admin path (never an external URL).
export async function GET(request: NextRequest, context: RouteContext<"/[lang]/admin/auth/confirm">) {
  const { lang } = await context.params;
  const locale = isLocale(lang) ? lang : "ar";
  const url = request.nextUrl;
  const next = safeAdminPath(url.searchParams.get("next") ?? "/admin/reset-password");
  const fail = new URL(localePath(locale, "/admin/login?error=link_invalid"), url.origin);

  const supabase = await createClient();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type && otpTypes.has(type)) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  if (!ok) return NextResponse.redirect(fail);
  return NextResponse.redirect(new URL(localePath(locale, next), url.origin));
}
