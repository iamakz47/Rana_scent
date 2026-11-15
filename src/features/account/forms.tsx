"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";
import { localePath } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { governorates } from "@/features/checkout/schema";
import {
  claimOrder,
  deleteAddress,
  makeDefaultAddress,
  register,
  requestDeletion,
  requestReset,
  saveAddress,
  saveProfile,
  signIn,
  updatePassword,
  withdrawDeletion,
  type FormState,
} from "./actions";

export const fieldClass =
  "block w-full min-w-0 rounded-xl border border-ink/15 bg-canvas px-4 py-3 text-step-0 text-ink transition-colors placeholder:text-ink-soft/60 hover:border-ink/30 focus:border-gold-deep focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold-deep aria-[invalid=true]:border-[#a4493d]";

function Field({ id, label, hint, children, className }: { id: string; label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className="mb-1.5 block text-step--1 font-medium text-ink">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-[0.8rem] text-ink-soft">{hint}</p> : null}
    </div>
  );
}

function useMessages() {
  const { dict } = useI18n();
  const a = dict.account;
  const errors = a.errors as Record<string, string>;
  return (state: FormState) => {
    if (state.error === "verify") return { tone: "info" as const, text: a.verifyNeeded };
    if (state.error === "claim") return { tone: "error" as const, text: a.claimFailed };
    if (state.error) return { tone: "error" as const, text: errors[state.error] ?? errors.generic };
    if (state.ok && state.message) return { tone: "ok" as const, text: (a as Record<string, unknown>)[state.message] as string };
    return null;
  };
}

export function FormMessage({ state }: { state: FormState }) {
  const message = useMessages()(state);
  if (!message) return null;
  return (
    <p
      role={message.tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-2xl border px-4 py-3 text-step--1",
        message.tone === "error" ? "border-[#a4493d]/30 bg-[#a4493d]/8 text-[#86352b]" : "border-gold/40 bg-gold/8 text-ink",
      )}
    >
      {message.text}
    </p>
  );
}

function LocaleField() {
  const { locale } = useI18n();
  return <input type="hidden" name="locale" value={locale} />;
}

export function LoginForm({ next }: { next: string }) {
  const { locale, dict } = useI18n();
  const a = dict.account;
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {});
  return (
    <form action={action} className="space-y-4">
      <LocaleField />
      <input type="hidden" name="next" value={next} />
      <FormMessage state={state} />
      <Field id="email" label={a.email}>
        <input id="email" name="email" type="email" autoComplete="email" required dir="ltr" maxLength={254} className={fieldClass} />
      </Field>
      <Field id="password" label={a.password}>
        <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={72} className={fieldClass} />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="submit" disabled={pending} size="lg">
          {a.signIn}
        </Button>
        <Link href={localePath(locale, "/account/forgot-password")} className="text-step--1 text-ink underline underline-offset-4">
          {a.forgot}
        </Link>
      </div>
    </form>
  );
}

