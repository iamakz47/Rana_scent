import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type {
  CreateChargeInput,
  CreatedCharge,
  CreateRefundInput,
  PaymentProvider,
  VerifiedCharge,
  VerifiedRefund,
} from "./types";

// Test-mode provider. No money moves: the "payment page" is a page on this
// site where a tester picks an outcome. Stateless, so it works across
// serverless instances: amount and order always come from the database row
// created by place_order(); only the outcome comes from the tester.
// Refused on the production deployment (see config.ts).

export type MockOutcome = "CAPTURED" | "DECLINED" | "CANCELLED";

export class MockProvider implements PaymentProvider {
  readonly name = "mock" as const;

  paymentUrlFor(chargeId: string, redirectUrl: string): string {
    const url = new URL(redirectUrl);
    url.pathname = url.pathname.replace(/\/checkout\/return$/, "/checkout/test-payment");
    url.search = "";
    url.searchParams.set("charge", chargeId);
    return url.toString();
  }

  async createCharge(input: CreateChargeInput): Promise<CreatedCharge> {
    const chargeId = `mock_${crypto.randomUUID().replaceAll("-", "")}`;
    return { chargeId, paymentUrl: this.paymentUrlFor(chargeId, input.redirectUrl) };
  }

  // Test refunds succeed immediately, except amounts ending in 13 fils,
  // which fail (to exercise the failure path).
  async createRefund(input: CreateRefundInput): Promise<VerifiedRefund> {
    const refundId = `mock_re_${crypto.randomUUID().replaceAll("-", "")}`;
    const status = input.amountFils % 1000 === 13 ? "FAILED" : "REFUNDED";
    return {
      refundId,
      chargeId: input.chargeId,
      status,
      amountFils: input.amountFils,
      currency: "KWD",
      reference: input.refundRequestId,
      raw: { mock: true, status },
    };
  }

  async retrieveRefund(refundId: string): Promise<VerifiedRefund> {
    if (!/^mock_re_[a-f0-9]{32}$/.test(refundId)) throw new Error("Invalid mock refund id");
    const { data } = await createServiceClient()
      .from("refund_requests")
      .select("id, amount_fils, provider_status")
      .eq("provider_refund_id", refundId)
      .maybeSingle();
    if (!data) throw new Error("Unknown mock refund");
    const status = data.provider_status || "REFUNDED";
    return { refundId, chargeId: null, status, amountFils: data.amount_fils, currency: "KWD", reference: data.id, raw: { mock: true } };
  }

  // Without an outcome the charge is still pending (INITIATED).
  async retrieveCharge(chargeId: string, outcome: MockOutcome | "INITIATED" = "INITIATED"): Promise<VerifiedCharge> {
    if (!/^mock_[a-f0-9]{32}$/.test(chargeId)) throw new Error("Invalid mock charge id");
    const { data, error } = await createServiceClient()
      .from("payments")
      .select("order_id, amount_fils")
      .eq("provider", "mock")
      .eq("provider_charge_id", chargeId)
      .maybeSingle();
    if (error || !data) throw new Error("Unknown mock charge");
    return {
      chargeId,
      status: outcome,
      amountFils: data.amount_fils,
      currency: "KWD",
      method: outcome === "CAPTURED" ? "knet" : null,
      reference: `MOCK-${chargeId.slice(-8)}`,
      orderId: data.order_id,
      raw: { mock: true, status: outcome },
    };
  }
}

export const mockProvider = new MockProvider();
