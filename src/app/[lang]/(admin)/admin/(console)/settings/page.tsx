import type { Metadata } from "next";
import { format } from "@/i18n/format";
import { createClient } from "@/lib/supabase/server";
import { isServiceConfigured } from "@/lib/supabase/service";
import { requireStaff } from "@/features/admin/auth/dal";
import { filsToKwdInput } from "@/features/admin/format";
import { getAdminDictionary } from "@/features/admin/i18n";
import { CheckoutSettingsForm, RateForm, ZoneForm } from "@/features/admin/settings/commerce-forms";
import { SettingsForm } from "@/features/admin/settings/settings-form";
import { AdminPageHeader, Badge, Notice, Panel } from "@/features/admin/ui/primitives";
import { getPaymentsConfig } from "@/features/payments/config";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminDictionary();
  return { title: t.settings.title };
}

export default async function SettingsPage() {
  await requireStaff("settings.write");
  const { locale, t } = await getAdminDictionary();
  const c = t.commerce;
  const supabase = await createClient();
  const [{ data }, { data: zones }] = await Promise.all([
    supabase.from("store_settings").select("*").eq("id", 1).single(),
    supabase.from("shipping_zones").select("*, shipping_rates(*)").order("position").order("created_at"),
  ]);
  const payments = getPaymentsConfig();
  const providerNote =
    payments.kind === "tap" && isServiceConfigured()
      ? { tone: "success" as const, text: format(c.payments.providerReady, { mode: payments.live ? c.payments.live : c.payments.test }) }
      : payments.kind === "mock"
        ? { tone: "warning" as const, text: c.payments.providerMock }
        : { tone: "gold" as const, text: c.payments.providerMissing };
  const anyActive = (zones ?? []).some((z) => z.is_active && z.shipping_rates.some((r) => r.is_active));

  return (
    <div className="space-y-6">
      <AdminPageHeader title={t.settings.title} body={t.settings.body} />

      <Panel title={c.payments.title}>
        <div className="space-y-4">
          <Notice tone={providerNote.tone}>
            <strong className="font-medium">{c.payments.providerStatus}: </strong>
            {providerNote.text}
          </Notice>
          {data ? (
            <CheckoutSettingsForm
              values={{
                cod_enabled: data.cod_enabled,
                online_payments_enabled: data.online_payments_enabled,
                order_expiry_minutes: data.order_expiry_minutes,
                delivery_note_ar: data.delivery_note_ar,
                delivery_note_en: data.delivery_note_en,
              }}
            />
          ) : null}
        </div>
      </Panel>

      <Panel title={c.delivery.title} description={c.delivery.body}>
        <div className="space-y-6">
          {!anyActive ? <Notice tone="warning">{c.delivery.warning}</Notice> : null}
          {(zones ?? []).map((zone) => (
            <section key={zone.id} className="space-y-4 rounded-2xl border border-ink/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium text-ink">{locale === "ar" ? zone.name_ar : zone.name_en}</h3>
                <Badge tone={zone.is_active ? "success" : "neutral"}>{zone.is_active ? c.delivery.active : c.delivery.inactive}</Badge>
              </div>
              <ZoneForm
                values={{
                  id: zone.id,
                  name_ar: zone.name_ar,
                  name_en: zone.name_en,
                  governorates: zone.governorates,
                  areas: zone.areas,
                  is_active: zone.is_active,
                  position: zone.position,
                }}
              />
              <div className="space-y-3 border-t border-ink/8 pt-4">
                <p className="text-step--1 font-medium text-ink">{c.delivery.rates}</p>
                {zone.shipping_rates.length === 0 ? <p className="text-step--1 text-ink-soft">{c.delivery.noRates}</p> : null}
                {zone.shipping_rates.map((rate) => (
                  <RateForm
                    key={rate.id}
                    values={{
                      id: rate.id,
                      zoneId: zone.id,
                      name_ar: rate.name_ar,
                      name_en: rate.name_en,
                      price: filsToKwdInput(rate.price_fils),
                      freeOver: rate.free_over_fils ? filsToKwdInput(rate.free_over_fils) : "",
                      minDays: rate.min_days,
                      maxDays: rate.max_days,
                      is_active: rate.is_active,
                    }}
                  />
                ))}
                <details>
                  <summary className="cursor-pointer text-step--1 text-gold-deep">{c.delivery.newRate}</summary>
                  <div className="mt-3">
                    <RateForm values={{ zoneId: zone.id, name_ar: "", name_en: "", price: "", freeOver: "", minDays: 1, maxDays: 3, is_active: true }} />
                  </div>
                </details>
              </div>
            </section>
          ))}
          <details className="rounded-2xl border border-dashed border-gold/50 p-4">
            <summary className="cursor-pointer text-step--1 text-gold-deep">{c.delivery.newZone}</summary>
            <div className="mt-4">
              <ZoneForm values={{ name_ar: "", name_en: "", governorates: [], areas: [], is_active: false, position: (zones ?? []).length }} />
            </div>
          </details>
        </div>
      </Panel>

      <Panel title={t.settings.title}>
        <SettingsForm
          values={
            data
              ? {
                  contact_email: data.contact_email,
                  contact_phone: data.contact_phone,
                  whatsapp_number: data.whatsapp_number,
                  instagram_handle: data.instagram_handle,
                  default_low_stock_threshold: data.default_low_stock_threshold,
                }
              : {}
          }
        />
      </Panel>
    </div>
  );
}
