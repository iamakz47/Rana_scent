import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anonClient, createStaff, serviceClient } from "./env";

// Checkout, order and payment rules against the LOCAL stack.

type Actor = { id: string; email: string; client: SupabaseClient };

let anon: SupabaseClient;
let service: SupabaseClient;
let manager: Actor;
let support: Actor;
let finance: Actor;
let editor: Actor;
let variantId: string;
let lowStockVariant: string;
let draftVariant: string;

const uid = () => crypto.randomUUID();
const tag = () => crypto.randomUUID().slice(0, 6).toUpperCase();
const address = {
  governorate: "hawalli",
  area: "Salmiya",
  block: "10",
  street: "Salem Al Mubarak",
  building: "12",
  floor: "3",
  apartment: "7",
};

function payload(items: Array<{ variant_id: string; quantity: number }>, extra: Record<string, unknown> = {}) {
  return {
    idempotency_key: uid(),
    customer_name: "Test Customer",
    phone: `9${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`,
    email: "",
    locale: "en",
    payment_method: "tap",
    address,
    items,
    ...extra,
  };
}

async function makeProduct(price: number, stock: number, status: "published" | "draft" = "published") {
  const slug = `test-co-${uid().slice(0, 8)}`;
  const { data: product } = await service
    .from("products")
    .insert({ slug, type: "refill", name_ar: "اختبار", name_en: "Checkout test", status: "draft" })
    .select("id")
    .single();
  const { data: variant } = await service
    .from("product_variants")
    .insert({ product_id: product!.id, sku: `RS-CO-${tag()}`, label_ar: "قياسي", label_en: "Standard", price_fils: price })
    .select("id")
    .single();
  await service.from("inventory").update({ on_hand: stock }).eq("variant_id", variant!.id);
  if (status === "published") await service.from("products").update({ status: "published" }).eq("id", product!.id);
  return variant!.id as string;
}

async function stockOf(variant: string) {
  const { data } = await service.from("inventory").select("on_hand").eq("variant_id", variant).single();
  return data!.on_hand as number;
}

async function place(p: ReturnType<typeof payload>) {
  return anon.rpc("place_order", { p_payload: p });
}

async function capture(orderId: string, amount: number, eventId = uid()) {
  const charge = `chg_${uid()}`;
  const attach = await service.rpc("attach_payment_charge", { p_order: orderId, p_provider: "mock", p_charge_id: charge });
  expect(attach.error).toBeNull();
  const result = await service.rpc("record_payment_result", {
    p_provider: "mock",
    p_event_id: eventId,
    p_charge_id: charge,
    p_status: "CAPTURED",
    p_amount_fils: amount,
    p_currency: "KWD",
    p_method: "knet",
    p_reference: "ref",
    p_signature_valid: true,
    p_payload: {},
  });
  return { charge, result };
}

beforeAll(async () => {
  anon = anonClient();
  service = serviceClient();
  manager = await createStaff("co-manager", "manager");
  support = await createStaff("co-support", "support");
  finance = await createStaff("co-finance", "finance");
  editor = await createStaff("co-editor", "editor");

  // Delivery: activate the provisional zone and rate (2.000 KWD, free over 50.000).
  await service.from("shipping_zones").update({ is_active: true }).eq("name_en", "All of Kuwait");
  await service.from("shipping_rates").update({ is_active: true, price_fils: 2000, free_over_fils: 50000 }).eq("name_en", "Standard delivery");
  await service.from("store_settings").update({ cod_enabled: true, online_payments_enabled: true }).eq("id", 1);

  variantId = await makeProduct(14500, 100);
  lowStockVariant = await makeProduct(10000, 5);
  draftVariant = await makeProduct(9000, 50, "draft");
});

