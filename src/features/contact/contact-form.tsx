"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";
import { useFormAction } from "@/lib/use-form-action";
import { sendContactMessage, type ContactState } from "./actions";

const field =
  "mt-2 w-full rounded-2xl border border-ink/12 bg-surface px-4 py-3 text-ink placeholder:text-ink/35 focus:border-gold focus:outline-none aria-[invalid=true]:border-[#a4493d]";

export function ContactForm() {
  const { locale, dict } = useI18n();
  const page = dict.pages.contact;
  const [state, action, pending, submit] = useFormAction<ContactState>(sendContactMessage, { status: "idle" });
  // When the visitor started typing (kept in state so re-renders keep it).
  const [started, setStarted] = useState(0);
  const [sentKey, setSentKey] = useState(0);
  // The result the visitor already dismissed with "Send another message".
  const [dismissed, setDismissed] = useState<ContactState | null>(null);
  const status = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.status !== "idle") status.current?.focus();
  }, [state]);

  if (state.status === "sent" && state !== dismissed) {
    return (
      <div className="mt-6 space-y-5" data-testid="contact-sent">
        <p ref={status} tabIndex={-1} role="status" className="rounded-2xl border border-gold/50 bg-gold/12 px-5 py-4 text-ink outline-none">
          {page.sent}
        </p>
        <Button type="button" variant="outline" onClick={() => {
            setDismissed(state);
            setSentKey((k) => k + 1);
          }}>
          {page.sendAnother}
        </Button>
      </div>
    );
  }

  const error = state.status === "error" && state !== dismissed ? state.error : null;
  const invalid = (key: string) => (error === key || (error === "replyTo" && (key === "email" || key === "phone")) ? true : undefined);

  return (
    <form
      key={sentKey}
      action={action}
      onSubmit={submit}
      // When the visitor starts typing: submissions much faster than a person
      // can type, or without it at all, are treated as bots.
      onFocusCapture={() => {
        if (!started) setStarted(Date.now());
      }}
      className="mt-6 space-y-5"
      noValidate
      data-testid="contact-form"
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="started" value={started || ""} />
      {/* Left empty by people; bots fill it. */}
      <div aria-hidden="true" className="absolute -start-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <p className="text-step--1 text-ink-soft">{page.formIntro}</p>
      <label className="block text-step--1 text-ink-soft">
        {page.name}
        <input name="name" required minLength={2} maxLength={80} autoComplete="name" className={field} aria-invalid={invalid("name")} />
      </label>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-step--1 text-ink-soft">
          {page.emailOptional}
          <input name="email" type="email" maxLength={200} autoComplete="email" dir="ltr" className={field} aria-invalid={invalid("email")} />
        </label>
        <label className="block text-step--1 text-ink-soft">
          {page.phoneField}
          <input name="phone" type="tel" maxLength={20} autoComplete="tel" dir="ltr" className={field} aria-invalid={invalid("phone")} />
        </label>
      </div>
      <label className="block text-step--1 text-ink-soft">
        {page.message}
        <textarea name="message" required minLength={10} maxLength={2000} rows={5} className={field} aria-invalid={invalid("message")} />
      </label>
      {error ? (
        <p ref={status} tabIndex={-1} role="alert" className="rounded-2xl border border-[#a4493d]/30 bg-[#a4493d]/10 px-4 py-3 text-step--1 text-[#86352b] outline-none">
          {page.errors[error]}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? page.sending : page.send}
      </Button>
    </form>
  );
}
