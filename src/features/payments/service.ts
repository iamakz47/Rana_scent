import "server-only";
import { localePath, type Locale } from "@/i18n/config";
import { createServiceClient } from "@/lib/supabase/service";
import { appOrigin } from "@/features/admin/auth/origin";
import { dispatchEmails, scheduleEmailDispatch } from "@/features/notifications/dispatch";
import { getPaymentsConfig } from "./config";
import { mockProvider, type MockOutcome } from "./mock";
import { ProviderRequestError, TapProvider } from "./tap";
import type { PaymentProvider, VerifiedCharge, VerifiedRefund } from "./types";

export function getProvider(): PaymentProvider | null {
  const config = getPaymentsConfig();
  if (config.kind === "tap") return new TapProvider(config.secretKey, config.sourceId, config.apiBase);
  if (config.kind === "mock") return mockProvider;
  return null;
}

function providerFor(name: string): PaymentProvider | null {
  const provider = getProvider();
  return provider && provider.name === name ? provider : null;
}

type StartResult = { ok: true; paymentUrl: string } | { ok: false; reason: "unavailable" | "provider_error" };

// Creates the provider charge for an order placed by place_order() and
// attaches it to the order's open payment. Amount and order come from the
// database, never from the browser. A second submit of the same checkout
// (double click, refresh, back button) reuses the charge already created.
export async function startPayment(orderId: string, locale: Locale): Promise<StartResult> {
  const provider = getProvider();
  if (!provider) return { ok: false, reason: "unavailable" };
  const db = createServiceClient();
  const { data: order } = await db
    .from("orders")
    .select("id, number, total_fils, customer_name, phone, email, status, payment_method, payments(provider, provider_charge_id, status)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.status !== "awaiting_payment" || order.payment_method !== "tap") {
    return { ok: false, reason: "unavailable" };
  }
  const origin = await appOrigin();
  const redirectUrl = `${origin}${localePath(locale, "/checkout/return")}`;

  const open = (order.payments ?? []).find((p) => p.status === "initiated" && p.provider_charge_id);
  if (open?.provider_charge_id) {
    if (open.provider !== provider.name) return { ok: false, reason: "unavailable" };
    if (provider.name === "mock") return { ok: true, paymentUrl: mockProvider.paymentUrlFor(open.provider_charge_id, redirectUrl) };
    try {
      const charge = await provider.retrieveCharge(open.provider_charge_id);
      if (charge.paymentUrl && ["INITIATED", "IN_PROGRESS"].includes(charge.status)) {
        return { ok: true, paymentUrl: charge.paymentUrl };
      }
      // Already settled: record it and let the customer see the order.
      await recordVerifiedCharge(provider.name, charge, true);
    } catch {
      // Fall through to the generic error; nothing was changed.
    }
    return { ok: false, reason: "provider_error" };
  }

  try {
    const charge = await provider.createCharge({
      orderId: order.id,
      orderNumber: order.number,
      amountFils: order.total_fils,
      customer: { name: order.customer_name, phone: order.phone, email: order.email },
      locale,
      redirectUrl,
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
    // No payment page was shown, so nothing can be paid: release the stock now.
    await db.rpc("abandon_unstarted_payment", { p_order: order.id });
    scheduleEmailDispatch();
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
    .select("orders(number, access_token, locale)")
    .eq("provider", provider)
    .eq("provider_charge_id", charge.chargeId)
    .maybeSingle();
  const order = payment?.orders ?? null;
  const locale: Locale = order?.locale === "en" ? "en" : "ar";
  // Emails were queued by the database in the same transaction.
  scheduleEmailDispatch();
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

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

export type Approval = {
  refund_id: string;
  provider: "tap" | "mock";
  charge_id: string;
  amount_fils: number;
  reason: string;
  order_number: number;
};

async function recordRefund(requestId: string, refund: VerifiedRefund | null, status: string, error = "") {
  const { data } = await createServiceClient().rpc("record_refund_result", {
    p_request: requestId,
    p_provider_refund_id: refund?.refundId ?? "",
    p_status: status,
    p_amount_fils: refund?.amountFils ?? 0,
    p_currency: refund?.currency ?? "",
    p_error: error,
  });
  scheduleEmailDispatch();
  return String(data ?? "error");
}

// Sends an approved refund to the provider. approve_refund() (run with the
// staff member's own session, so the database checks finance.write) has
// already moved the request to 'processing' exactly once.
//   * Provider answered: the result is recorded (processed / pending / failed).
//   * Provider rejected the request (4xx): recorded as failed; nothing was refunded.
//   * No answer (timeout/network): the refund MAY exist at the provider, so the
//     request stays 'processing' and staff are asked to check the provider
//     dashboard. It is never retried automatically, so it can't be sent twice.
export async function sendApprovedRefund(approval: Approval): Promise<"processed" | "pending" | "failed" | "unknown"> {
  const provider = providerFor(approval.provider);
  if (!provider) return "unknown";
  const origin = await appOrigin();
  try {
    const refund = await provider.createRefund({
      refundRequestId: approval.refund_id,
      chargeId: approval.charge_id,
      amountFils: approval.amount_fils,
      reason: approval.reason,
      orderNumber: approval.order_number,
      webhookUrl: `${origin}/api/payments/tap/webhook`,
    });
    const outcome = await recordRefund(approval.refund_id, refund, refund.status);
    return outcome === "processed" ? "processed" : outcome === "failed" ? "failed" : "pending";
  } catch (error) {
    if (error instanceof ProviderRequestError && error.status !== null && error.status >= 400 && error.status < 500) {
      await recordRefund(approval.refund_id, null, "FAILED", error.message);
      return "failed";
    }
    const db = createServiceClient();
    await db.from("refund_requests").update({ last_error: "No answer from the payment provider: check its dashboard before resolving." }).eq("id", approval.refund_id);
    return "unknown";
  }
}

// Provider refund notification (webhook): re-fetch and record.
export async function recordRefundById(provider: "tap" | "mock", refundId: string): Promise<string> {
  const p = providerFor(provider);
  if (!p) return "unavailable";
  const refund = await p.retrieveRefund(refundId);
  const db = createServiceClient();
  const { data: request } = await db.from("refund_requests").select("id").eq("provider_refund_id", refund.refundId).maybeSingle();
  const requestId = request?.id ?? (refund.reference && /^[0-9a-f-]{36}$/.test(refund.reference) ? refund.reference : null);
  if (!requestId) return "unknown_refund";
  return recordRefund(requestId, refund, refund.status);
}

// ---------------------------------------------------------------------------
// Reconciliation: catches webhooks that never arrived
// ---------------------------------------------------------------------------

export async function reconcilePayments(minAgeSeconds = 120): Promise<Record<string, number>> {
  const counts: Record<string, number> = { charges: 0, refunds: 0, errors: 0, expired: 0 };
  const db = createServiceClient();
  const { data: rows } = await db.rpc("payments_to_reconcile", { p_min_age_seconds: minAgeSeconds, p_limit: 50 });
  for (const row of (rows ?? []) as Array<{ kind: string; provider: string; provider_id: string; refund_id: string | null }>) {
    const provider = providerFor(row.provider);
    if (!provider) continue;
    try {
      if (row.kind === "charge") {
        // Mock charges have no provider-side state to re-check.
        if (provider.name === "mock") continue;
        const charge = await provider.retrieveCharge(row.provider_id);
        await recordVerifiedCharge(provider.name, charge, true);
        counts.charges++;
      } else if (row.refund_id) {
        const refund = await provider.retrieveRefund(row.provider_id);
        await recordRefund(row.refund_id, refund, refund.status);
        counts.refunds++;
      }
    } catch {
      counts.errors++;
    }
  }
  // Only after re-checking: cancel what is still unpaid past its window.
  const { data: expired } = await db.rpc("expire_unpaid_orders");
  counts.expired = Number(expired ?? 0);
  const emails = await dispatchEmails(50);
  counts.emailsSent = emails.sent;
  counts.emailsFailed = emails.failed;
  return counts;
}