describe("pricing is computed by the server", () => {
  it("quotes subtotal, delivery and total from the database", async () => {
    const { data, error } = await anon.rpc("quote_order", {
      p_items: [{ variant_id: variantId, quantity: 2 }],
      p_governorate: "hawalli",
      p_area: "Salmiya",
      p_discount_code: "",
    });
    expect(error).toBeNull();
    expect(data.subtotal_fils).toBe(29000);
    expect(data.shipping_fils).toBe(2000);
    expect(data.total_fils).toBe(31000);
    expect(data.delivery_available).toBe(true);
  });

  it("ignores any price sent by the browser and reserves stock", async () => {
    const before = await stockOf(variantId);
    const p = payload([{ variant_id: variantId, quantity: 2, unit_price_fils: 1 } as never], { total_fils: 1 });
    const { data, error } = await place(p);
    expect(error).toBeNull();
    expect(data.total_fils).toBe(31000);
    expect(data.status).toBe("awaiting_payment");
    expect(await stockOf(variantId)).toBe(before - 2);

    const { data: order } = await service.from("orders").select("subtotal_fils, shipping_fils, phone").eq("id", data.order_id).single();
    expect(order).toMatchObject({ subtotal_fils: 29000, shipping_fils: 2000 });
    expect(order!.phone).toMatch(/^\+965\d{8}$/);
    const { data: moves } = await service.from("inventory_movements").select("reason, quantity_change").eq("order_id", data.order_id);
    expect(moves).toEqual([{ reason: "sale", quantity_change: -2 }]);
    const { data: pay } = await service.from("payments").select("status, amount_fils").eq("order_id", data.order_id).single();
    expect(pay).toEqual({ status: "initiated", amount_fils: 31000 });
  });

  it("applies free delivery above the threshold", async () => {
    const { data } = await anon.rpc("quote_order", {
      p_items: [{ variant_id: variantId, quantity: 4 }],
      p_governorate: "ahmadi",
      p_area: "Fintas",
      p_discount_code: "",
    });
    expect(data.subtotal_fils).toBe(58000);
    expect(data.shipping_fils).toBe(0);
  });
});

describe("checkout safety", () => {
  it("returns the same order when the checkout is submitted twice", async () => {
    const before = await stockOf(variantId);
    const p = payload([{ variant_id: variantId, quantity: 1 }]);
    const first = await place(p);
    const second = await place(p);
    expect(second.data.order_id).toBe(first.data.order_id);
    expect(second.data.duplicate).toBe(true);
    expect(await stockOf(variantId)).toBe(before - 1);
  });

  it("never oversells under concurrent checkouts", async () => {
    const attempts = await Promise.all(
      Array.from({ length: 4 }, () => place(payload([{ variant_id: lowStockVariant, quantity: 2 }]))),
    );
    const succeeded = attempts.filter((a) => !a.error).length;
    expect(succeeded).toBe(2);
    expect(attempts.filter((a) => a.error).every((a) => a.error!.message === "out_of_stock")).toBe(true);
    expect(await stockOf(lowStockVariant)).toBe(1);
  });

  it("accepts every Kuwaiti phone format, including local numbers starting with 965", async () => {
    for (const phone of ["96512345", "+965 9651 2345", "0096555123456".slice(0, 13), "96555123456", "2222 3333"]) {
      const { data, error } = await place(payload([{ variant_id: variantId, quantity: 1 }], { phone, payment_method: "cod" }));
      expect(error, phone).toBeNull();
      const { data: order } = await service.from("orders").select("phone").eq("id", data.order_id).single();
      expect(order!.phone, phone).toMatch(/^\+965[2569]\d{7}$/);
    }
  });

  it("rejects drafts, unknown items, bad quantities and bad customer details", async () => {
    const cases: Array<[ReturnType<typeof payload>, string]> = [
      [payload([{ variant_id: draftVariant, quantity: 1 }]), "item_unavailable"],
      [payload([{ variant_id: uid(), quantity: 1 }]), "item_unavailable"],
      [payload([{ variant_id: variantId, quantity: 0 }]), "quantity_invalid"],
      [payload([{ variant_id: variantId, quantity: 21 }]), "quantity_invalid"],
      [payload([]), "cart_empty"],
      [payload([{ variant_id: "not-a-uuid", quantity: 1 }]), "cart_invalid"],
      [payload([{ variant_id: variantId, quantity: 1 }], { phone: "12345" }), "phone_invalid"],
      [payload([{ variant_id: variantId, quantity: 1 }], { customer_name: "A" }), "name_invalid"],
      [payload([{ variant_id: variantId, quantity: 1 }], { email: "not-an-email" }), "email_invalid"],
      [payload([{ variant_id: variantId, quantity: 1 }], { address: { ...address, governorate: "nowhere" } }), "address_invalid"],
      [payload([{ variant_id: variantId, quantity: 1 }], { address: { ...address, block: "" } }), "address_invalid"],
      [payload([{ variant_id: variantId, quantity: 1 }], { payment_method: "crypto" }), "payment_method_unavailable"],
      [{ ...payload([{ variant_id: variantId, quantity: 1 }]), idempotency_key: "" }, "idempotency_missing"],
    ];
    for (const [p, message] of cases) {
      const { error } = await place(p);
      expect(error?.message, message).toBe(message);
    }
  });

  it("refuses cash on delivery when the store has it switched off", async () => {
    await service.from("store_settings").update({ cod_enabled: false }).eq("id", 1);
    const { error } = await place(payload([{ variant_id: variantId, quantity: 1 }], { payment_method: "cod" }));
    expect(error?.message).toBe("payment_method_unavailable");
    await service.from("store_settings").update({ cod_enabled: true }).eq("id", 1);
  });

  it("refuses delivery to areas no active zone serves", async () => {
    await service.from("shipping_zones").update({ areas: ["Salmiya"] }).eq("name_en", "All of Kuwait");
    const { error } = await place(payload([{ variant_id: variantId, quantity: 1 }], { address: { ...address, area: "Jabriya" } }));
    expect(error?.message).toBe("delivery_unavailable");
    await service.from("shipping_zones").update({ areas: [] }).eq("name_en", "All of Kuwait");
  });
});

