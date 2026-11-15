import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isLocale, localePath } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { safeAccountPath } from "@/features/account/dal";

const types = new Set<EmailOtpType>(["email", "magiclink", "recovery", "signup"]);

// Landing point for customer verification and password-reset links. The
// one-time token is exchanged for a session; then the customer continues to
// an account path on this site (never an external URL).
export async function GET(request: NextRequest, context: RouteContext<"/[lang]/account/confirm">) {
  const { lang } = await context.params;
  const locale = isLocale(lang) ? lang : "ar";
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeAccountPath(url.searchParams.get("next"));

  let ok = false;
  if (tokenHash && /^[A-Za-z0-9_-]{10,200}$/.test(tokenHash) && type && types.has(type)) {
    const supabase = await createClient();
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }
  if (!ok) return NextResponse.redirect(new URL(localePath(locale, "/account/login?error=link_invalid"), url.origin));
  const target = new URL(localePath(locale, next), url.origin);
  if (type !== "recovery") target.searchParams.set("welcome", "1");
  return NextResponse.redirect(target);
}
