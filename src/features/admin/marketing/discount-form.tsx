"use client";

import { useActionState } from "react";
import { useAdminI18n } from "@/features/admin/i18n/client";
import { ActionMessage, idle, SubmitButton, type ActionResult } from "@/features/admin/ui/form";
import { Checkbox, Field, Select, TextInput } from "@/features/admin/ui/primitives";
import { saveDiscountCode } from "./actions";

export type DiscountValues = {
  id?: string;
  code: string;
  kind: "percentage" | "fixed";
  value: string;
  minimum: string;
  starts: string;
  ends: string;
  limit: string;
  active: boolean;
};

export function DiscountForm({ values, compact }: { values: DiscountValues; compact?: boolean }) {
  const { locale, t } = useAdminI18n();
  const c = t.commerce.discounts;
  const [state, action] = useActionState<ActionResult, FormData>(saveDiscountCode, idle);
  const p = values.id ?? "new";
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="entity_id" value={values.id ?? ""} />
      <div className={compact ? "grid gap-3 sm:grid-cols-4" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-4"}>
        <Field label={c.code} htmlFor={`${p}-code`} hint={compact ? undefined : c.codeHint}>
          <TextInput id={`${p}-code`} name="code" defaultValue={values.code} required dir="ltr" className="uppercase" maxLength={24} />
        </Field>
        <Field label={c.kind} htmlFor={`${p}-kind`}>
          <Select id={`${p}-kind`} name="kind" defaultValue={values.kind}>
            <option value="percentage">{c.percentage}</option>
            <option value="fixed">{c.fixed}</option>
          </Select>
        </Field>
        <Field label={c.value} htmlFor={`${p}-value`} hint={compact ? undefined : c.valueHint}>
          <TextInput id={`${p}-value`} name="value" defaultValue={values.value} required inputMode="decimal" dir="ltr" />
        </Field>
        <Field label={c.minimum} htmlFor={`${p}-min`}>
          <TextInput id={`${p}-min`} name="minimum" defaultValue={values.minimum} inputMode="decimal" dir="ltr" placeholder="0.000" />
        </Field>
        <Field label={c.starts} htmlFor={`${p}-starts`}>
          <TextInput id={`${p}-starts`} name="starts" type="datetime-local" defaultValue={values.starts} dir="ltr" />
        </Field>
        <Field label={c.ends} htmlFor={`${p}-ends`}>
          <TextInput id={`${p}-ends`} name="ends" type="datetime-local" defaultValue={values.ends} dir="ltr" />
        </Field>
        <Field label={c.limit} htmlFor={`${p}-limit`} hint={compact ? undefined : c.limitHint}>
          <TextInput id={`${p}-limit`} name="limit" type="number" min={1} defaultValue={values.limit} dir="ltr" />
        </Field>
        <Checkbox name="active" label={c.active} defaultChecked={values.active} className="sm:mt-8" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton size="sm">{c.save}</SubmitButton>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}
