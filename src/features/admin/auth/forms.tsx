"use client";

import Link from "next/link";
import { useActionState } from "react";
import { localePath } from "@/i18n/config";
import { useAdminI18n } from "@/features/admin/i18n/client";
import { adminButton, Field, Notice, TextInput } from "@/features/admin/ui/primitives";
import { SubmitButton } from "@/features/admin/ui/form";
import { requestPasswordReset, signIn, updatePassword, type AuthFormState } from "./actions";

type ErrorKey = keyof ReturnType<typeof useAdminI18n>["t"]["auth"]["errors"];

function useErrorText(code?: string) {
  const { t } = useAdminI18n();
  if (!code) return undefined;
  return t.auth.errors[code as ErrorKey] ?? t.auth.errors.generic;
}

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const { locale, t } = useAdminI18n();
  const [state, action] = useActionState<AuthFormState, FormData>(signIn, { error: initialError });
  const error = useErrorText(state.error);
  return (
    <form action={action} className="space-y-4" noValidate>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <input type="hidden" name="next" value={next ?? "/admin"} />
      <input type="hidden" name="locale" value={locale} />
      <Field label={t.auth.email} htmlFor="email">
        <TextInput id="email" name="email" type="email" autoComplete="username" required dir="ltr" />
      </Field>
      <Field label={t.auth.password} htmlFor="password">
        <TextInput id="password" name="password" type="password" autoComplete="current-password" required dir="ltr" />
      </Field>
      <SubmitButton className="w-full" pending={t.auth.signingIn}>
        {t.auth.signIn}
      </SubmitButton>
      <p className="text-center text-step--1">
        <Link className="text-gold-deep underline-offset-4 hover:underline" href={localePath(locale, "/admin/forgot-password")}>
          {t.auth.forgot}
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const { locale, t } = useAdminI18n();
  const [state, action] = useActionState<AuthFormState, FormData>(requestPasswordReset, {});
  const error = useErrorText(state.error);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      {state.ok ? <Notice tone="success">{t.auth.linkSent}</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Field label={t.auth.email} htmlFor="email">
        <TextInput id="email" name="email" type="email" autoComplete="email" required dir="ltr" />
      </Field>
      <SubmitButton className="w-full">{t.auth.sendLink}</SubmitButton>
      <p className="text-center text-step--1">
        <Link className="text-gold-deep underline-offset-4 hover:underline" href={localePath(locale, "/admin/login")}>
          {t.auth.backToLogin}
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm() {
  const { locale, t } = useAdminI18n();
  const [state, action] = useActionState<AuthFormState, FormData>(updatePassword, {});
  const error = useErrorText(state.error);
  if (state.ok) {
    return (
      <div className="space-y-4">
        <Notice tone="success">{t.auth.passwordSaved}</Notice>
        <Link className={adminButton("primary") + " w-full"} href={localePath(locale, "/admin")}>
          {t.auth.continue}
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Field label={t.auth.newPassword} htmlFor="password" hint={t.auth.resetBody}>
        <TextInput id="password" name="password" type="password" autoComplete="new-password" required minLength={10} dir="ltr" />
      </Field>
      <Field label={t.auth.confirmPassword} htmlFor="confirm">
        <TextInput id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={10} dir="ltr" />
      </Field>
      <SubmitButton className="w-full">{t.auth.savePassword}</SubmitButton>
    </form>
  );
}