describe("discount codes", () => {
  it("applies percentage and fixed codes and enforces limits", async () => {
    const pct = `PCT${tag()}`;
    const once = `ONE${tag()}`;
    await service.from("discount_codes").insert([
      { code: pct, kind: "percentage", value: 10, is_active: true },
      { code: once, kind: "fixed", value: 5000, is_active: true, max_redemptions: 1 },
    ]);
    const quote = await anon.rpc("quote_order", {
      p_items: [{ variant_id: variantId, quantity: 2 }],
      p_governorate: "capital",
      p_area: "Sharq",
      p_discount_code: pct.toLowerCase(),
    });
    expect(quote.data.discount_fils).toBe(2900);
    expect(quote.data.total_fils).toBe(29000 - 2900 + 2000);

    const first = await place(payload([{ variant_id: variantId, quantity: 1 }], { discount_code: once }));
    expect(first.error).toBeNull();
    expect(first.data.total_fils).toBe(14500 - 5000 + 2000);
    const second = await place(payload([{ variant_id: variantId, quantity: 1 }], { discount_code: once }));
    expect(second.error?.message).toBe("discount_used_up");

    const bogus = await place(payload([{ variant_id: variantId, quantity: 1 }], { discount_code: "NOPE123" }));
    expect(bogus.error?.message).toBe("discount_invalid");

    // Cancelling the order gives the redemption back.
    await service.from("orders").update({ status: "cancelled" }).eq("id", first.data.order_id);
    const third = await place(payload([{ variant_id: variantId, quantity: 1 }], { discount_code: once }));
    expect(third.error).toBeNull();
  });

  it("never lists discount codes to the public", async () => {
    const { data } = await anon.from("discount_codes").select("code");
    expect(data ?? []).toEqual([]);
  });
});

describe("checkout settings", () => {
  it("only settings managers can change checkout settings", async () => {
    for (const change of [{ cod_enabled: false }, { online_payments_enabled: false }, { order_expiry_minutes: 60 }, { delivery_note_en: "x" }]) {
      const res = await editor.client.from("store_settings").update(change).eq("id", 1);
      expect(res.error?.message, JSON.stringify(change)).toMatch(/settings\.write/);
    }
    const slider = await editor.client.from("store_settings").update({ slider_interval_seconds: 5 }).eq("id", 1);
    expect(slider.error).toBeNull();
    await service.from("store_settings").update({ slider_interval_seconds: 4 }).eq("id", 1);
  });
});

describe("customer order access", () => {
  it("shows an order only with its secret token", async () => {
    const { data } = await place(payload([{ variant_id: variantId, quantity: 1 }]));
    const ok = await anon.rpc("get_order_for_customer", { order_number: data.number, token: data.access_token });
    expect(ok.data.total_fils).toBe(data.total_fils);
    const wrong = await anon.rpc("get_order_for_customer", { order_number: data.number, token: uid() });
    expect(wrong.data).toBeNull();
    const table = await anon.from("orders").select("id");
    expect(table.error).not.toBeNull();
  });
});

