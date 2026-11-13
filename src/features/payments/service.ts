import "server-only";
import { localePath, type Locale } from "@/i18n/config";
import { formatKWD } from "@/lib/money";
import { createServiceClient } from "@/lib/supabase/service";
import { sendOrderEmail } from "@/features/notifications/email";
import { appOrigin } from "@/features/admin/auth/origin";
import { getPaymentsConfig } from "./config";
import { mockProvider, type MockOutcome } from "./mock";
import { TapProvider } from "./tap";
import type { PaymentProvider, VerifiedCharge } from "./types";

export function getProvider(): PaymentProvider | null {
  const config = getPaymentsConfig();
  if (config.kind === "tap") return new TapProvider(config.secretKey, config.sourceId, config.apiBase);
  if (config.kind === "mock") return mockProvider;
  return null;
}

type StartResult = { ok: true; paymentUrl: string } | { ok: false; reason: "unavailable" | "provider_error" };

// Creates the provider charge for an order placed by place_order() and
// attaches it to the order's open payment. Amount and order come from the
// database, never from the browser.
export async function startPayment(orderId: string, locale: Locale): Promise<StartResult> {
  const provider = getProvider();
  if (!provider) return { ok: false, reason: "unavailable" };
  const db = createServiceClient();
  const { data: order } = await db
    .from("orders")
    .select("id, number, total_fils, customer_name, phone, email, status, payment_method")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.status !== "awaiting_payment" || order.payment_method !== "tap") {
    return { ok: false, reason: "unavailable" };
  }
  const origin = await appOrigin();
  try {
    const charge = await provider.createCharge({
      orderId: order.id,
      orderNumber: order.number,
      amountFils: order.total_fils,
      customer: { name: order.customer_name, phone: order.phone, email: order.email },
      locale,
      redirectUrl: `${origin}${localePath(locale, "/checkout/return")}`,
      webhookUrl: `${origin}/api/payments/tap/webhook`,
    });
    const { error } = await db.rpc("attach_payment_charge", {
      p_order: order.id,
      p_provider: provider.name,
      p_charge_id: charge.chargeId,
    });
    if (error) return { ok: false, reason: "provider_error" };
    return { ok: true, paymentUrl: charge.paymentUrl };
  } catch {
    return { ok: false, reason: "provider_error" };
  }
}

export type ConfirmResult = { outcome: string; orderNumber: number | null; token: string | null; locale: Locale };

// Records a charge result the server obtained from the provider itself.
// Event id = charge + status, so repeated webhooks/redirects are no-ops.
export async function recordVerifiedCharge(
  provider: "tap" | "mock",
  charge: VerifiedCharge,
  signatureValid: boolean,
): Promise<ConfirmResult> {
  const db = createServiceClient();
  const { data: outcome, error } = await db.rpc("record_payment_result", {
    p_provider: provider,
    p_event_id: `${charge.chargeId}:${charge.status}`,
    p_charge_id: charge.chargeId,
    p_status: charge.status,
    p_amount_fils: charge.amountFils,
    p_currency: charge.currency,
    p_method: charge.method ?? "",
    p_reference: charge.reference ?? "",
    p_signature_valid: signatureValid,
    p_payload: charge.raw as never,
  });
  const { data: payment } = await db
    .from("payments")
    .select("orders(number, access_token, locale, email, total_fils, status)")
    .eq("provider", provider)
    .eq("provider_charge_id", charge.chargeId)
    .maybeSingle();
  const order = payment?.orders ?? null;
  const locale: Locale = order?.locale === "en" ? "en" : "ar";

  if (!error && outcome === "captured" && order?.email) {
    const origin = await appOrigin();
    await sendOrderEmail({
      to: order.email,
      locale,
      orderNumber: order.number,
      totalLabel: formatKWD(order.total_fils, locale),
      statusLabel: locale === "ar" ? "تم الدفع" : "Paid",
      orderUrl: `${origin}${localePath(locale, `/order/${order.number}`)}?t=${order.access_token}`,
    });
  }
  return { outcome: error ? "error" : String(outcome), orderNumber: order?.number ?? null, token: order?.access_token ?? null, locale };
}

// Called on the customer's return from the payment page: re-checks the
// charge with the provider (the redirect itself proves nothing).
export async function confirmReturn(chargeId: string): Promise<ConfirmResult | null> {
  const provider = getProvider();
  if (!provider || provider.name !== "tap") return null;
  try {
    const charge = await provider.retrieveCharge(chargeId);
    return await recordVerifiedCharge("tap", charge, true);
  } catch {
    return null;
  }
}

// Test mode only: applies the tester's chosen outcome.
export async function confirmMockOutcome(chargeId: string, outcome: MockOutcome): Promise<ConfirmResult | null> {
  if (getPaymentsConfig().kind !== "mock") return null;
  const charge = await mockProvider.retrieveCharge(chargeId, outcome);
  return recordVerifiedCharge("mock", charge, true);
}
