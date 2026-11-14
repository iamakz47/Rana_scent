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
  raw: unknown;
};

export interface PaymentProvider {
  readonly name: "tap" | "mock";
  createCharge(input: CreateChargeInput): Promise<CreatedCharge>;
  retrieveCharge(chargeId: string): Promise<VerifiedCharge>;
}
