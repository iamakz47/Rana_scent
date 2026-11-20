import Link from "next/link";
import type { ReactNode } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import { signOut } from "./actions";

export function AuthPage({ title, body, children, footer }: { title: string; body?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="container-page max-w-xl py-14 sm:py-20">
      <h1 className="font-display text-step-4 text-ink">{title}</h1>
      {body ? <p className="mt-3 text-ink-soft">{body}</p> : null}
      <div className="mt-8 rounded-[1.75rem] border border-ink/10 bg-canvas p-6 sm:p-8">{children}</div>
      {footer ? <div className="mt-6 text-step--1 text-ink-soft">{footer}</div> : null}
    </div>
  );
}

export function AccountsUnavailable({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <div className="container-page max-w-xl py-24 text-center">
      <h1 className="font-display text-step-4 text-ink">{dict.account.unavailableTitle}</h1>
      <p className="mx-auto mt-3 max-w-md text-ink-soft">{dict.account.unavailableBody}</p>
      <ButtonLink href={localePath(locale, "/shop")} className="mt-8" variant="outline">
        {dict.order.continue}
      </ButtonLink>
    </div>
  );
}

export function AccountShell({
  locale,
  dict,
  active,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  active: "overview" | "orders" | "addresses";
  children: ReactNode;
}) {
  const a = dict.account;
  const tabs = [
    { key: "overview", label: a.overview, href: localePath(locale, "/account") },
    { key: "orders", label: a.orders, href: localePath(locale, "/account/orders") },
    { key: "addresses", label: a.addresses, href: localePath(locale, "/account/addresses") },
  ] as const;
  return (
    <div className="container-page max-w-4xl py-12 sm:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-step-4 text-ink">{a.title}</h1>
        <form action={signOut}>
          <input type="hidden" name="locale" value={locale} />
          <Button type="submit" variant="ghost">
            {a.signOut}
          </Button>
        </form>
      </div>
      <nav aria-label={a.title} className="mt-6 flex gap-1 overflow-x-auto border-b border-ink/10">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={tab.key === active ? "page" : undefined}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-4 py-3 text-step--1 transition-colors",
              tab.key === active ? "border-gold-deep text-ink" : "border-transparent text-ink-soft hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <div className="mt-8 space-y-8">{children}</div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-canvas p-6 sm:p-8">
      <h2 className="font-display text-step-2 text-ink">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}
