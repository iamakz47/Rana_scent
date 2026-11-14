import { describe, expect, it } from "vitest";
import { checkoutSchema, normalizeKuwaitPhone } from "./schema";

describe("Kuwaiti phone numbers", () => {
  it("normalises every common format", () => {
    expect(normalizeKuwaitPhone("55123456")).toBe("+96555123456");
    expect(normalizeKuwaitPhone("+965 5512 3456")).toBe("+96555123456");
    expect(normalizeKuwaitPhone("0096555123456")).toBe("+96555123456");
    expect(normalizeKuwaitPhone("96555123456")).toBe("+96555123456");
    expect(normalizeKuwaitPhone("96512345")).toBe("+96596512345");
    expect(normalizeKuwaitPhone("٥٥١٢٣٤٥٦")).toBe("+96555123456");
    expect(normalizeKuwaitPhone("22223333")).toBe("+96522223333");
  });

  it("rejects numbers that aren't Kuwaiti", () => {
    for (const bad of ["1234", "15123456", "+9715512345", "abcdefgh", "555123456789"]) {
      expect(normalizeKuwaitPhone(bad), bad).toBeNull();
    }
  });
});

describe("checkout schema", () => {
  const valid = {
    idempotency_key: "3f2b8c1e-1d2a-4c3b-9e8f-0a1b2c3d4e5f",
    locale: "ar",
    customer_name: "منى أحمد",
    phone: "55123456",
    email: "",
    governorate: "hawalli",
    area: "السالمية",
    block: "10",
    street: "سالم المبارك",
    avenue: "",
    building: "12",
    floor: "",
    apartment: "",
    delivery_instructions: "",
    customer_note: "",
    discount_code: " welcome10 ",
    payment_method: "tap",
    items: [{ variant_id: "3f2b8c1e-1d2a-4c3b-9e8f-0a1b2c3d4e5f", quantity: 2 }],
  };

  it("accepts a complete Arabic order and normalises fields", () => {
    const parsed = checkoutSchema.parse(valid);
    expect(parsed.phone).toBe("+96555123456");
    expect(parsed.discount_code).toBe("WELCOME10");
  });

  it("never accepts prices and rejects incomplete addresses", () => {
    const withPrice = checkoutSchema.parse({ ...valid, total_fils: 1, items: [{ ...valid.items[0], unit_price_fils: 1 }] });
    expect(withPrice).not.toHaveProperty("total_fils");
    expect(withPrice.items[0]).not.toHaveProperty("unit_price_fils");
    expect(checkoutSchema.safeParse({ ...valid, block: "" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, governorate: "dubai" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, items: [] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, items: [{ ...valid.items[0], quantity: 21 }] }).success).toBe(false);
  });
});
