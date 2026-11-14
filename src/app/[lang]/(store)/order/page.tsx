import type { Metadata } from "next";
import { Suspense } from "react";
import { z } from "zod";
import { ButtonLink } from "@/components/ui/button";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import { isSupabaseConfigured } from "@/lib/env";
import { formatKWD } from "@/lib/money";
import { createPublicClient } from "@/lib/supabase/public";
import { OrderLive } from "@/features/checkout/order-live";

export const metadata: Metadata = { robots: { index: false, follow: false } };

type CustomerOrder = {
  number: number;
  status: string;
  payment_method: "tap" | "cod";
  customer_name: string;
  phone: string;
  subtotal_fils: number;
  discount_fils: number;
  shipping_fils: number;
  total_fils: number;
  shipping_address: Record<string, string>;
  tracking_number: string;
  courier: string;
  estimated_delivery: string | null;
  payment_status: string | null;
  items: Array<{ name: { ar: string; en: string }; label: { ar: string; en: string }; quantity: number; line_total_fils: number }>;
};

const params = z.object({ n: z.coerce.number().int().positive(), t: z.uuid() });

async function Order({ searchParams }: { searchParams: PageProps<"/[lang]/order">["searchParams"] }) {
  const [query, locale, dict] = await Promise.all([searchParams, getLocale(), getDictionary()]);
  const t = dict.order;
  const parsed = params.safeParse(query);
  let order: CustomerOrder | null = null;
  if (parsed.success && isSupabaseConfigured()) {
    const { data } = await createPublicClient().rpc("get_order_for_customer", {
      order_number: parsed.data.n,
      token: parsed.data.t,
    });
    order = (data as unknown as CustomerOrder | null) ?? null;
  }
  if (!order) {
    return (
      <div className="container-page py-24 text-center">
        <p className="mx-auto max-w-md text-step-1 text-ink-soft">{t.notFound}</p>
        <ButtonLink href={localePath(locale, "/shop")} className="mt-8" variant="outline">
          {t.continue}
        </ButtonLink>
      </div>
    );
  }

  const statusLabel = (t.statuses as Record<string, string>)[order.status] ?? order.status;
  const failed = order.status === "cancelled" && order.payment_method === "tap" && order.payment_status !== "captured";
  const note =
    order.status === "awaiting_payment"
      ? t.awaiting
      : failed
        ? t.failedNote
        : order.status === "cancelled"
          ? t.cancelledNote
          : order.payment_method === "cod"
            ? t.codNote
            : t.paidNote;
  const address = order.shipping_address;
  const governorates = dict.checkout.governorates as Record<string, string>;
  const addressLine = [
    governorates[address.governorate] ?? address.governorate,
    address.area,
    `${dict.checkout.block} ${address.block}`,
    `${dict.checkout.street} ${address.street}`,
    address.avenue ? `${dict.checkout.avenue} ${address.avenue}` : "",
    `${dict.checkout.building} ${address.building}`,
    address.floor ? `${dict.checkout.floor} ${address.floor}` : "",
    address.apartment ? `${dict.checkout.apartment} ${address.apartment}` : "",
  ]
    .filter(Boolean)
    .join(locale === "ar" ? "، " : ", ");

  return (
    <div className="container-page max-w-3xl py-12 sm:py-16">
      <OrderLive status={order.status} paymentMethod={order.payment_method} />
      <p className="text-[0.72rem] uppercase tracking-[0.22em] text-gold-deep">{statusLabel}</p>
      <h1 className="mt-2 font-display text-step-4 text-ink">{format(t.title, { number: order.number })}</h1>
      <p className="mt-3 text-step-1 text-ink">{format(t.thanks, { name: order.customer_name })}</p>
      <p
        role="status"
        className={
          failed
            ? "mt-4 rounded-2xl border border-[#a4493d]/30 bg-[#a4493d]/8 px-4 py-3 text-[#86352b]"
            : "mt-4 rounded-2xl border border-gold/40 bg-gold/8 px-4 py-3 text-ink"
        }
      >
        {note}
      </p>
      <p className="mt-3 text-step--1 text-ink-soft">{t.saveLink}</p>

      <section aria-labelledby="order-items" className="mt-10 rounded-[1.75rem] border border-ink/10 bg-canvas p-6">
        <h2 id="order-items" className="font-display text-step-2 text-ink">
          {t.items}
        </h2>
        <ul className="mt-4 divide-y divide-ink/8">
          {order.items.map((item, index) => (
            <li key={index} className="flex justify-between gap-4 py-3">
              <span className="min-w-0">
                <span className="block text-ink">{item.name[locale]}</span>
                <span className="block text-step--1 text-ink-soft">
                  {item.label[locale]} × {item.quantity}
                </span>
              </span>
              <span className="tabular-nums text-ink">{formatKWD(item.line_total_fils, locale)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1.5 border-t border-ink/10 pt-4 text-step--1">
          <div className="flex justify-between">
            <dt className="text-ink-soft">{dict.checkout.subtotal}</dt>
            <dd className="tabular-nums">{formatKWD(order.subtotal_fils, locale)}</dd>
          </div>
          {order.discount_fils > 0 ? (
            <div className="flex justify-between">
              <dt className="text-ink-soft">{dict.checkout.discountLine}</dt>
              <dd className="tabular-nums">−{formatKWD(order.discount_fils, locale)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-ink-soft">{dict.checkout.deliveryFee}</dt>
            <dd className="tabular-nums">{order.shipping_fils === 0 ? dict.checkout.free : formatKWD(order.shipping_fils, locale)}</dd>
          </div>
          <div className="flex justify-between pt-2 text-step-0">
            <dt className="text-ink">{dict.checkout.total}</dt>
            <dd className="tabular-nums text-gold-deep">{formatKWD(order.total_fils, locale)}</dd>
          </div>
        </dl>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <section className="rounded-[1.5rem] border border-ink/10 bg-canvas p-5">
          <h2 className="text-step--1 font-medium text-ink-soft">{t.deliverTo}</h2>
          <p className="mt-2 text-ink">{addressLine}</p>
          <p className="mt-1 text-step--1 text-ink-soft" dir="ltr">
            {order.phone}
          </p>
        </section>
        <section className="rounded-[1.5rem] border border-ink/10 bg-canvas p-5">
          <h2 className="text-step--1 font-medium text-ink-soft">{t.payment}</h2>
          <p className="mt-2 text-ink">{t.methods[order.payment_method]}</p>
          {order.tracking_number ? (
            <p className="mt-3 text-step--1 text-ink-soft">
              {t.tracking}: {order.courier} <span dir="ltr">{order.tracking_number}</span>
            </p>
          ) : null}
          {order.estimated_delivery ? (
            <p className="mt-1 text-step--1 text-ink-soft">
              {t.estimated}: {order.estimated_delivery}
            </p>
          ) : null}
        </section>
      </div>

      <ButtonLink href={localePath(locale, failed ? "/cart" : "/shop")} className="mt-10" variant="outline">
        {failed ? t.retry : t.continue}
      </ButtonLink>
    </div>
  );
}

export default function OrderPage({ searchParams }: PageProps<"/[lang]/order">) {
  return (
    <Suspense fallback={<div className="container-page py-24" aria-busy />}>
      <Order searchParams={searchParams} />
    </Suspense>
  );
}
