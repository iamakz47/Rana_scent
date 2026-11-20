import "server-only";
import { after } from "next/server";
import type { Locale } from "@/i18n/config";
import { createServiceClient, isServiceConfigured } from "@/lib/supabase/service";
import { appOrigin } from "@/features/admin/auth/origin";
import { renderEmail, type EmailKind, type EmailOrder } from "./templates";
import { transportFor } from "./transport";

// Sends queued emails from public.email_messages. Safe to run concurrently
// (rows are claimed with SKIP LOCKED) and repeatedly (each row is sent once;
// Resend's idempotency key covers a crash between sending and recording).
// Never throws: email problems must not affect orders or payments.

type Message = {
  id: string;
  kind: string;
  audience: "customer" | "staff";
  to_email: string;
  locale: string;
  order_id: string | null;
  refund_id: string | null;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
};

type Db = ReturnType<typeof createServiceClient>;

// "Free fragrances: Device 1: Oud, Musk; Device 2: …" (choices are preferences
// confirmed on delivery; they carry no charge).
function freeFragranceText(rows: Array<{ device_no: number; slot: number; name_ar: string; name_en: string }>, locale: Locale): string {
  if (!rows.length) return "";
  const devices = [...new Set(rows.map((r) => r.device_no))].sort((a, b) => a - b);
  const parts = devices.map((device) => {
    const names = rows
      .filter((r) => r.device_no === device)
      .sort((a, b) => a.slot - b.slot)
      .map((r) => (locale === "ar" ? r.name_ar : r.name_en))
      .join(locale === "ar" ? "، " : ", ");
    return devices.length > 1 ? `${locale === "ar" ? "الجهاز" : "Device"} ${device}: ${names}` : names;
  });
  return `${locale === "ar" ? "عطور مجانية" : "Free fragrances"}: ${parts.join("; ")}`;
}

async function loadOrder(db: Db, orderId: string, locale: Locale) {
  const { data: o } = await db
    .from("orders")
    .select(
      "id, number, access_token, customer_name, phone, payment_method, subtotal_fils, discount_fils, shipping_fils, total_fils, refunded_fils, shipping_address, courier, tracking_number, estimated_delivery, order_items(name_ar, name_en, variant_label_ar, variant_label_en, quantity, line_total_fils, order_item_fragrances(device_no, slot, name_ar, name_en)), payments(method, status, created_at)",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!o) return null;
  const payments = [...(o.payments ?? [])].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const order: EmailOrder = {
    number: o.number,
    customerName: o.customer_name,
    phone: o.phone,
    paymentMethod: o.payment_method === "cod" ? "cod" : "tap",
    paymentLabel: payments[0]?.method ? payments[0].method.toUpperCase() : null,
    subtotalFils: o.subtotal_fils,
    discountFils: o.discount_fils,
    shippingFils: o.shipping_fils,
    totalFils: o.total_fils,
    refundedFils: o.refunded_fils,
    items: (o.order_items ?? []).map((i) => ({
      name: locale === "ar" ? i.name_ar : i.name_en,
      label: [locale === "ar" ? i.variant_label_ar : i.variant_label_en, freeFragranceText(i.order_item_fragrances ?? [], locale)]
        .filter(Boolean)
        .join(" · "),
      quantity: i.quantity,
      lineTotalFils: i.line_total_fils,
    })),
    address: o.shipping_address as EmailOrder["address"],
    courier: o.courier,
    trackingNumber: o.tracking_number,
    estimatedDelivery: o.estimated_delivery,
  };
  return { order, id: o.id, token: o.access_token as string };
}

