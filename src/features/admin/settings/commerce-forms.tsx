"use client";

import { useActionState } from "react";
import { useAdminI18n } from "@/features/admin/i18n/client";
import { ActionMessage, idle, SubmitButton, type ActionResult } from "@/features/admin/ui/form";
import { BilingualFields, Checkbox, Field, TextArea, TextInput } from "@/features/admin/ui/primitives";
import { saveCheckoutSettings, saveRate, saveZone } from "./commerce-actions";

const governorates = ["capital", "hawalli", "farwaniya", "ahmadi", "jahra", "mubarak_al_kabeer"] as const;
const governorateNames = {
  ar: { capital: "العاصمة", hawalli: "حولي", farwaniya: "الفروانية", ahmadi: "الأحمدي", jahra: "الجهراء", mubarak_al_kabeer: "مبارك الكبير" },
  en: { capital: "Capital", hawalli: "Hawalli", farwaniya: "Farwaniya", ahmadi: "Ahmadi", jahra: "Jahra", mubarak_al_kabeer: "Mubarak Al-Kabeer" },
};

export function CheckoutSettingsForm({
  values,
}: {
  values: { cod_enabled: boolean; online_payments_enabled: boolean; order_expiry_minutes: number; delivery_note_ar: string; delivery_note_en: string };
}) {
  const { locale, t } = useAdminI18n();
  const c = t.commerce.payments;
  const [state, action] = useActionState<ActionResult, FormData>(saveCheckoutSettings, idle);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <div className="flex flex-wrap gap-x-8 gap-y-3">
        <Checkbox name="online_payments_enabled" label={c.online} hint={c.onlineHint} defaultChecked={values.online_payments_enabled} />
        <Checkbox name="cod_enabled" label={c.cod} defaultChecked={values.cod_enabled} />
      </div>
      <Field label={c.expiry} htmlFor="order_expiry_minutes" hint={c.expiryHint} className="max-w-xs">
        <TextInput id="order_expiry_minutes" name="order_expiry_minutes" type="number" min={10} max={240} defaultValue={values.order_expiry_minutes} dir="ltr" />
      </Field>
      <BilingualFields
        name="delivery_note"
        label={c.deliveryNote}
        values={{ ar: values.delivery_note_ar, en: values.delivery_note_en }}
        maxLength={300}
        labels={{ ar: t.common.arabic, en: t.common.english }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton size="sm">{t.common.save}</SubmitButton>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

export type ZoneValues = {
  id?: string;
  name_ar: string;
  name_en: string;
  governorates: string[];
  areas: string[];
  is_active: boolean;
  position: number;
};

export function ZoneForm({ values }: { values: ZoneValues }) {
  const { locale, t } = useAdminI18n();
  const c = t.commerce.delivery;
  const [state, action] = useActionState<ActionResult, FormData>(saveZone, idle);
  const p = values.id ?? "new-zone";
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="entity_id" value={values.id ?? ""} />
      <input type="hidden" name="position" value={values.position} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={`${c.zoneName} (${t.common.arabic})`} htmlFor={`${p}-ar`}>
          <TextInput id={`${p}-ar`} name="name_ar" defaultValue={values.name_ar} required dir="rtl" lang="ar" maxLength={80} />
        </Field>
        <Field label={`${c.zoneName} (${t.common.english})`} htmlFor={`${p}-en`}>
          <TextInput id={`${p}-en`} name="name_en" defaultValue={values.name_en} required dir="ltr" lang="en" maxLength={80} />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-2 text-step--1 font-medium text-ink">{c.governorates}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {governorates.map((g) => (
            <Checkbox key={g} name="governorates" value={g} label={governorateNames[locale][g]} defaultChecked={values.governorates.includes(g)} />
          ))}
        </div>
      </fieldset>
      <Field label={c.areas} htmlFor={`${p}-areas`} hint={c.areasHint}>
        <TextArea id={`${p}-areas`} name="areas" rows={3} defaultValue={values.areas.join("\n")} />
      </Field>
      <Checkbox name="is_active" label={c.active} defaultChecked={values.is_active} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton size="sm">{c.saveZone}</SubmitButton>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

export type RateValues = {
  id?: string;
  zoneId: string;
  name_ar: string;
  name_en: string;
  price: string;
  freeOver: string;
  minDays: number;
  maxDays: number;
  is_active: boolean;
};

export function RateForm({ values }: { values: RateValues }) {
  const { locale, t } = useAdminI18n();
  const c = t.commerce.delivery;
  const [state, action] = useActionState<ActionResult, FormData>(saveRate, idle);
  const p = values.id ?? `new-rate-${values.zoneId}`;
  return (
    <form action={action} className="space-y-3 rounded-xl border border-ink/10 bg-surface/50 p-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="entity_id" value={values.zoneId} />
      <input type="hidden" name="rate_id" value={values.id ?? ""} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={`${c.rateName} (${t.common.arabic})`} htmlFor={`${p}-ar`}>
          <TextInput id={`${p}-ar`} name="name_ar" defaultValue={values.name_ar} required dir="rtl" lang="ar" maxLength={80} />
        </Field>
        <Field label={`${c.rateName} (${t.common.english})`} htmlFor={`${p}-en`}>
          <TextInput id={`${p}-en`} name="name_en" defaultValue={values.name_en} required dir="ltr" lang="en" maxLength={80} />
        </Field>
        <Field label={c.price} htmlFor={`${p}-price`}>
          <TextInput id={`${p}-price`} name="price" defaultValue={values.price} required inputMode="decimal" dir="ltr" placeholder="0.000" />
        </Field>
        <Field label={c.freeOver} htmlFor={`${p}-free`} hint={c.freeOverHint}>
          <TextInput id={`${p}-free`} name="free_over" defaultValue={values.freeOver} inputMode="decimal" dir="ltr" />
        </Field>
        <Field label={c.minDays} htmlFor={`${p}-min`}>
          <TextInput id={`${p}-min`} name="min_days" type="number" min={0} max={60} defaultValue={values.minDays} dir="ltr" />
        </Field>
        <Field label={c.maxDays} htmlFor={`${p}-max`}>
          <TextInput id={`${p}-max`} name="max_days" type="number" min={0} max={60} defaultValue={values.maxDays} dir="ltr" />
        </Field>
      </div>
      <Checkbox name="is_active" label={c.active} defaultChecked={values.is_active} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton size="sm" tone="outline">
          {c.saveRate}
        </SubmitButton>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}
