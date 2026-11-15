import { createHmac, timingSafeEqual } from "node:crypto";
import { filsToKwdAmount, formatAmountForHash, kwdAmountToFils } from "./amount";
import type {
  CreateChargeInput,
  CreatedCharge,
  CreateRefundInput,
  PaymentProvider,
  VerifiedCharge,
  VerifiedRefund,
} from "./types";

// Tap Payments (https://tap.company) via the Charges and Refunds APIs and
// Tap's hosted payment page. The secret key is used only on the server.
//
// VERIFY BEFORE GOING LIVE: the official documentation
// (developers.tap.company) could not be reached from the build environment
// during Phase 4, so the request/response field names below follow Tap's
// published v2 API as previously documented and MUST be confirmed with a
// sandbox charge, a sandbox refund and a test webhook. Safety does not depend
// on them: every result is re-fetched from Tap with the secret key, amounts
// and currency are compared with the database, and unknown statuses are
// treated as "not paid" / "not refunded".

type TapRefund = {
  id: string;
  status: string;
  amount: number | string;
  currency: string;
  charge_id?: string;
  reference?: { merchant?: string };
  metadata?: Record<string, string>;
};

type TapCharge = {
  id: string;
  status: string;
  amount: number | string;
  currency: string;
  created?: string | number;
  reference?: { gateway?: string; payment?: string; order?: string; transaction?: string };
  source?: { payment_method?: string; id?: string };
  metadata?: Record<string, string>;
  transaction?: { url?: string; created?: string | number };
};

// status = the HTTP status when Tap answered, null when the request never got
// an answer (timeout, network). Only a 4xx is a definitive "not done".
export class ProviderRequestError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
  }
}

export class TapProvider implements PaymentProvider {
  readonly name = "tap" as const;

  constructor(
    private readonly secretKey: string,
    private readonly sourceId: string,
    private readonly apiBase: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.apiBase}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new ProviderRequestError(`Tap ${method} ${path.split("/")[1]} got no response`, null);
    }
    const text = await res.text();
    if (!res.ok) {
      // Never include the request (it carries customer data) or headers.
      throw new ProviderRequestError(`Tap ${method} ${path.split("/")[1]} failed with ${res.status}`, res.status);
    }
    return JSON.parse(text) as T;
  }

  async createCharge(input: CreateChargeInput): Promise<CreatedCharge> {
    const [firstName, ...rest] = input.customer.name.trim().split(/\s+/);
    const charge = await this.request<TapCharge>("POST", "/charges", {
      amount: filsToKwdAmount(input.amountFils),
      currency: "KWD",
      threeDSecure: true,
      save_card: false,
      description: `Rana Scent order #${input.orderNumber}`,
      statement_descriptor: "Rana Scent",
      metadata: { order_id: input.orderId, order_number: String(input.orderNumber) },
      reference: { transaction: input.orderId, order: String(input.orderNumber) },
      receipt: { email: Boolean(input.customer.email), sms: true },
      customer: {
        first_name: firstName || "Customer",
        last_name: rest.join(" ") || undefined,
        email: input.customer.email || undefined,
        phone: { country_code: "965", number: input.customer.phone.replace(/^\+965/, "") },
      },
      source: { id: this.sourceId },
      post: { url: input.webhookUrl },
      redirect: { url: input.redirectUrl },
      lang_code: input.locale === "ar" ? "ar" : "en",
    });
    if (!charge.id || !charge.transaction?.url) throw new Error("Tap did not return a payment URL");
    return { chargeId: charge.id, paymentUrl: charge.transaction.url };
  }

  async retrieveCharge(chargeId: string): Promise<VerifiedCharge> {
    if (!/^chg_[A-Za-z0-9]+$/.test(chargeId)) throw new Error("Invalid charge id");
    const charge = await this.request<TapCharge>("GET", `/charges/${chargeId}`);
    return {
      chargeId: charge.id,
      status: String(charge.status ?? "").toUpperCase(),
      amountFils: kwdAmountToFils(charge.amount),
      currency: String(charge.currency ?? "").toUpperCase(),
      method: charge.source?.payment_method ? charge.source.payment_method.toLowerCase() : null,
      reference: charge.reference?.payment ?? charge.reference?.gateway ?? null,
      orderId: charge.metadata?.order_id ?? charge.reference?.transaction ?? null,
      paymentUrl: charge.transaction?.url ?? null,
      raw: { id: charge.id, status: charge.status, amount: charge.amount, currency: charge.currency, reference: charge.reference },
    };
  }

  async createRefund(input: CreateRefundInput): Promise<VerifiedRefund> {
    if (!/^chg_[A-Za-z0-9]+$/.test(input.chargeId)) throw new Error("Invalid charge id");
    const refund = await this.request<TapRefund>("POST", "/refunds", {
      charge_id: input.chargeId,
      amount: filsToKwdAmount(input.amountFils),
      currency: "KWD",
      reason: input.reason.slice(0, 250) || "requested_by_customer",
      reference: { merchant: input.refundRequestId },
      metadata: { refund_request_id: input.refundRequestId, order_number: String(input.orderNumber) },
      post: { url: input.webhookUrl },
    });
    return mapRefund(refund);
  }

  async retrieveRefund(refundId: string): Promise<VerifiedRefund> {
    if (!/^re_[A-Za-z0-9]+$/.test(refundId)) throw new Error("Invalid refund id");
    return mapRefund(await this.request<TapRefund>("GET", `/refunds/${refundId}`));
  }
}

function mapRefund(refund: TapRefund): VerifiedRefund {
  if (!refund?.id) throw new Error("Tap did not return a refund");
  return {
    refundId: refund.id,
    chargeId: refund.charge_id ?? null,
    status: String(refund.status ?? "").toUpperCase(),
    amountFils: kwdAmountToFils(refund.amount),
    currency: String(refund.currency ?? "").toUpperCase(),
    reference: refund.metadata?.refund_request_id ?? refund.reference?.merchant ?? null,
    raw: { id: refund.id, status: refund.status, amount: refund.amount, currency: refund.currency, charge_id: refund.charge_id },
  };
}

// Webhook authenticity: Tap signs charge webhooks with an HMAC-SHA256
// "hashstring" header over selected charge fields, keyed with the secret key.
// Confirm the exact field list against a test webhook from the Tap dashboard
// before going live. Whatever the result, the webhook handler re-fetches the
// charge from Tap with the secret key, so the order status always comes from
// an authenticated server-to-server call.
export function tapHashString(charge: TapCharge): string {
  const amountFils = kwdAmountToFils(charge.amount);
  const created = charge.transaction?.created ?? charge.created ?? "";
  return (
    `x_id${charge.id}` +
    `x_amount${formatAmountForHash(amountFils)}` +
    `x_currency${charge.currency}` +
    `x_gateway_reference${charge.reference?.gateway ?? ""}` +
    `x_payment_reference${charge.reference?.payment ?? ""}` +
    `x_status${charge.status}` +
    `x_created${created}`
  );
}

export function verifyTapWebhook(body: unknown, signature: string | null, secretKey: string): boolean {
  if (!signature || !body || typeof body !== "object") return false;
  try {
    const expected = createHmac("sha256", secretKey).update(tapHashString(body as TapCharge)).digest("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature.trim().toLowerCase(), "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
