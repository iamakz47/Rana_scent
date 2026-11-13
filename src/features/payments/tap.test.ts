import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { filsToKwdAmount, formatAmountForHash, kwdAmountToFils } from "./amount";
import { TapProvider, tapHashString, verifyTapWebhook } from "./tap";

const charge = {
  id: "chg_TS0123456789",
  status: "CAPTURED",
  amount: 31,
  currency: "KWD",
  created: "1700000000000",
  reference: { gateway: "GW123", payment: "PAY456" },
  transaction: { created: "1700000000000" },
};

describe("amount conversion", () => {
  it("converts fils and KWD exactly", () => {
    expect(filsToKwdAmount(31000)).toBe(31);
    expect(filsToKwdAmount(14500)).toBe(14.5);
    expect(kwdAmountToFils(14.5)).toBe(14500);
    expect(kwdAmountToFils("0.005")).toBe(5);
    expect(kwdAmountToFils(0.1 + 0.2)).toBe(300);
    expect(formatAmountForHash(31000)).toBe("31.000");
    expect(() => kwdAmountToFils("-1")).toThrow();
    expect(() => filsToKwdAmount(1.5)).toThrow();
  });
});

describe("Tap webhook signature", () => {
  const secret = "sk_test_example";
  const valid = createHmac("sha256", secret).update(tapHashString(charge)).digest("hex");

  it("builds the documented field string", () => {
    expect(tapHashString(charge)).toBe(
      "x_idchg_TS0123456789x_amount31.000x_currencyKWDx_gateway_referenceGW123x_payment_referencePAY456x_statusCAPTUREDx_created1700000000000",
    );
  });

  it("accepts the right signature and rejects anything else", () => {
    expect(verifyTapWebhook(charge, valid, secret)).toBe(true);
    expect(verifyTapWebhook(charge, valid.toUpperCase(), secret)).toBe(true);
    expect(verifyTapWebhook({ ...charge, amount: 1 }, valid, secret)).toBe(false);
    expect(verifyTapWebhook({ ...charge, status: "DECLINED" }, valid, secret)).toBe(false);
    expect(verifyTapWebhook(charge, valid, "sk_test_other")).toBe(false);
    expect(verifyTapWebhook(charge, null, secret)).toBe(false);
    expect(verifyTapWebhook(null, valid, secret)).toBe(false);
  });
});

describe("Tap provider", () => {
  it("creates a hosted charge with the server amount and never leaks the key", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: "chg_ABC", status: "INITIATED", amount: 31, currency: "KWD", transaction: { url: "https://pay.tap/x" } })),
    );
    const tap = new TapProvider("sk_test_secret", "src_all", "https://api.tap.company/v2", fetchMock as never);
    const result = await tap.createCharge({
      orderId: "11111111-1111-1111-1111-111111111111",
      orderNumber: 1001,
      amountFils: 31000,
      customer: { name: "Mona Al Ahmad", phone: "+96555123456", email: "" },
      locale: "ar",
      redirectUrl: "https://ranascent.vercel.app/ar/checkout/return",
      webhookUrl: "https://ranascent.vercel.app/api/payments/tap/webhook",
    });
    expect(result).toEqual({ chargeId: "chg_ABC", paymentUrl: "https://pay.tap/x" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.tap.company/v2/charges");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ amount: 31, currency: "KWD", source: { id: "src_all" }, threeDSecure: true });
    expect(body.customer.phone).toEqual({ country_code: "965", number: "55123456" });
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk_test_secret");
  });

  it("reads status and amount from Tap and reports errors without details", async () => {
    const ok = vi.fn(async () =>
      new Response(JSON.stringify({ ...charge, source: { payment_method: "KNET" }, metadata: { order_id: "o1" } })),
    );
    const tap = new TapProvider("sk_test_secret", "src_all", "https://api.tap.company/v2", ok as never);
    await expect(tap.retrieveCharge("chg_TS0123456789")).resolves.toMatchObject({
      status: "CAPTURED",
      amountFils: 31000,
      method: "knet",
      orderId: "o1",
    });
    await expect(tap.retrieveCharge("../../etc")).rejects.toThrow("Invalid charge id");
    const failing = new TapProvider("sk_test_secret", "src_all", "https://x", (async () => new Response("no", { status: 401 })) as never);
    await expect(failing.retrieveCharge("chg_X1")).rejects.toThrow("failed with 401");
  });
});