describe("payments", () => {
  it("only the server can record payment results", async () => {
    const { data } = await place(payload([{ variant_id: variantId, quantity: 1 }]));
    for (const client of [anon, manager.client, finance.client]) {
      const { error } = await client.rpc("record_payment_result", {
        p_provider: "mock", p_event_id: uid(), p_charge_id: "x", p_status: "CAPTURED", p_amount_fils: 1,
        p_currency: "KWD", p_method: "knet", p_reference: "", p_signature_valid: true, p_payload: {},
      });
      expect(error).not.toBeNull();
      const attach = await client.rpc("attach_payment_charge", { p_order: data.order_id, p_provider: "mock", p_charge_id: "x" });
      expect(attach.error).not.toBeNull();
    }
    // Staff can't mark an order paid directly either.
    const direct = await manager.client.from("orders").update({ status: "paid" }).eq("id", data.order_id);
    expect(direct.error).not.toBeNull();
  });

  it("marks the order paid on a verified capture, once", async () => {
    const { data } = await place(payload([{ variant_id: variantId, quantity: 1 }]));
    const eventId = uid();
    const { charge, result } = await capture(data.order_id, data.total_fils, eventId);
    expect(result.data).toBe("captured");
    const replay = await service.rpc("record_payment_result", {
      p_provider: "mock", p_event_id: eventId, p_charge_id: charge, p_status: "CAPTURED", p_amount_fils: data.total_fils,
      p_currency: "KWD", p_method: "knet", p_reference: "ref", p_signature_valid: true, p_payload: {},
    });
    expect(replay.data).toBe("duplicate");
    const late = await service.rpc("record_payment_result", {
      p_provider: "mock", p_event_id: uid(), p_charge_id: charge, p_status: "FAILED", p_amount_fils: data.total_fils,
      p_currency: "KWD", p_method: "knet", p_reference: "ref", p_signature_valid: true, p_payload: {},
    });
    expect(late.data).toBe("ignored_settled");
    const { data: order } = await service.from("orders").select("status").eq("id", data.order_id).single();
    expect(order!.status).toBe("paid");
  });

  it("rejects a capture whose amount doesn't match the order", async () => {
    const { data } = await place(payload([{ variant_id: variantId, quantity: 1 }]));
    const { result } = await capture(data.order_id, data.total_fils - 1000);
    expect(result.data).toBe("amount_mismatch");
    const { data: order } = await service.from("orders").select("status").eq("id", data.order_id).single();
    expect(order!.status).toBe("awaiting_payment");
  });

  it("ignores events with an invalid signature", async () => {
    const { data } = await place(payload([{ variant_id: variantId, quantity: 1 }]));
    const charge = `chg_${uid()}`;
    await service.rpc("attach_payment_charge", { p_order: data.order_id, p_provider: "mock", p_charge_id: charge });
    const res = await service.rpc("record_payment_result", {
      p_provider: "mock", p_event_id: uid(), p_charge_id: charge, p_status: "CAPTURED", p_amount_fils: data.total_fils,
      p_currency: "KWD", p_method: "knet", p_reference: "", p_signature_valid: false, p_payload: {},
    });
    expect(res.data).toBe("rejected_signature");
  });

  it("cancels the order and releases stock when payment fails", async () => {
    const before = await stockOf(variantId);
    const { data } = await place(payload([{ variant_id: variantId, quantity: 3 }]));
    expect(await stockOf(variantId)).toBe(before - 3);
    const charge = `chg_${uid()}`;
    await service.rpc("attach_payment_charge", { p_order: data.order_id, p_provider: "mock", p_charge_id: charge });
    const res = await service.rpc("record_payment_result", {
      p_provider: "mock", p_event_id: uid(), p_charge_id: charge, p_status: "DECLINED", p_amount_fils: data.total_fils,
      p_currency: "KWD", p_method: "card", p_reference: "", p_signature_valid: true, p_payload: {},
    });
    expect(res.data).toBe("failed");
    const { data: order } = await service.from("orders").select("status, stock_released").eq("id", data.order_id).single();
    expect(order).toEqual({ status: "cancelled", stock_released: true });
    expect(await stockOf(variantId)).toBe(before);
  });

  it("expires unpaid orders and releases their stock", async () => {
    const before = await stockOf(variantId);
    const { data } = await place(payload([{ variant_id: variantId, quantity: 2 }]));
    await service.from("orders").update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", data.order_id);
    const { data: count } = await service.rpc("expire_unpaid_orders");
    expect(count).toBeGreaterThanOrEqual(1);
    expect(await stockOf(variantId)).toBe(before);
    const { data: order } = await service.from("orders").select("status").eq("id", data.order_id).single();
    expect(order!.status).toBe("cancelled");
  });
});

