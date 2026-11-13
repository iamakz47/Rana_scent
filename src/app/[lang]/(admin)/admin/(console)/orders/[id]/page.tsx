import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { format } from "@/i18n/format";
import { formatKWD } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { can, requireStaff } from "@/features/admin/auth/dal";
import { filsToKwdInput, formatDateTime } from "@/features/admin/format";
import { getAdminDictionary } from "@/features/admin/i18n";
import {
  NoteForm,
  RefundRequestForm,
  RefundResolveForm,
  StatusControls,
  TrackingForm,
} from "@/features/admin/orders/order-controls";
import { cancellableStatuses, orderStatusTone, staffNextStatuses } from "@/features/admin/orders/transitions";
import { AdminPageHeader, Badge, Panel } from "@/features/admin/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminDictionary();
  return { title: t.commerce.orders.title };
}

export default async function OrderDetailPage({ params }: PageProps<"/[lang]/admin/orders/[id]">) {
  const staff = await requireStaff("orders.read");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { locale, t } = await getAdminDictionary();
  const c = t.commerce;
  const supabase = await createClient();
  const [{ data: order }, { data: history }, { data: notes }, { data: refunds }, team] = await Promise.all([
    supabase
      .from("orders")
      .select("*, order_items(*), payments(*)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("order_status_history").select("*").eq("order_id", id).order("created_at"),
    supabase.from("order_notes").select("*").eq("order_id", id).order("created_at"),
    supabase.from("refund_requests").select("*").eq("order_id", id).order("created_at"),
    can(staff, "staff.read") ? supabase.rpc("list_staff") : Promise.resolve({ data: [] as Array<{ user_id: string; display_name: string; email: string }> }),
  ]);
  if (!order) notFound();

  const names = new Map((team.data ?? []).map((m) => [m.user_id, m.display_name || m.email]));
  const who = (actor: string | null) => (actor ? (names.get(actor) ?? t.dashboard.someone) : c.orders.system);
  const money = (fils: number) => formatKWD(fils, locale);
  const address = order.shipping_address as Record<string, string>;
  const governorate = (key: string) =>
    ({
      capital: locale === "ar" ? "العاصمة" : "Capital",
      hawalli: locale === "ar" ? "حولي" : "Hawalli",
      farwaniya: locale === "ar" ? "الفروانية" : "Farwaniya",
      ahmadi: locale === "ar" ? "الأحمدي" : "Ahmadi",
      jahra: locale === "ar" ? "الجهراء" : "Jahra",
      mubarak_al_kabeer: locale === "ar" ? "مبارك الكبير" : "Mubarak Al-Kabeer",
    })[key] ?? key;
  const L =
    locale === "ar"
      ? { block: "قطعة", street: "شارع", avenue: "جادة", building: "مبنى", floor: "دور", apartment: "شقة" }
      : { block: "Block", street: "Street", avenue: "Avenue", building: "Building", floor: "Floor", apartment: "Apt" };
  const captured = order.payments.filter((p) => p.status === "captured").reduce((sum, p) => sum + p.amount_fils, 0);
  const requested = (refunds ?? []).filter((r) => r.status !== "rejected").reduce((sum, r) => sum + r.amount_fils, 0);
  const timeline = [
    ...(history ?? []).map((h) => ({
      at: h.created_at,
      text: `${h.from_status ? `${c.statuses[h.from_status]} → ` : ""}${c.statuses[h.to_status]}`,
      by: who(h.actor_id),
      note: false,
    })),
    ...(notes ?? []).map((n) => ({ at: n.created_at, text: n.body, by: who(n.actor_id), note: true })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const writable = can(staff, "orders.write");

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow={c.orders.title}
        title={format(c.orders.detailTitle, { number: order.number })}
        body={formatDateTime(order.created_at, locale)}
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge tone={orderStatusTone(order.status)}>{c.statuses[order.status]}</Badge>
            <Badge>{c.methods[order.payment_method]}</Badge>
          </div>
        }
      />

      {writable ? (
        <Panel title={c.orders.fulfilment}>
          <StatusControls
            id={order.id}
            next={staffNextStatuses[order.status] ?? []}
            canCancel={cancellableStatuses.has(order.status)}
          />
          {!(staffNextStatuses[order.status] ?? []).length && !cancellableStatuses.has(order.status) ? (
            <p className="text-step--1 text-ink-soft">{c.statuses[order.status]}</p>
          ) : null}
        </Panel>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Panel title={c.orders.items}>
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[30rem] text-step--1">
              <thead className="text-[0.7rem] uppercase tracking-[0.14em] text-ink-soft">
                <tr>
                  <th className="pb-2 text-start font-medium">{c.orders.items}</th>
                  <th className="pb-2 text-end font-medium">{c.orders.qty}</th>
                  <th className="pb-2 text-end font-medium">{c.orders.unit}</th>
                  <th className="pb-2 text-end font-medium">{c.orders.line}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/8">
                {order.order_items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 pe-3">
                      {locale === "ar" ? item.name_ar : item.name_en}
                      <span className="block text-[0.75rem] text-ink-soft">
                        {locale === "ar" ? item.variant_label_ar : item.variant_label_en} · <span dir="ltr">{item.sku}</span>
                      </span>
                    </td>
                    <td className="py-2 text-end tabular-nums">{item.quantity}</td>
                    <td className="py-2 text-end tabular-nums">{money(item.unit_price_fils)}</td>
                    <td className="py-2 text-end tabular-nums">{money(item.line_total_fils)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="mt-4 space-y-1 border-t border-ink/8 pt-3 text-step--1">
            {[
              [c.orders.subtotal, money(order.subtotal_fils)],
              ...(order.discount_fils ? [[c.orders.discount, `−${money(order.discount_fils)}`]] : []),
              [c.orders.delivery, money(order.shipping_fils)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <dt className="text-ink-soft">{label}</dt>
                <dd className="tabular-nums">{value}</dd>
              </div>
            ))}
            <div className="flex justify-between pt-1 text-step-0">
              <dt>{c.orders.grandTotal}</dt>
              <dd className="tabular-nums text-gold-deep">{money(order.total_fils)}</dd>
            </div>
          </dl>
        </Panel>

        <Panel title={c.orders.customerTitle}>
          <dl className="space-y-3 text-step--1">
            <div>
              <dt className="text-ink-soft">{c.orders.customer}</dt>
              <dd dir="auto">{order.customer_name}</dd>
            </div>
            <div>
              <dt className="text-ink-soft">{c.orders.phone}</dt>
              <dd dir="ltr" className="text-start">
                <a href={`tel:${order.phone}`} className="underline-offset-4 hover:underline">
                  {order.phone}
                </a>
              </dd>
            </div>
            {order.email ? (
              <div>
                <dt className="text-ink-soft">{c.orders.email}</dt>
                <dd dir="ltr" className="break-all text-start">
                  {order.email}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-ink-soft">{c.orders.address}</dt>
              <dd>
                {[governorate(address.governorate), address.area, `${L.block} ${address.block}`, `${L.street} ${address.street}`,
                  address.avenue ? `${L.avenue} ${address.avenue}` : "", `${L.building} ${address.building}`,
                  address.floor ? `${L.floor} ${address.floor}` : "", address.apartment ? `${L.apartment} ${address.apartment}` : ""]
                  .filter(Boolean)
                  .join(locale === "ar" ? "، " : ", ")}
              </dd>
            </div>
            {order.delivery_instructions ? (
              <div>
                <dt className="text-ink-soft">{c.orders.instructions}</dt>
                <dd>{order.delivery_instructions}</dd>
              </div>
            ) : null}
            {order.customer_note ? (
              <div>
                <dt className="text-ink-soft">{c.orders.customerNote}</dt>
                <dd>{order.customer_note}</dd>
              </div>
            ) : null}
          </dl>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={c.orders.paymentTitle}>
          {order.payments.length === 0 ? (
            <p className="text-step--1 text-ink-soft">{c.orders.noPayments}</p>
          ) : (
            <ul className="space-y-3 text-step--1">
              {order.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <Badge tone={p.status === "captured" ? "success" : p.status === "failed" ? "danger" : "neutral"}>
                      {c.paymentStatuses[p.status]}
                    </Badge>{" "}
                    <span className="text-ink-soft">{p.method ?? p.provider}</span>
                    {p.provider_charge_id ? (
                      <span className="block text-[0.72rem] text-ink-soft" dir="ltr">
                        {c.orders.charge}: {p.provider_charge_id}
                        {p.provider_reference ? ` · ${c.orders.reference}: ${p.provider_reference}` : ""}
                      </span>
                    ) : null}
                  </span>
                  <span className="tabular-nums">{money(p.amount_fils)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={c.orders.tracking}>
          {writable ? (
            <TrackingForm
              id={order.id}
              courier={order.courier}
              trackingNumber={order.tracking_number}
              eta={order.estimated_delivery ?? ""}
            />
          ) : (
            <p className="text-step--1">
              {order.courier} {order.tracking_number}
            </p>
          )}
        </Panel>
      </div>

      <Panel title={c.orders.refundTitle}>
        <div className="space-y-4">
          {(refunds ?? []).length === 0 ? <p className="text-step--1 text-ink-soft">{c.orders.refundNone}</p> : null}
          {(refunds ?? []).map((r) => (
            <div key={r.id} className="rounded-xl border border-ink/10 p-3 text-step--1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <Badge tone={r.status === "processed" ? "success" : r.status === "rejected" ? "neutral" : "warning"}>
                    {c.orders.refundStatus[r.status]}
                  </Badge>{" "}
                  {r.reason}
                </span>
                <span className="tabular-nums">{money(r.amount_fils)}</span>
              </div>
              {r.status === "requested" && can(staff, "finance.write") ? <RefundResolveForm id={order.id} refundId={r.id} /> : null}
            </div>
          ))}
          {captured > 0 && captured - requested > 0 && (writable || can(staff, "finance.write")) ? (
            <RefundRequestForm id={order.id} maxKwd={filsToKwdInput(captured - requested)} />
          ) : captured === 0 ? (
            <p className="text-[0.78rem] text-ink-soft">{c.orders.paidOnlyRefund}</p>
          ) : null}
        </div>
      </Panel>

      <Panel title={c.orders.timeline}>
        <ol className="space-y-3">
          {timeline.map((entry, index) => (
            <li key={index} className="flex flex-wrap items-baseline justify-between gap-x-4 text-step--1">
              <span className={entry.note ? "text-ink" : "text-ink"}>
                {entry.note ? <span className="me-1 text-gold-deep">{c.orders.staffNote}:</span> : null}
                {entry.text} <span className="text-ink-soft">· {entry.by}</span>
              </span>
              <time dateTime={entry.at} className="text-[0.75rem] tabular-nums text-ink-soft">
                {formatDateTime(entry.at, locale)}
              </time>
            </li>
          ))}
        </ol>
        {writable ? (
          <div className="mt-5 border-t border-ink/8 pt-4">
            <NoteForm id={order.id} />
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
