import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type { CreateChargeInput, CreatedCharge, PaymentProvider, VerifiedCharge } from "./types";

// Test-mode provider. No money moves: the "payment page" is a page on this
// site where a tester picks an outcome. Stateless, so it works across
// serverless instances: amount and order always come from the database row
// created by place_order(); only the outcome comes from the tester.
// Refused on the production deployment (see config.ts).

export type MockOutcome = "CAPTURED" | "DECLINED" | "CANCELLED";

export class MockProvider implements PaymentProvider {
  readonly name = "mock" as const;

  async createCharge(input: CreateChargeInput): Promise<CreatedCharge> {
    const chargeId = `mock_${crypto.randomUUID().replaceAll("-", "")}`;
    const url = new URL(input.redirectUrl);
    url.pathname = url.pathname.replace(/\/checkout\/return$/, "/checkout/test-payment");
    url.search = "";
    url.searchParams.set("charge", chargeId);
    return { chargeId, paymentUrl: url.toString() };
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