async function render(db: Db, m: Message, origin: string) {
  const locale: Locale = m.locale === "en" ? "en" : "ar";
  const loaded = m.order_id ? await loadOrder(db, m.order_id, locale) : null;
  if (m.order_id && !loaded) return null;
  let refundFils: number | undefined;
  let reason: string | undefined = typeof m.payload.reason === "string" ? m.payload.reason : undefined;
  if (m.refund_id) {
    const { data: r } = await db.from("refund_requests").select("amount_fils, reason").eq("id", m.refund_id).maybeSingle();
    refundFils = r?.amount_fils;
    if (m.kind === "staff_refund_requested") reason = r?.reason;
  }
  let stock: { sku: string; name: string; onHand: number; threshold: number } | undefined;
  if (m.kind === "staff_low_stock" && typeof m.payload.variant_id === "string") {
    const { data: v } = await db
      .from("product_variants")
      .select("sku, label_ar, label_en, products(name_ar, name_en)")
      .eq("id", m.payload.variant_id)
      .maybeSingle();
    stock = {
      sku: v?.sku ?? "",
      name: v ? `${locale === "ar" ? v.products?.name_ar : v.products?.name_en} ${locale === "ar" ? v.label_ar : v.label_en}` : "",
      onHand: Number(m.payload.on_hand ?? 0),
      threshold: Number(m.payload.threshold ?? 0),
    };
  }
  return renderEmail(m.kind as EmailKind, {
    locale,
    order: loaded?.order,
    orderUrl: loaded ? `${origin}/${locale}/order?n=${loaded.order.number}&t=${loaded.token}` : undefined,
    adminUrl: m.kind === "staff_low_stock" ? `${origin}/${locale}/admin/inventory` : loaded ? `${origin}/${locale}/admin/orders/${loaded.id}` : undefined,
    storeUrl: `${origin}/${locale}/cart`,
    refundFils,
    reason,
    expired: m.payload.expired === true,
    stock,
  });
}

export async function dispatchEmails(limit = 20): Promise<{ sent: number; failed: number; suppressed: number }> {
  const result = { sent: 0, failed: 0, suppressed: 0 };
  if (!isServiceConfigured()) return result;
  try {
    const db = createServiceClient();
    const origin = await appOrigin();
    const { data: batch } = await db.rpc("claim_email_batch", { p_limit: limit });
    for (const m of (batch ?? []) as Message[]) {
      try {
        const email = await render(db, m, origin);
        if (!email) {
          await db.rpc("finish_email", { p_id: m.id, p_ok: false, p_provider: "", p_provider_message_id: "", p_subject: "", p_error: "Order not found" });
          await db.from("email_messages").update({ attempts: m.max_attempts }).eq("id", m.id);
          result.failed++;
          continue;
        }
        const transport = transportFor(m.to_email);
        if (!transport) {
          await db.rpc("finish_email", { p_id: m.id, p_ok: true, p_provider: "suppressed", p_provider_message_id: "", p_subject: email.subject, p_error: "" });
          result.suppressed++;
          continue;
        }
        const sent = await transport.send({ to: m.to_email, ...email, idempotencyKey: m.id });
        if (sent.ok) {
          await db.rpc("finish_email", { p_id: m.id, p_ok: true, p_provider: sent.provider, p_provider_message_id: sent.messageId, p_subject: email.subject, p_error: "" });
          result.sent++;
        } else {
          await db.rpc("finish_email", { p_id: m.id, p_ok: false, p_provider: sent.provider, p_provider_message_id: "", p_subject: email.subject, p_error: sent.error });
          if (!sent.retryable) await db.from("email_messages").update({ attempts: m.max_attempts }).eq("id", m.id);
          result.failed++;
        }
      } catch (error) {
        await db.rpc("finish_email", {
          p_id: m.id, p_ok: false, p_provider: "", p_provider_message_id: "", p_subject: "",
          p_error: error instanceof Error ? error.message.slice(0, 200) : "Unexpected error",
        });
        result.failed++;
      }
    }
  } catch {
    // Outbox unavailable: messages stay queued for the next run.
  }
  return result;
}

// Sends queued emails after the current response, without delaying it.
export function scheduleEmailDispatch(): void {
  try {
    after(() => dispatchEmails(20).then(() => undefined));
  } catch {
    // Outside a request scope (tests): the cron run will pick them up.
  }
}
