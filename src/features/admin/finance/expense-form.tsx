"use client";

import { useActionState } from "react";
import { useAdminI18n } from "@/features/admin/i18n/client";
import { ActionMessage, idle, SubmitButton, type ActionResult } from "@/features/admin/ui/form";
import { Field, Select, TextInput } from "@/features/admin/ui/primitives";
import { addExpense } from "./actions";

export function ExpenseForm({ today }: { today: string }) {
  const { locale, t } = useAdminI18n();
  const c = t.commerce.finance;
  const [state, action] = useActionState<ActionResult, FormData>(addExpense, idle);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label={c.category} htmlFor="exp-category">
          <Select id="exp-category" name="category" defaultValue="inventory">
            {Object.entries(c.categories).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={c.description} htmlFor="exp-description" className="lg:col-span-2">
          <TextInput id="exp-description" name="description" required maxLength={300} />
        </Field>
        <Field label={c.amount} htmlFor="exp-amount">
          <TextInput id="exp-amount" name="amount" required inputMode="decimal" dir="ltr" placeholder="0.000" />
        </Field>
        <Field label={c.date} htmlFor="exp-date">
          <TextInput id="exp-date" name="incurred_on" type="date" required defaultValue={today} dir="ltr" />
        </Field>
        <Field label={c.vendor} htmlFor="exp-vendor" className="lg:col-span-2">
          <TextInput id="exp-vendor" name="vendor" maxLength={120} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton size="sm">{c.addExpense}</SubmitButton>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}
