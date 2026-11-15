import { describe, expect, it } from "vitest";
import { accountKinds, customerKinds, renderEmail, staffKinds, type EmailOrder } from "./templates";
import { recipientAllowed } from "./transport";

const order: EmailOrder = {
  number: 1042,
  customerName: "Sara <script>alert(1)</script> Ali",
  phone: "+96555123456",
  paymentMethod: "tap",
  paymentLabel: "KNET",
  subtotalFils: 29000,
  discountFils: 2900,
  shippingFils: 2000,
  totalFils: 28100,
  refundedFils: 0,
  items: [{ name: "Rana Aura", label: "Champagne", quantity: 1, lineTotalFils: 29000 }],
  address: { governorate: "hawalli", area: "Salmiya", block: "10", street: "Salem Al Mubarak", building: "12" },
};
const orderUrl = "https://ranascent.example/en/order?n=1042&t=00000000-0000-4000-8000-000000000000";

describe("email templates", () => {
  it("renders every kind in both languages with a subject, html and text", () => {
    for (const kind of [...customerKinds, ...staffKinds, ...accountKinds]) {
      for (const locale of ["ar", "en"] as const) {
        const email = renderEmail(kind, {
          locale, order, orderUrl, adminUrl: "https://ranascent.example/admin", actionUrl: "https://ranascent.example/x",
          refundFils: 5000, reason: "Damaged", storeUrl: "https://ranascent.example/cart",
          stock: { sku: "RS-1", name: "Aura", onHand: 2, threshold: 5 },
        });
        expect(email.subject.length, `${kind}/${locale}`).toBeGreaterThan(5);
        expect(email.html).toContain(`dir="${locale === "ar" ? "rtl" : "ltr"}"`);
        expect(email.text.length).toBeGreaterThan(20);
      }
    }
  });

  it("shows accurate KWD totals with three decimals", () => {
    const email = renderEmail("payment_succeeded", { locale: "en", order, orderUrl });
    expect(email.html).toContain("28.100");
    expect(email.html).toContain("2.900");
    expect(email.text).toContain("28.100");
    expect(email.html).toContain("KNET");
  });

  it("escapes customer-supplied text", () => {
    const email = renderEmail("staff_new_cod_order", { locale: "en", order });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });

  it("links only to http(s) URLs", () => {
    const email = renderEmail("password_reset", { locale: "en", actionUrl: "javascript:alert(1)" });
    expect(email.html).not.toContain("javascript:");
  });

  it("includes the secure order link and never card data", () => {
    const email = renderEmail("order_delivered", { locale: "ar", order, orderUrl });
    expect(email.html).toContain("order?n=1042&amp;t=");
    expect(email.html.replace(/t=[0-9a-f-]{36}/g, "")).not.toMatch(/\b\d{12,19}\b/);
  });

  it("shows customer contact details only to staff", () => {
    expect(renderEmail("staff_new_paid_order", { locale: "en", order }).html).toContain("+96555123456");
    expect(renderEmail("payment_succeeded", { locale: "en", order, orderUrl }).html).not.toContain("+96555123456");
  });
});

describe("recipient guard", () => {
  it("allows anyone on the production deployment", () => {
    expect(recipientAllowed("customer@gmail.com", { production: true, allowlist: "" })).toBe(true);
  });
  it("outside production allows only listed addresses or domains", () => {
    const env = { production: false, allowlist: "qa@ranascent.com, @example.test" };
    expect(recipientAllowed("customer@gmail.com", env)).toBe(false);
    expect(recipientAllowed("QA@ranascent.com", env)).toBe(true);
    expect(recipientAllowed("buyer@example.test", env)).toBe(true);
    expect(recipientAllowed("buyer@example.test.evil.com", env)).toBe(false);
    expect(recipientAllowed("anyone@x.com", { production: false, allowlist: "" })).toBe(false);
  });
});