describe("fulfilment and refunds", () => {
  it("staff move orders through allowed stages only, with history", async () => {
    const { data } = await place(payload([{ variant_id: variantId, quantity: 1 }]));
    await capture(data.order_id, data.total_fils);
    const move = (status: string) => support.client.from("orders").update({ status }).eq("id", data.order_id);

    expect((await move("delivered")).error?.message).toMatch(/cannot move/);
    for (const status of ["processing", "ready_for_delivery", "out_for_delivery"]) {
      expect((await move(status)).error, status).toBeNull();
    }
    const tracking = await support.client.from("orders").update({ courier: "Rana Fleet", tracking_number: "RS-1" }).eq("id", data.order_id);
    expect(tracking.error).toBeNull();
    const tamper = await support.client.from("orders").update({ total_fils: 1 }).eq("id", data.order_id);
    expect(tamper.error).not.toBeNull();
    expect((await move("delivered")).error).toBeNull();
    expect((await move("cancelled")).error?.message).toMatch(/cannot move/);

    const { data: history } = await support.client
      .from("order_status_history")
      .select("to_status, actor_id")
      .eq("order_id", data.order_id)
      .order("created_at");
    expect(history!.map((h) => h.to_status)).toEqual([
      "awaiting_payment", "paid", "processing", "ready_for_delivery", "out_for_delivery", "delivered",
    ]);
    expect(history!.filter((h) => h.actor_id === support.id)).toHaveLength(4);
  });

  it("cash on delivery records the payment when delivered", async () => {
    const { data } = await place(payload([{ variant_id: variantId, quantity: 1 }], { payment_method: "cod" }));
    expect(data.status).toBe("pending");
    for (const status of ["processing", "ready_for_delivery", "out_for_delivery", "delivered"]) {
      expect((await manager.client.from("orders").update({ status }).eq("id", data.order_id)).error).toBeNull();
    }
    const { data: pay } = await service.from("payments").select("provider, status, amount_fils").eq("order_id", data.order_id);
    expect(pay).toEqual([{ provider: "cod", status: "captured", amount_fils: data.total_fils }]);
  });

  it("staff cancellation returns stock exactly once", async () => {
    const before = await stockOf(variantId);
    const { data } = await place(payload([{ variant_id: variantId, quantity: 2 }], { payment_method: "cod" }));
    await support.client.from("orders").update({ status: "cancelled" }).eq("id", data.order_id);
    await service.rpc("expire_unpaid_orders");
    expect(await stockOf(variantId)).toBe(before);
  });

  it("refunds are requested by order staff and resolved by finance", async () => {
    const { data } = await place(payload([{ variant_id: variantId, quantity: 1 }]));
    await capture(data.order_id, data.total_fils);
    const tooMuch = await support.client.rpc("request_refund", { p_order: data.order_id, p_amount: data.total_fils + 1, p_reason: "x" });
    expect(tooMuch.error?.message).toBe("refund_amount_invalid");
    const byEditor = await editor.client.rpc("request_refund", { p_order: data.order_id, p_amount: 1000, p_reason: "x" });
    expect(byEditor.error).not.toBeNull();
    const req = await support.client.rpc("request_refund", { p_order: data.order_id, p_amount: data.total_fils, p_reason: "Damaged" });
    expect(req.error).toBeNull();
    const bySupport = await support.client.rpc("resolve_refund", { p_request: req.data, p_approve: true });
    expect(bySupport.error).not.toBeNull();
    const ok = await finance.client.rpc("resolve_refund", { p_request: req.data, p_approve: true, p_provider_refund_id: "re_123" });
    expect(ok.error).toBeNull();
    const { data: order } = await service.from("orders").select("status").eq("id", data.order_id).single();
    expect(order!.status).toBe("refunded");
  });

  it("internal notes and the customer list are staff-only", async () => {
    const { data } = await place(payload([{ variant_id: variantId, quantity: 1 }], { payment_method: "cod" }));
    const note = await support.client.from("order_notes").insert({ order_id: data.order_id, body: "Call before delivery", actor_id: support.id });
    expect(note.error).toBeNull();
    const spoof = await support.client.from("order_notes").insert({ order_id: data.order_id, body: "x", actor_id: manager.id });
    expect(spoof.error).not.toBeNull();
    expect((await editor.client.from("order_notes").select("id").eq("order_id", data.order_id)).data).toEqual([]);
    expect((await anon.from("order_notes").select("id")).error).not.toBeNull();

    const customers = await support.client.rpc("list_customers", { p_search: "" });
    expect(customers.error).toBeNull();
    expect(customers.data.length).toBeGreaterThan(0);
    expect((await editor.client.rpc("list_customers", { p_search: "" })).error).not.toBeNull();
  });
});
