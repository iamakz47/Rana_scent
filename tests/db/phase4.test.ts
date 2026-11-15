import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anonClient, createStaff, createUser, serviceClient, TEST_PASSWORD } from "./env";

// Phase 4: customer accounts, email outbox, refunds and reconciliation,
// against the LOCAL stack under production-style privileges.

type Actor = { id: string; email: string; client: SupabaseClient };

let anon: SupabaseClient;
let service: SupabaseClient;
let alice: Actor;
let bob: Actor;
let support: Actor;
let finance: Actor;
let editor: Actor;
let variantId: string;

const uid = () => crypto.randomUUID();
// Provider refund ids are unique; fresh ones keep the tests repeatable.
const refundId = () => `re_${uid().replaceAll("-", "")}`;
const tag = () => crypto.randomUUID().slice(0, 6).toUpperCase();
const address = { governorate: "hawalli", area: "Salmiya", block: "10", street: "Salem Al Mubarak", building: "12" };
const phone = () => `9${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;

function payload(extra: Record<string, unknown> = {}, quantity = 1) {
  return {
    idempotency_key: uid(),
    customer_name: "Phase Four",
    phone: phone(),
    email: "",
    locale: "en",
    payment_method: "tap",
    address,
    items: [{ variant_id: variantId, quantity }],
    ...extra,
  };
}

async function makeVariant(price: number, stock: number, threshold = 5) {
  const { data: product } = await service
    .from("products")
    .insert({ slug: `p4-${uid().slice(0, 8)}`, type: "refill", name_ar: "اختبار", name_en: "P4 test", status: "draft" })
    .select("id")
    .single();
  const { data: variant } = await service
    .from("product_variants")
    .insert({ product_id: product!.id, sku: `RS-P4-${tag()}`, label_ar: "قياسي", label_en: "Standard", price_fils: price })
    .select("id")
    .single();
  await service.from("inventory").update({ on_hand: stock, low_stock_threshold: threshold }).eq("variant_id", variant!.id);
  await service.from("products").update({ status: "published" }).eq("id", product!.id);
  return variant!.id as string;
}

async function capture(orderId: string, amount: number) {
  const charge = `chg_${uid().replaceAll("-", "")}`;
  await service.rpc("attach_payment_charge", { p_order: orderId, p_provider: "mock", p_charge_id: charge });
  const { data } = await service.rpc("record_payment_result", {
    p_provider: "mock", p_event_id: `${charge}:CAPTURED`, p_charge_id: charge, p_status: "CAPTURED",
    p_amount_fils: amount, p_currency: "KWD", p_method: "knet", p_reference: "ref", p_signature_valid: true, p_payload: {},
  });
  return { charge, outcome: data as string };
}

async function paidOrder(extra: Record<string, unknown> = {}, client: SupabaseClient = anon) {
  const { data, error } = await client.rpc("place_order", { p_payload: payload(extra) });
  expect(error).toBeNull();
  const { charge } = await capture(data.order_id, data.total_fils);
  return { ...data, charge } as { order_id: string; number: number; access_token: string; total_fils: number; charge: string };
}

async function emails(orderId: string) {
  const { data } = await service.from("email_messages").select("kind, audience, status, to_email").eq("order_id", orderId);
  return (data ?? []).map((e) => e.kind).sort();
}

beforeAll(async () => {
  anon = anonClient();
  service = serviceClient();
  alice = await createUser("alice");
  bob = await createUser("bob");
  support = await createStaff("p4-support", "support");
  finance = await createStaff("p4-finance", "finance");
  editor = await createStaff("p4-editor", "editor");
  await service.from("shipping_zones").update({ is_active: true }).eq("name_en", "All of Kuwait");
  await service.from("shipping_rates").update({ is_active: true, price_fils: 2000, free_over_fils: 50000 }).eq("name_en", "Standard delivery");
  await service.from("store_settings").update({ cod_enabled: true, online_payments_enabled: true }).eq("id", 1);
  await service.from("notification_settings").update({ staff_email: "orders@example.test" }).eq("id", 1);
  variantId = await makeVariant(10000, 1000, 0);
});

describe("customer profiles and addresses", () => {
  it("customers read and edit only their own profile", async () => {
    const own = await alice.client.from("profiles").update({ full_name: "Alice A", phone: "+96550000001" }).eq("id", alice.id).select();
    expect(own.error).toBeNull();
    expect(own.data).toHaveLength(1);
    const other = await alice.client.from("profiles").update({ full_name: "Hacked" }).eq("id", bob.id).select();
    expect(other.data).toHaveLength(0);
    const read = await alice.client.from("profiles").select("id");
    expect(read.data!.map((r) => r.id)).toEqual([alice.id]);
  });

  it("customers can't see staff, audit, payments, notes or email data", async () => {
    for (const table of ["staff_members", "audit_logs", "payments", "order_notes", "refund_requests", "email_messages",
      "notification_settings", "customer_addresses", "account_deletion_requests", "expenses", "discount_codes"]) {
      const { data } = await alice.client.from(table).select("*").limit(5);
      expect(data ?? [], table).toHaveLength(0);
    }
  });

  it("manages addresses with a single default, isolated per customer", async () => {
    const first = await alice.client.from("customer_addresses")
      .insert({ user_id: alice.id, label: "Home", recipient_name: "Alice", phone: "+96550000001", ...address })
      .select("id, is_default").single();
    expect(first.error).toBeNull();
    expect(first.data!.is_default).toBe(true);
    const second = await alice.client.from("customer_addresses")
      .insert({ user_id: alice.id, label: "Work", recipient_name: "Alice", phone: "+96550000001", ...address })
      .select("id, is_default").single();
    expect(second.data!.is_default).toBe(false);

    expect((await alice.client.rpc("set_default_address", { p_address: second.data!.id })).error).toBeNull();
    const { data: rows } = await alice.client.from("customer_addresses").select("id, is_default").order("created_at");
    expect(rows!.map((r) => r.is_default)).toEqual([false, true]);

    // Bob can neither see, change, delete, default nor steal Alice's addresses.
    expect((await bob.client.from("customer_addresses").select("id")).data).toHaveLength(0);
    expect((await bob.client.from("customer_addresses").update({ label: "x" }).eq("id", first.data!.id).select()).data).toHaveLength(0);
    expect((await bob.client.from("customer_addresses").delete().eq("id", first.data!.id).select()).data).toHaveLength(0);
    expect((await bob.client.rpc("set_default_address", { p_address: first.data!.id })).error).not.toBeNull();
    const steal = await bob.client.from("customer_addresses")
      .insert({ user_id: alice.id, recipient_name: "Bob", phone: "+96550000002", ...address });
    expect(steal.error).not.toBeNull();
    const move = await alice.client.from("customer_addresses").update({ user_id: bob.id }).eq("id", first.data!.id);
    expect(move.error).not.toBeNull();

    // Deleting the default promotes another address.
    await alice.client.from("customer_addresses").delete().eq("id", second.data!.id);
    const { data: left } = await alice.client.from("customer_addresses").select("is_default");
    expect(left).toEqual([{ is_default: true }]);
  });

  it("limits a customer to 10 addresses", async () => {
    const carol = await createUser("carol");
    const rows = Array.from({ length: 10 }, () => ({ user_id: carol.id, recipient_name: "C", phone: "+96550000003", ...address }));
    expect((await carol.client.from("customer_addresses").insert(rows)).error).toBeNull();
    const extra = await carol.client.from("customer_addresses").insert({ user_id: carol.id, recipient_name: "C", phone: "+96550000003", ...address });
    expect(extra.error?.message).toBe("address_limit");
  });
});

describe("customer orders", () => {
  it("orders placed while signed in belong to the customer and appear only in their history", async () => {
    const { data, error } = await alice.client.rpc("place_order", { p_payload: payload({ payment_method: "cod" }) });
    expect(error).toBeNull();
    const mine = await alice.client.rpc("my_orders");
    expect(mine.data!.map((o: { number: number }) => o.number)).toContain(data.number);
    const theirs = await bob.client.rpc("my_orders");
    expect(theirs.data!.map((o: { number: number }) => o.number)).not.toContain(data.number);
    expect((await bob.client.from("orders").select("id").eq("id", data.order_id)).data).toHaveLength(0);
    expect((await bob.client.from("order_items").select("id").eq("order_id", data.order_id)).data).toHaveLength(0);
    expect((await anon.rpc("my_orders")).error).not.toBeNull();
  });

  it("customers can't edit their orders directly", async () => {
    const { data } = await alice.client.rpc("place_order", { p_payload: payload({ payment_method: "cod" }) });
    const res = await alice.client.from("orders").update({ status: "cancelled" }).eq("id", data.order_id).select();
    expect(res.data ?? []).toHaveLength(0);
  });
});

describe("linking guest orders", () => {
  it("needs the order link and a verified matching email; never just a matching email", async () => {
    const guest = await anon.rpc("place_order", { p_payload: payload({ payment_method: "cod", email: alice.email.toUpperCase() }) });
    const { number, access_token: token, order_id: orderId } = guest.data;

    // Same email, wrong token: refused.
    expect((await alice.client.rpc("claim_guest_order", { p_number: number, p_token: uid() })).data).toBe(false);
    // Right token, different account email: refused.
    expect((await bob.client.rpc("claim_guest_order", { p_number: number, p_token: token })).data).toBe(false);
    // Anonymous: refused.
    expect((await anon.rpc("claim_guest_order", { p_number: number, p_token: token })).error).not.toBeNull();

    // Unverified account with the same email: refused.
    const unverifiedEmail = `unverified-${tag().toLowerCase()}@example.test`;
    const u = await service.auth.admin.createUser({ email: unverifiedEmail, password: TEST_PASSWORD, email_confirm: false });
    const unverifiedOrder = await anon.rpc("place_order", { p_payload: payload({ payment_method: "cod", email: unverifiedEmail }) });
    const uc = anonClient();
    const signIn = await uc.auth.signInWithPassword({ email: unverifiedEmail, password: TEST_PASSWORD });
    if (!signIn.error) {
      const r = await uc.rpc("claim_guest_order", { p_number: unverifiedOrder.data.number, p_token: unverifiedOrder.data.access_token });
      expect(r.data).toBe(false);
    }
    await service.auth.admin.deleteUser(u.data.user!.id);

    // Verified, matching email + token: linked, once.
    expect((await alice.client.rpc("claim_guest_order", { p_number: number, p_token: token })).data).toBe(true);
    expect((await alice.client.rpc("claim_guest_order", { p_number: number, p_token: token })).data).toBe(false);
    const { data: order } = await service.from("orders").select("user_id").eq("id", orderId).single();
    expect(order!.user_id).toBe(alice.id);
  });

  it("orders without an email can't be claimed", async () => {
    const guest = await anon.rpc("place_order", { p_payload: payload({ payment_method: "cod" }) });
    expect((await alice.client.rpc("claim_guest_order", { p_number: guest.data.number, p_token: guest.data.access_token })).data).toBe(false);
  });
});

describe("account deletion", () => {
  it("customers request deletion; support completes it and the customer's data is detached", async () => {
    const dave = await createUser("dave");
    await dave.client.from("profiles").update({ full_name: "Dave", phone: "+96550000004" }).eq("id", dave.id);
    await dave.client.from("customer_addresses").insert({ user_id: dave.id, recipient_name: "Dave", phone: "+96550000004", ...address });
    const order = await dave.client.rpc("place_order", { p_payload: payload({ payment_method: "cod" }) });

    const first = await dave.client.rpc("request_account_deletion", { p_reason: "No longer needed" });
    expect(first.error).toBeNull();
    const again = await dave.client.rpc("request_account_deletion", { p_reason: "" });
    expect(again.data).toBe(first.data);

    expect((await editor.client.rpc("resolve_account_deletion", { p_request: first.data, p_complete: true })).error).not.toBeNull();
    expect((await bob.client.rpc("resolve_account_deletion", { p_request: first.data, p_complete: true })).error).not.toBeNull();
    expect((await dave.client.rpc("resolve_account_deletion", { p_request: first.data, p_complete: true })).error).not.toBeNull();

    const done = await support.client.rpc("resolve_account_deletion", { p_request: first.data, p_complete: true, p_note: "Verified by phone" });
    expect(done.error).toBeNull();
    expect(done.data).toBe(dave.id);
    const { data: profile } = await service.from("profiles").select("full_name, phone").eq("id", dave.id).single();
    expect(profile).toEqual({ full_name: "", phone: null });
    expect((await service.from("customer_addresses").select("id").eq("user_id", dave.id)).data).toHaveLength(0);
    const { data: kept } = await service.from("orders").select("user_id, total_fils").eq("id", order.data.order_id).single();
    expect(kept!.user_id).toBeNull();
    expect((await support.client.rpc("resolve_account_deletion", { p_request: first.data, p_complete: true })).error).not.toBeNull();
  });

  it("staff accounts can't use the customer deletion flow", async () => {
    const r = await support.client.rpc("request_account_deletion", { p_reason: "" });
    expect(r.error?.message).toBe("staff_account");
  });
});

describe("rate limiting", () => {
  it("is service-role only and blocks after the limit", async () => {
    expect((await anon.rpc("consume_rate_limit", { p_bucket: "x", p_limit: 1, p_window_seconds: 60 })).error).not.toBeNull();
    expect((await alice.client.rpc("consume_rate_limit", { p_bucket: "x", p_limit: 1, p_window_seconds: 60 })).error).not.toBeNull();
    const bucket = `test:${uid()}`;
    const results = [];
    for (let i = 0; i < 4; i++) {
      results.push((await service.rpc("consume_rate_limit", { p_bucket: bucket, p_limit: 3, p_window_seconds: 60 })).data);
    }
    expect(results).toEqual([true, true, true, false]);
  });
});

describe("email outbox", () => {
  it("queues confirmation emails for cash-on-delivery orders", async () => {
    const { data } = await anon.rpc("place_order", { p_payload: payload({ payment_method: "cod", email: "buyer@example.test" }) });
    expect(await emails(data.order_id)).toEqual(["order_confirmation", "staff_new_cod_order"]);
    const { data: rows } = await service.from("email_messages").select("audience, to_email, status").eq("order_id", data.order_id).order("audience");
    expect(rows).toEqual([
      { audience: "customer", to_email: "buyer@example.test", status: "queued" },
      { audience: "staff", to_email: "orders@example.test", status: "queued" },
    ]);
  });

  it("queues each lifecycle email once, even when payment events repeat", async () => {
    const order = await paidOrder({ email: "payer@example.test" });
    // Replay the same capture.
    await service.rpc("record_payment_result", {
      p_provider: "mock", p_event_id: `${order.charge}:CAPTURED`, p_charge_id: order.charge, p_status: "CAPTURED",
      p_amount_fils: order.total_fils, p_currency: "KWD", p_method: "knet", p_reference: "ref", p_signature_valid: true, p_payload: {},
    });
    for (const status of ["processing", "ready_for_delivery", "out_for_delivery", "delivered"]) {
      expect((await support.client.from("orders").update({ status }).eq("id", order.order_id)).error).toBeNull();
    }
    expect(await emails(order.order_id)).toEqual([
      "order_delivered", "order_out_for_delivery", "order_processing", "order_ready_for_delivery",
      "payment_succeeded", "staff_new_paid_order",
    ]);
  });

  it("queues a payment-failed email when the payment is declined", async () => {
    const { data } = await anon.rpc("place_order", { p_payload: payload({ email: "declined@example.test" }) });
    const charge = `chg_${uid().replaceAll("-", "")}`;
    await service.rpc("attach_payment_charge", { p_order: data.order_id, p_provider: "mock", p_charge_id: charge });
    await service.rpc("record_payment_result", {
      p_provider: "mock", p_event_id: `${charge}:DECLINED`, p_charge_id: charge, p_status: "DECLINED",
      p_amount_fils: data.total_fils, p_currency: "KWD", p_method: "", p_reference: "", p_signature_valid: true, p_payload: {},
    });
    expect(await emails(data.order_id)).toEqual(["payment_failed"]);
  });

  it("skips customer emails with no address but keeps the record", async () => {
    const { data } = await anon.rpc("place_order", { p_payload: payload({ payment_method: "cod" }) });
    const { data: row } = await service.from("email_messages").select("status, last_error")
      .eq("order_id", data.order_id).eq("kind", "order_confirmation").single();
    expect(row).toEqual({ status: "skipped", last_error: "No recipient" });
  });

  it("dispatches with retries and back-off, service role only", async () => {
    expect((await anon.rpc("claim_email_batch", { p_limit: 5 })).error).not.toBeNull();
    expect((await support.client.rpc("claim_email_batch", { p_limit: 5 })).error).not.toBeNull();
    const { data: batch, error } = await service.rpc("claim_email_batch", { p_limit: 100 });
    expect(error).toBeNull();
    expect(batch.length).toBeGreaterThan(0);
    // Each claim counts an attempt (rows retried from earlier local runs may be past their first).
    expect(batch.every((m: { status: string; attempts: number }) => m.status === "sending" && m.attempts >= 1)).toBe(true);
    // Claimed rows are not handed out twice.
    const second = await service.rpc("claim_email_batch", { p_limit: 100 });
    const firstIds = new Set(batch.map((m: { id: string }) => m.id));
    expect(second.data.some((m: { id: string }) => firstIds.has(m.id))).toBe(false);

    const [ok, bad] = batch;
    await service.rpc("finish_email", { p_id: ok.id, p_ok: true, p_provider: "test", p_provider_message_id: "m1", p_subject: "s", p_error: "" });
    await service.rpc("finish_email", { p_id: bad.id, p_ok: false, p_provider: "test", p_provider_message_id: "", p_subject: "s", p_error: "Timeout" });
    const { data: rows } = await service.from("email_messages").select("id, status, last_error, next_attempt_at").in("id", [ok.id, bad.id]);
    const byId = Object.fromEntries(rows!.map((r) => [r.id, r]));
    expect(byId[ok.id].status).toBe("sent");
    expect(byId[bad.id]).toMatchObject({ status: "failed", last_error: "Timeout" });
    expect(new Date(byId[bad.id].next_attempt_at).getTime()).toBeGreaterThan(Date.now());
    // Release everything else so later tests start clean.
    for (const m of batch.slice(2)) {
      await service.rpc("finish_email", { p_id: m.id, p_ok: true, p_provider: "test", p_provider_message_id: "", p_subject: "", p_error: "" });
    }
  });

  it("lets order staff read the history but not customers or editors", async () => {
    expect(((await support.client.from("email_messages").select("id").limit(1)).data ?? []).length).toBe(1);
    expect((await editor.client.from("email_messages").select("id").limit(1)).data).toHaveLength(0);
    expect((await support.client.from("notification_settings").select("staff_email")).data).toHaveLength(0);
  });

  it("alerts staff once a day when stock crosses the low-stock line", async () => {
    const low = await makeVariant(5000, 7, 5);
    await service.from("inventory").update({ on_hand: 4 }).eq("variant_id", low);
    await service.from("inventory").update({ on_hand: 3 }).eq("variant_id", low);
    await service.from("inventory").update({ on_hand: 9 }).eq("variant_id", low);
    await service.from("inventory").update({ on_hand: 2 }).eq("variant_id", low);
    const { data } = await service.from("email_messages").select("kind, payload").eq("kind", "staff_low_stock")
      .contains("payload", { variant_id: low });
    expect(data).toHaveLength(1);
  });
});

describe("refunds", () => {
  it("refunds in full through the provider exactly once", async () => {
    const rid_full1 = refundId();
    const order = await paidOrder({ email: "refund@example.test" });
    const req = await support.client.rpc("request_refund", { p_order: order.order_id, p_amount: order.total_fils, p_reason: "Damaged" });
    expect(req.error).toBeNull();
    // Support can request but not approve.
    expect((await support.client.rpc("approve_refund", { p_request: req.data })).error).not.toBeNull();
    const approved = await finance.client.rpc("approve_refund", { p_request: req.data });
    expect(approved.error).toBeNull();
    expect(approved.data).toMatchObject({ provider: "mock", charge_id: order.charge, amount_fils: order.total_fils });
    // A second approval (double click, second tab) is refused.
    expect((await finance.client.rpc("approve_refund", { p_request: req.data })).error?.message).toBe("refund_not_open");
    // Only the service role records provider results.
    expect((await finance.client.rpc("record_refund_result", { p_request: req.data, p_provider_refund_id: "re_x", p_status: "REFUNDED", p_amount_fils: order.total_fils, p_currency: "KWD" })).error).not.toBeNull();

    const pending = await service.rpc("record_refund_result", { p_request: req.data, p_provider_refund_id: rid_full1, p_status: "PENDING", p_amount_fils: order.total_fils, p_currency: "KWD" });
    expect(pending.data).toBe("pending");
    const done = await service.rpc("record_refund_result", { p_request: req.data, p_provider_refund_id: rid_full1, p_status: "REFUNDED", p_amount_fils: order.total_fils, p_currency: "KWD" });
    expect(done.data).toBe("processed");
    const replay = await service.rpc("record_refund_result", { p_request: req.data, p_provider_refund_id: rid_full1, p_status: "REFUNDED", p_amount_fils: order.total_fils, p_currency: "KWD" });
    expect(replay.data).toBe("already_final");

    const { data: o } = await service.from("orders").select("status, refunded_fils").eq("id", order.order_id).single();
    expect(o).toEqual({ status: "refunded", refunded_fils: order.total_fils });
    const { data: p } = await service.from("payments").select("status").eq("provider_charge_id", order.charge).single();
    expect(p!.status).toBe("refunded");
    expect(await emails(order.order_id)).toEqual(expect.arrayContaining(["refund_initiated", "refund_completed", "staff_refund_requested"]));
  });

  it("supports partial refunds and never exceeds the captured amount", async () => {
    const rid_part1 = refundId();
    const order = await paidOrder();
    const first = await support.client.rpc("request_refund", { p_order: order.order_id, p_amount: 3000, p_reason: "Partial" });
    await finance.client.rpc("approve_refund", { p_request: first.data });
    // Processing refunds count toward the limit.
    const over = await support.client.rpc("request_refund", { p_order: order.order_id, p_amount: order.total_fils - 2999, p_reason: "Too much" });
    expect(over.error?.message).toBe("refund_amount_invalid");
    await service.rpc("record_refund_result", { p_request: first.data, p_provider_refund_id: rid_part1, p_status: "REFUNDED", p_amount_fils: 3000, p_currency: "KWD" });
    const { data: o } = await service.from("orders").select("status, refunded_fils").eq("id", order.order_id).single();
    expect(o).toEqual({ status: "paid", refunded_fils: 3000 });
  });

  it("a provider amount mismatch is not applied", async () => {
    const rid_mm1 = refundId();
    const order = await paidOrder();
    const req = await support.client.rpc("request_refund", { p_order: order.order_id, p_amount: 1000, p_reason: "x" });
    await finance.client.rpc("approve_refund", { p_request: req.data });
    const r = await service.rpc("record_refund_result", { p_request: req.data, p_provider_refund_id: rid_mm1, p_status: "REFUNDED", p_amount_fils: 9999, p_currency: "KWD" });
    expect(r.data).toBe("amount_mismatch");
    const { data: o } = await service.from("orders").select("refunded_fils").eq("id", order.order_id).single();
    expect(o!.refunded_fils).toBe(0);
  });

  it("a failed provider refund can be reopened, and a processing one can't be rejected blindly", async () => {
    const rid_fail1 = refundId();
    const order = await paidOrder();
    const req = await support.client.rpc("request_refund", { p_order: order.order_id, p_amount: 1000, p_reason: "x" });
    await finance.client.rpc("approve_refund", { p_request: req.data });
    expect((await finance.client.rpc("resolve_refund", { p_request: req.data, p_approve: false })).error?.message).toBe("refund_in_progress");
    const failed = await service.rpc("record_refund_result", { p_request: req.data, p_provider_refund_id: rid_fail1, p_status: "FAILED", p_amount_fils: 1000, p_currency: "KWD", p_error: "Declined by issuer" });
    expect(failed.data).toBe("failed");
    expect(await emails(order.order_id)).toContain("staff_payment_attention");
    expect((await support.client.rpc("reopen_refund", { p_request: req.data })).error).not.toBeNull();
    expect((await finance.client.rpc("reopen_refund", { p_request: req.data })).error).toBeNull();
    const { data: r } = await service.from("refund_requests").select("status, provider_refund_id").eq("id", req.data).single();
    expect(r).toEqual({ status: "requested", provider_refund_id: null });
  });

  it("cash-on-delivery refunds are resolved manually", async () => {
    const { data } = await anon.rpc("place_order", { p_payload: payload({ payment_method: "cod" }) });
    for (const status of ["processing", "ready_for_delivery", "out_for_delivery", "delivered"]) {
      await support.client.from("orders").update({ status }).eq("id", data.order_id);
    }
    const req = await support.client.rpc("request_refund", { p_order: data.order_id, p_amount: data.total_fils, p_reason: "Returned" });
    expect((await finance.client.rpc("approve_refund", { p_request: req.data })).error?.message).toBe("refund_manual_only");
    expect((await finance.client.rpc("resolve_refund", { p_request: req.data, p_approve: true })).error).toBeNull();
    const { data: o } = await service.from("orders").select("status, refunded_fils").eq("id", data.order_id).single();
    expect(o).toEqual({ status: "refunded", refunded_fils: data.total_fils });
  });

  it("cancelling a paid order restores stock and opens a refund request", async () => {
    const before = (await service.from("inventory").select("on_hand").eq("variant_id", variantId).single()).data!.on_hand;
    const order = await paidOrder();
    expect((await support.client.from("orders").update({ status: "cancelled" }).eq("id", order.order_id)).error).toBeNull();
    const after = (await service.from("inventory").select("on_hand").eq("variant_id", variantId).single()).data!.on_hand;
    expect(after).toBe(before);
    const { data: reqs } = await service.from("refund_requests").select("amount_fils, status, reason").eq("order_id", order.order_id);
    expect(reqs).toEqual([{ amount_fils: order.total_fils, status: "requested", reason: "Paid order cancelled" }]);
  });

  it("staff can't edit refund totals or mark orders refunded directly", async () => {
    const order = await paidOrder();
    expect((await support.client.from("orders").update({ refunded_fils: 5 }).eq("id", order.order_id)).error).not.toBeNull();
    expect((await support.client.from("orders").update({ status: "refunded" }).eq("id", order.order_id)).error).not.toBeNull();
  });
});

describe("reconciliation", () => {
  it("lists open online payments for the server to re-check, service role only", async () => {
    const { data } = await anon.rpc("place_order", { p_payload: payload() });
    const charge = `chg_${uid().replaceAll("-", "")}`;
    await service.rpc("attach_payment_charge", { p_order: data.order_id, p_provider: "mock", p_charge_id: charge });
    expect((await finance.client.rpc("payments_to_reconcile", { p_min_age_seconds: 0, p_limit: 50 })).error).not.toBeNull();
    const { data: rows, error } = await service.rpc("payments_to_reconcile", { p_min_age_seconds: 0, p_limit: 200 });
    expect(error).toBeNull();
    expect(rows.some((r: { provider_id: string; kind: string }) => r.kind === "charge" && r.provider_id === charge)).toBe(true);
  });

  it("an online order whose payment page never opened is cancelled at once and its stock returned", async () => {
    const before = (await service.from("inventory").select("on_hand").eq("variant_id", variantId).single()).data!.on_hand;
    const { data } = await anon.rpc("place_order", { p_payload: payload({ email: "abandon@example.test" }, 2) });
    expect((await anon.rpc("abandon_unstarted_payment", { p_order: data.order_id })).error).not.toBeNull();
    const r = await service.rpc("abandon_unstarted_payment", { p_order: data.order_id });
    expect(r.data).toBe(true);
    const { data: o } = await service.from("orders").select("status").eq("id", data.order_id).single();
    expect(o!.status).toBe("cancelled");
    expect((await service.from("inventory").select("on_hand").eq("variant_id", variantId).single()).data!.on_hand).toBe(before);
  });

  it("never abandons an order that already has a provider charge", async () => {
    const { data } = await anon.rpc("place_order", { p_payload: payload() });
    await service.rpc("attach_payment_charge", { p_order: data.order_id, p_provider: "mock", p_charge_id: `chg_${uid().replaceAll("-", "")}` });
    expect((await service.rpc("abandon_unstarted_payment", { p_order: data.order_id })).data).toBe(false);
    const { data: o } = await service.from("orders").select("status").eq("id", data.order_id).single();
    expect(o!.status).toBe("awaiting_payment");
  });

  it("the customer order view includes the timeline and refunds", async () => {
    const order = await paidOrder();
    const { data } = await anon.rpc("get_order_for_customer", { order_number: order.number, token: order.access_token });
    expect(data.timeline.map((t: { status: string }) => t.status)).toEqual(["awaiting_payment", "paid"]);
    expect(data.refunded_fils).toBe(0);
  });
});
