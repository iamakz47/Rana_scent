import Link from "next/link";
import type { ReactNode } from "react";
import { localePath, type Locale } from "@/i18n/config";
import type { AdminDictionary } from "@/features/admin/i18n/en";

// Centered card for sign-in, recovery and new-password screens.
export function AuthCard({
  locale,
  t,
  title,
  body,
  children,
}: {
  locale: Locale;
  t: AdminDictionary;
  title: string;
  body?: string;
  children: ReactNode;
}) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_40rem_at_50%_-10%,rgba(182,154,101,0.18),transparent_60%)]"
      />
      <div className="relative w-full max-w-md">
        <p className="mb-8 text-center">
          <span className="text-gold font-display text-step-3">{t.brand}</span>
          <span className="mt-1 block text-[0.7rem] uppercase tracking-[0.3em] text-ink-soft">{t.console}</span>
        </p>
        <div className="rounded-3xl border border-ink/10 bg-canvas p-6 shadow-[0_30px_60px_-40px_rgba(53,42,36,0.45)] sm:p-8">
          <h1 className="font-display text-step-2 text-ink">{title}</h1>
          {body ? <p className="mt-2 text-step--1 text-ink-soft">{body}</p> : null}
          <div className="mt-6">{children}</div>
        </div>
        <p className="mt-6 text-center text-step--1">
          <Link href={localePath(locale, "/")} className="text-ink-soft underline-offset-4 hover:text-ink hover:underline">
            {t.auth.storefront}
          </Link>
        </p>
      </div>
    </main>
  );
}
