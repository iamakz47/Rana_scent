// Provider-neutral payment types.

export type ChargeStatus = string; // Provider status, e.g. CAPTURED, DECLINED, CANCELLED.

export type CreateChargeInput = {
  orderId: string;
  orderNumber: number;
  amountFils: number;
  customer: { name: string; phone: string; email: string };
  locale: "ar" | "en";
  redirectUrl: string;
  webhookUrl: string;
};

export type CreatedCharge = { chargeId: string; paymentUrl: string };

// What the server learned from the provider itself (never from the browser).
export type VerifiedCharge = {
  chargeId: string;
  status: ChargeStatus;
  amountFils: number;
  currency: string;
  method: string | null;
  reference: string | null;
  orderId: string | null;
  // Hosted payment page, while the charge can still be paid.
  paymentUrl?: string | null;
  raw: unknown;
};

export type CreateRefundInput = {
  refundRequestId: string;
  chargeId: string;
  amountFils: number;
  reason: string;
  orderNumber: number;
  webhookUrl: string;
};

// A refund as reported by the provider (re-fetched, never from a webhook body).
export type VerifiedRefund = {
  refundId: string;
  chargeId: string | null;
  status: string; // e.g. PENDING, REFUNDED, FAILED
  amountFils: number;
  currency: string;
  reference: string | null; // our refund request id, when echoed back
  raw: unknown;
};

export interface PaymentProvider {
  readonly name: "tap" | "mock";
  createCharge(input: CreateChargeInput): Promise<CreatedCharge>;
  retrieveCharge(chargeId: string): Promise<VerifiedCharge>;
  createRefund(input: CreateRefundInput): Promise<VerifiedRefund>;
  retrieveRefund(refundId: string): Promise<VerifiedRefund>;
}