export function RegisterForm() {
  const { dict } = useI18n();
  const a = dict.account;
  const [state, action, pending] = useActionState<FormState, FormData>(register, {});
  if (state.ok) {
    return (
      <div role="status" className="rounded-[1.5rem] border border-gold/40 bg-gold/8 p-6">
        <p className="font-display text-step-2 text-ink">{a.checkEmailTitle}</p>
        <p className="mt-2 text-ink-soft">{a.checkEmailBody}</p>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <LocaleField />
      <FormMessage state={state} />
      <Field id="full_name" label={a.fullName}>
        <input id="full_name" name="full_name" autoComplete="name" required maxLength={120} className={fieldClass} />
      </Field>
      <Field id="email" label={a.email}>
        <input id="email" name="email" type="email" autoComplete="email" required dir="ltr" maxLength={254} className={fieldClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="password" label={a.password} hint={a.passwordHint}>
          <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={72} className={fieldClass} />
        </Field>
        <Field id="confirm" label={a.confirmPassword}>
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={10} maxLength={72} className={fieldClass} />
        </Field>
      </div>
      <label className="flex items-start gap-3 text-step--1 text-ink">
        <input type="checkbox" name="marketing" className="mt-1 size-4 accent-[var(--color-gold-deep)]" />
        {a.marketing}
      </label>
      <Button type="submit" disabled={pending} size="lg">
        {a.register}
      </Button>
    </form>
  );
}

export function ForgotForm() {
  const { dict } = useI18n();
  const a = dict.account;
  const [state, action, pending] = useActionState<FormState, FormData>(requestReset, {});
  if (state.ok) {
    return (
      <div role="status" className="rounded-[1.5rem] border border-gold/40 bg-gold/8 p-6">
        <p className="font-display text-step-2 text-ink">{a.checkEmailTitle}</p>
        <p className="mt-2 text-ink-soft">{a.checkEmailBody}</p>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <LocaleField />
      <FormMessage state={state} />
      <Field id="email" label={a.email}>
        <input id="email" name="email" type="email" autoComplete="email" required dir="ltr" maxLength={254} className={fieldClass} />
      </Field>
      <Button type="submit" disabled={pending} size="lg">
        {a.sendLink}
      </Button>
    </form>
  );
}

export function ResetForm() {
  const { locale, dict } = useI18n();
  const a = dict.account;
  const [state, action, pending] = useActionState<FormState, FormData>(updatePassword, {});
  return (
    <form action={action} className="space-y-4">
      <LocaleField />
      <FormMessage state={state} />
      {state.ok ? (
        <Link href={localePath(locale, "/account")} className="inline-block text-ink underline underline-offset-4">
          {a.title}
        </Link>
      ) : (
        <>
          <Field id="password" label={a.password} hint={a.passwordHint}>
            <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={72} className={fieldClass} />
          </Field>
          <Field id="confirm" label={a.confirmPassword}>
            <input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={10} maxLength={72} className={fieldClass} />
          </Field>
          <Button type="submit" disabled={pending} size="lg">
            {a.savePassword}
          </Button>
        </>
      )}
    </form>
  );
}

export function ProfileForm({
  values,
  email,
}: {
  values: { full_name: string; phone: string; preferred_locale: string; marketing_opt_in: boolean };
  email: string;
}) {
  const { dict } = useI18n();
  const a = dict.account;
  const [state, action, pending] = useActionState<FormState, FormData>(saveProfile, {});
  return (
    <form action={action} className="space-y-4">
      <LocaleField />
      <FormMessage state={state} />
      <Field id="account-email" label={a.email}>
        <input id="account-email" value={email} readOnly dir="ltr" className={cn(fieldClass, "bg-surface text-ink-soft")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="full_name" label={a.fullName}>
          <input id="full_name" name="full_name" defaultValue={values.full_name} autoComplete="name" required maxLength={120} className={fieldClass} />
        </Field>
        <Field id="phone" label={a.phone} hint={a.phoneHint}>
          <input id="phone" name="phone" type="tel" defaultValue={values.phone} autoComplete="tel" dir="ltr" maxLength={20} className={fieldClass} />
        </Field>
      </div>
      <Field id="preferred_locale" label={a.language} className="max-w-xs">
        <select id="preferred_locale" name="preferred_locale" defaultValue={values.preferred_locale} className={fieldClass}>
          <option value="ar">العربية</option>
          <option value="en">English</option>
        </select>
      </Field>
      <label className="flex items-start gap-3 text-step--1 text-ink">
        <input type="checkbox" name="marketing_opt_in" defaultChecked={values.marketing_opt_in} className="mt-1 size-4 accent-[var(--color-gold-deep)]" />
        {a.marketing}
      </label>
      <Button type="submit" disabled={pending}>
        {a.save}
      </Button>
    </form>
  );
}

export type AddressValues = {
  id: string;
  label: string;
  recipient_name: string;
  phone: string;
  governorate: string;
  area: string;
  block: string;
  street: string;
  avenue: string;
  building: string;
  floor: string;
  apartment: string;
  notes: string;
  is_default: boolean;
};

export function AddressForm({ values, onDone }: { values?: AddressValues; onDone?: () => void }) {
  const { dict } = useI18n();
  const a = dict.account;
  const c = dict.checkout;
  const names = c.governorates as Record<string, string>;
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, formData) => {
    const result = await saveAddress(prev, formData);
    if (result.ok) onDone?.();
    return result;
  }, {});
  const p = values?.id ?? "new";
  return (
    <form action={action} className="space-y-4">
      <LocaleField />
      <input type="hidden" name="address_id" value={values?.id ?? ""} />
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${p}-label`} label={a.label}>
          <input id={`${p}-label`} name="label" defaultValue={values?.label} maxLength={40} className={fieldClass} />
        </Field>
        <Field id={`${p}-recipient`} label={a.recipient}>
          <input id={`${p}-recipient`} name="recipient_name" defaultValue={values?.recipient_name} required maxLength={120} autoComplete="name" className={fieldClass} />
        </Field>
        <Field id={`${p}-phone`} label={a.phone} hint={a.phoneHint}>
          <input id={`${p}-phone`} name="phone" type="tel" defaultValue={values?.phone} required dir="ltr" maxLength={20} autoComplete="tel" className={fieldClass} />
        </Field>
        <Field id={`${p}-governorate`} label={c.governorate}>
          <select id={`${p}-governorate`} name="governorate" defaultValue={values?.governorate ?? ""} required className={fieldClass}>
            <option value="" disabled>
              {c.chooseGovernorate}
            </option>
            {governorates.map((g) => (
              <option key={g} value={g}>
                {names[g]}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${p}-area`} label={c.area}>
          <input id={`${p}-area`} name="area" defaultValue={values?.area} required maxLength={80} className={fieldClass} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field id={`${p}-block`} label={c.block}>
          <input id={`${p}-block`} name="block" defaultValue={values?.block} required maxLength={20} className={fieldClass} />
        </Field>
        <Field id={`${p}-street`} label={c.street} className="col-span-2 sm:col-span-3">
          <input id={`${p}-street`} name="street" defaultValue={values?.street} required maxLength={80} className={fieldClass} />
        </Field>
        <Field id={`${p}-avenue`} label={c.avenue}>
          <input id={`${p}-avenue`} name="avenue" defaultValue={values?.avenue} maxLength={40} className={fieldClass} />
        </Field>
        <Field id={`${p}-building`} label={c.building}>
          <input id={`${p}-building`} name="building" defaultValue={values?.building} required maxLength={40} className={fieldClass} />
        </Field>
        <Field id={`${p}-floor`} label={c.floor}>
          <input id={`${p}-floor`} name="floor" defaultValue={values?.floor} maxLength={10} className={fieldClass} />
        </Field>
        <Field id={`${p}-apartment`} label={c.apartment}>
          <input id={`${p}-apartment`} name="apartment" defaultValue={values?.apartment} maxLength={20} className={fieldClass} />
        </Field>
      </div>
      <Field id={`${p}-notes`} label={a.notes}>
        <textarea id={`${p}-notes`} name="notes" defaultValue={values?.notes} rows={2} maxLength={300} className={fieldClass} />
      </Field>
      {!values?.is_default ? (
        <label className="flex items-center gap-3 text-step--1 text-ink">
          <input type="checkbox" name="make_default" className="size-4 accent-[var(--color-gold-deep)]" />
          {a.makeDefault}
        </label>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {a.save}
        </Button>
        {onDone ? (
          <Button type="button" variant="ghost" onClick={onDone}>
            {a.cancel}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function AddressCard({ address, line }: { address: AddressValues; line: string }) {
  const { dict } = useI18n();
  const a = dict.account;
  const [editing, setEditing] = useState(false);
  const [delState, delAction, deleting] = useActionState<FormState, FormData>(deleteAddress, {});
  const [defState, defAction, defaulting] = useActionState<FormState, FormData>(makeDefaultAddress, {});
  if (editing) {
    return (
      <div className="rounded-[1.5rem] border border-gold/40 bg-canvas p-5">
        <AddressForm values={address} onDone={() => setEditing(false)} />
      </div>
    );
  }
  return (
    <article className="rounded-[1.5rem] border border-ink/10 bg-canvas p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium text-ink">{address.label || address.recipient_name}</h3>
        {address.is_default ? (
          <span className="rounded-full bg-gold/15 px-3 py-1 text-[0.72rem] uppercase tracking-[0.14em] text-gold-deep">{a.default}</span>
        ) : null}
      </div>
      <p className="mt-2 text-step--1 text-ink">{address.recipient_name}</p>
      <p className="text-step--1 text-ink-soft">{line}</p>
      <p className="text-step--1 text-ink-soft" dir="ltr">
        {address.phone}
      </p>
      <FormMessage state={delState.error ? delState : defState} />
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setEditing(true)}>
          {a.editAddress}
        </Button>
        {!address.is_default ? (
          <form action={defAction}>
            <LocaleField />
            <input type="hidden" name="address_id" value={address.id} />
            <Button variant="ghost" type="submit" disabled={defaulting}>
              {a.makeDefault}
            </Button>
          </form>
        ) : null}
        <form
          action={delAction}
          onSubmit={(event) => {
            if (!window.confirm(a.deleteAddressConfirm)) event.preventDefault();
          }}
        >
          <LocaleField />
          <input type="hidden" name="address_id" value={address.id} />
          <Button variant="ghost" type="submit" disabled={deleting}>
            {a.deleteAddress}
          </Button>
        </form>
      </div>
    </article>
  );
}

export function NewAddress() {
  const { dict } = useI18n();
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        {dict.account.addAddress}
      </Button>
    );
  }
  return (
    <div className="rounded-[1.5rem] border border-gold/40 bg-canvas p-5">
      <AddressForm onDone={() => setOpen(false)} />
    </div>
  );
}

export function DeletionForm({ pending: requested }: { pending: boolean }) {
  const { dict } = useI18n();
  const a = dict.account;
  const [state, action, pending] = useActionState<FormState, FormData>(requestDeletion, {});
  const [wState, withdraw, withdrawing] = useActionState<FormState, FormData>(withdrawDeletion, {});
  if (requested) {
    return (
      <form action={withdraw} className="space-y-3">
        <LocaleField />
        <p role="status" className="text-step--1 text-ink">
          {a.deletePending}
        </p>
        <FormMessage state={wState} />
        <Button type="submit" variant="outline" disabled={withdrawing}>
          {a.deleteWithdraw}
        </Button>
      </form>
    );
  }
  return (
    <form
      action={action}
      className="space-y-3"
      onSubmit={(event) => {
        if (!window.confirm(a.deleteConfirm)) event.preventDefault();
      }}
    >
      <LocaleField />
      <FormMessage state={state} />
      <Field id="delete-reason" label={a.deleteReason}>
        <textarea id="delete-reason" name="reason" rows={2} maxLength={500} className={fieldClass} />
      </Field>
      <Button type="submit" variant="outline" disabled={pending}>
        {a.deleteRequest}
      </Button>
    </form>
  );
}

export function ClaimOrderForm({ number, token }: { number: number; token: string }) {
  const { dict } = useI18n();
  const a = dict.account;
  const [state, action, pending] = useActionState<FormState, FormData>(claimOrder, {});
  if (state.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="space-y-3">
      <LocaleField />
      <input type="hidden" name="n" value={number} />
      <input type="hidden" name="t" value={token} />
      <FormMessage state={state} />
      <Button type="submit" variant="outline" disabled={pending}>
        {a.claimButton}
      </Button>
    </form>
  );
}
