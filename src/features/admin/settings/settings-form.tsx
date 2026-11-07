"use client";

import { useActionState } from "react";
import { useAdminI18n } from "@/features/admin/i18n/client";
import { ActionMessage, idle, SubmitButton, type ActionResult } from "@/features/admin/ui/form";
import { Field, TextInput } from "@/features/admin/ui/primitives";
import { saveSettings } from "./actions";

export function SettingsForm({ values }: { values: Record<string, string | number> }) {
  const { locale, t } = useAdminI18n();
  const [state, action] = useActionState<ActionResult, FormData>(saveSettings, idle);
  const fields = [
    ["contact_email", t.settings.contactEmail, "email"],
    ["contact_phone", t.settings.contactPhone, "tel"],
    ["whatsapp_number", t.settings.whatsapp, "tel"],
    ["instagram_handle", t.settings.instagram, "text"],
    ["default_low_stock_threshold", t.settings.lowStockDefault, "number"],
  ] as const;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map(([name, label, type]) => (
          <Field key={name} label={label} htmlFor={name}>
            <TextInput id={name} name={name} type={type} dir="ltr" defaultValue={values[name] ?? ""} min={type === "number" ? 0 : undefined} />
          </Field>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>{t.common.save}</SubmitButton>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}
