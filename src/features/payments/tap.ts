import { createHmac, timingSafeEqual } from "node:crypto";
import { filsToKwdAmount, formatAmountForHash, kwdAmountToFils } from "./amount";
import type { CreateChargeInput, CreatedCharge, PaymentProvider, VerifiedCharge } from "./types";

// Tap Payments (https://tap.company) via the Charges API and Tap's hosted
// payment page. The secret key is used only on the server.

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

export class TapProvider implements PaymentProvider {
  readonly name = "tap" as const;

  constructor(
    private readonly secretKey: string,
    private readonly sourceId: string,
    private readonly apiBase: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const res = await this.fetchImpl(`${this.apiBase}${path}`, {
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
    const text = await res.text();
    if (!res.ok) {
      // Never include the request (it carries customer data) or headers.
      throw new Error(`Tap ${method} ${path.split("/")[1]} failed with ${res.status}`);
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
      raw: { id: charge.id, status: charge.status, amount: charge.amount, currency: charge.currency, reference: charge.reference },
    };
  }
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
