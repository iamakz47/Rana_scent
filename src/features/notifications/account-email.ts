import "server-only";
import type { Locale } from "@/i18n/config";
import { createServiceClient } from "@/lib/supabase/service";
import { renderEmail } from "./templates";
import { transportFor } from "./transport";

// Account emails (verification, password reset, "you already have an
// account") are sent right away, because they carry a one-time secret link
// that must not be stored. Each attempt is logged in the email history
// WITHOUT the link.
export async function sendAccountEmail(
  kind: "account_verification" | "password_reset" | "account_exists",
  to: string,
  locale: Locale,
  actionUrl: string,
): Promise<boolean> {
  const email = renderEmail(kind, { locale, actionUrl });
  const transport = transportFor(to);
  const result = transport
    ? await transport.send({ to, ...email, idempotencyKey: crypto.randomUUID() })
    : ({ ok: true, provider: "suppressed", messageId: "" } as const);
  try {
    await createServiceClient().rpc("log_account_email", {
      p_kind: kind,
      p_to: to,
      p_locale: locale,
      p_ok: result.ok,
      p_provider: result.provider,
      p_provider_message_id: result.ok ? result.messageId : "",
      p_error: result.ok ? "" : result.error,
    });
  } catch {
    // Logging must never block the account flow.
  }
  return result.ok;
}
