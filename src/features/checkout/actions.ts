"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { formatKWD } from "@/lib/money";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { isServiceConfigured } from "@/lib/supabase/service";
import { appOrigin } from "@/features/admin/auth/origin";
import { sendOrderEmail } from "@/features/notifications/email";
import { onlinePaymentsAvailable } from "@/features/payments/config";
import { confirmMockOutcome, startPayment } from "@/features/payments/service";
import { cartItemsSchema, checkoutSchema, governorates, issueToErrorKey, knownCheckoutErrors } from "./schema";

export type Quote = {
  lines: Array<{ variant_id: string; unit_price_fils: number; quantity: number; available: number }>;
  subtotal_fils: number;
  discount_fils: number;
  discount_problem: string | null;
  delivery_available: boolean;
  shipping_fils: number;
  delivery_days: { min: number; max: number } | null;
  total_fils: number;
  unavailable_count: number;
  short_stock: string[];
};

export type QuoteResult = { ok: true; quote: Quote } | { ok: false; error: string };

const quoteInput = z.object({
  items: cartItemsSchema,
  governorate: z.union([z.enum(governorates), z.literal("")]),
  area: z.string().trim().max(80),
  discountCode: z.string().trim().toUpperCase().max(24),
});

// Read-only price quote from the database for the order summary.
export async function quoteCheckout(input: unknown): Promise<QuoteResult> {
  const parsed = quoteInput.safeParse(input);
  if (!parsed.success || !isSupabaseConfigured()) return { ok: false, error: "cart_invalid" };
  const { data, error } = await createPublicClient().rpc("quote_order", {
    p_items: parsed.data.items,
    p_governorate: parsed.data.governorate || undefined,
    p_area: parsed.data.area,
    p_discount_code: parsed.data.discountCode,
  });
  if (error) return { ok: false, error: knownCheckoutErrors.has(error.message) ? error.message : "generic" };
  return { ok: true, quote: data as unknown as Quote };
}

export type CheckoutState = { error?: string; field?: string };

function readForm(formData: FormData) {
  const get = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };
  let items: unknown = [];
  try {
    items = JSON.parse(get("items") || "[]");
  } catch {
    items = null;
  }
  return checkoutSchema.safeParse({
    idempotency_key: get("idempotency_key"),
    locale: get("locale"),
    customer_name: get("customer_name"),
    phone: get("phone"),
    email: get("email").trim().toLowerCase(),
    governorate: get("governorate"),
    area: get("area"),
    block: get("block"),
    street: get("street"),
    avenue: get("avenue"),
    building: get("building"),
    floor: get("floor"),
    apartment: get("apartment"),
    delivery_instructions: get("delivery_instructions"),
    customer_note: get("customer_note"),
    discount_code: get("discount_code"),
    payment_method: get("payment_method"),
    items,
  });
}

// Places the order. Every amount is computed by place_order() in the
// database; the browser only says which variants and how many.
export async function placeOrder(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const parsed = readForm(formData);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issueToErrorKey(issue?.path[0]), field: String(issue?.path[0] ?? "") };
  }
  const input = parsed.data;
  if (input.payment_method === "tap" && !(onlinePaymentsAvailable() && isServiceConfigured())) {
    return { error: "payment_method_unavailable" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_order", {
    p_payload: {
      idempotency_key: input.idempotency_key,
      locale: input.locale,
      customer_name: input.customer_name,
      phone: input.phone,
      email: input.email,
      payment_method: input.payment_method,
      discount_code: input.discount_code,
      delivery_instructions: input.delivery_instructions,
      customer_note: input.customer_note,
      address: {
        governorate: input.governorate,
        area: input.area,
        block: input.block,
        street: input.street,
        avenue: input.avenue,
        building: input.building,
        floor: input.floor,
        apartment: input.apartment,
      },
      items: input.items,
    },
  });
  if (error || !data) {
    return { error: error && knownCheckoutErrors.has(error.message) ? error.message : "generic" };
  }

  const order = data as unknown as {
    order_id: string;
    number: number;
    access_token: string;
    total_fils: number;
    payment_method: "tap" | "cod";
    status: string;
    duplicate: boolean;
  };
  const orderPath = localePath(input.locale, `/order?n=${order.number}&t=${order.access_token}`);

  if (order.payment_method === "tap") {
    if (order.status !== "awaiting_payment") redirect(orderPath);
    const payment = await startPayment(order.order_id, input.locale);
    if (!payment.ok) return { error: "payment_unavailable" };
    redirect(payment.paymentUrl);
  }

  if (!order.duplicate && input.email) {
    const origin = await appOrigin();
    await sendOrderEmail({
      to: input.email,
      locale: input.locale,
      orderNumber: order.number,
      totalLabel: formatKWD(order.total_fils, input.locale),
      statusLabel: input.locale === "ar" ? "تم الاستلام" : "Received",
      orderUrl: `${origin}${orderPath}`,
    });
  }
  redirect(orderPath);
}

// Test mode only (refused when the mock provider isn't active).
export async function completeTestPayment(formData: FormData): Promise<void> {
  const charge = String(formData.get("charge") ?? "");
  const outcome = String(formData.get("outcome") ?? "");
  const localeValue = String(formData.get("locale") ?? "ar");
  const locale: Locale = isLocale(localeValue) ? localeValue : "ar";
  if (!["CAPTURED", "DECLINED", "CANCELLED"].includes(outcome)) redirect(localePath(locale, "/cart"));
  const result = await confirmMockOutcome(charge, outcome as "CAPTURED" | "DECLINED" | "CANCELLED");
  if (!result?.orderNumber || !result.token) redirect(localePath(locale, "/cart"));
  redirect(localePath(result.locale, `/order?n=${result.orderNumber}&t=${result.token}`));
}
