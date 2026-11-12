"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";
import { localePath } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { signOut } from "@/features/admin/auth/actions";
import type { AdminSectionKey, StaffRole } from "@/features/admin/auth/permissions";
import { useAdminI18n } from "@/features/admin/i18n/client";
import { NavIcon } from "./nav-icons";

type NavItem = { key: AdminSectionKey; href: string };

const groups: Array<{ key: "overview" | "catalog" | "sales" | "content" | "store"; items: AdminSectionKey[] }> = [
  { key: "overview", items: ["dashboard"] },
  { key: "catalog", items: ["products", "categories", "inventory"] },
  { key: "sales", items: ["orders", "customers", "promotions"] },
  { key: "content", items: ["homepage", "media"] },
  { key: "store", items: ["finance", "settings", "staff"] },
];

export type ShellUser = { email: string; displayName: string; role: StaffRole };

function useActive() {
  const pathname = usePathname();
  const { locale } = useAdminI18n();
  return (href: string) => {
    const full = localePath(locale, href);
    return href === "/admin" ? pathname === full : pathname === full || pathname.startsWith(`${full}/`);
  };
}

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const { locale, t } = useAdminI18n();
  const isActive = useActive();
  const allowed = new Set(items.map((item) => item.key));
  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const visible = group.items.filter((key) => allowed.has(key));
        if (visible.length === 0) return null;
        return (
          <div key={group.key}>
            {group.key !== "overview" ? (
              <p className="mb-2 px-3 text-[0.66rem] font-medium uppercase tracking-[0.24em] text-taupe">
                {t.nav.groups[group.key]}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {visible.map((key) => {
                const href = items.find((item) => item.key === key)!.href;
                const active = isActive(href);
                return (
                  <li key={key}>
                    <Link
                      href={localePath(locale, href)}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex min-h-9 items-center gap-3 rounded-lg px-3 text-step--1 transition-colors",
                        active ? "bg-ink/8 text-ink" : "text-ink-soft hover:bg-ink/5 hover:text-ink",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "absolute inset-y-2 start-0 w-0.5 rounded-full bg-gold transition-opacity",
                          active ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className={cn(active ? "text-gold-deep" : "text-taupe group-hover:text-gold-deep")}>
                        <NavIcon name={key} />
                      </span>
                      {t.nav[key]}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function UserCard({ user }: { user: ShellUser }) {
  const { locale, t } = useAdminI18n();
  const name = user.displayName || user.email;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-ink/10 bg-surface p-2.5">
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-full bg-ink font-display text-step-0 text-canvas"
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-step--1 font-medium leading-tight text-ink" dir="auto">
          {name}
        </p>
        <p className="text-[0.68rem] uppercase tracking-[0.16em] text-gold-deep">{t.roles[user.role]}</p>
      </div>
      <form action={signOut}>
        <input type="hidden" name="locale" value={locale} />
        <button
          type="submit"
          className="min-h-9 rounded-lg border border-ink/12 px-2.5 text-[0.78rem] text-ink-soft transition-colors hover:border-gold hover:text-ink"
        >
          {t.auth.signOut}
        </button>
      </form>
    </div>
  );
}

function SwitchLocale() {
  const { locale, t } = useAdminI18n();
  const pathname = usePathname();
  const other = locale === "ar" ? "en" : "ar";
  const href = pathname.replace(/^\/(ar|en)(?=\/|$)/, `/${other}`);
  return (
    <Link
      href={href}
      hrefLang={other}
      lang={other}
      className="inline-flex min-h-9 items-center rounded-full border border-ink/12 px-3 text-step--1 text-ink-soft hover:border-gold hover:text-ink"
    >
      {t.nav.language}
    </Link>
  );
}

function Wordmark() {
  const { locale, t } = useAdminI18n();
  return (
    <Link href={localePath(locale, "/admin")} className="flex items-baseline gap-2">
      <span className="text-gold font-display text-step-1 leading-none">{t.brand}</span>
      <span className="text-[0.62rem] uppercase tracking-[0.28em] text-ink-soft">{t.console}</span>
    </Link>
  );
}

export function AdminShell({ items, user, children }: { items: NavItem[]; user: ShellUser; children: ReactNode }) {
  const { locale, t } = useAdminI18n();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[17rem_minmax(0,1fr)]">
      <a
        href="#admin-main"
        className="fixed start-4 top-4 z-50 -translate-y-24 rounded-full bg-gold px-5 py-3 text-ink transition-transform focus:translate-y-0"
      >
        {t.skipToContent}
      </a>

      {/* Desktop sidebar */}
      <div className="hidden border-e border-ink/10 bg-canvas lg:block">
      <aside className="sticky top-0 flex h-dvh flex-col">
        <div className="flex h-16 items-center px-6">
          <Wordmark />
        </div>
        <nav aria-label={t.nav.label} className="flex-1 overflow-y-auto px-3 py-2">
          <NavList items={items} />
        </nav>
        <div className="space-y-2.5 border-t border-ink/8 p-3">
          <div className="flex items-center justify-between gap-2 px-1">
            <Link
              href={localePath(locale, "/")}
              className="text-step--1 text-ink-soft underline-offset-4 hover:text-ink hover:underline"
            >
              {t.nav.viewStore}
            </Link>
            <SwitchLocale />
          </div>
          <UserCard user={user} />
        </div>
      </aside>
      </div>

      {/* Mobile and tablet top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-ink/10 bg-canvas/92 px-4 backdrop-blur-md lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t.nav.open}
          aria-expanded={open}
          aria-controls="admin-mobile-nav"
          className="inline-flex size-10 items-center justify-center rounded-full hover:bg-ink/5"
        >
          <MenuIcon />
        </button>
        <Wordmark />
        <SwitchLocale />
      </header>

      <dialog
        id="admin-mobile-nav"
        ref={dialog}
        onClose={() => setOpen(false)}
        aria-label={t.nav.label}
        className="admin-drawer h-dvh max-h-none w-[min(20rem,88vw)] max-w-none bg-canvas p-0 text-ink"
      >
        <div className="flex h-full flex-col">
          <div className="flex h-14 items-center justify-between border-b border-ink/10 px-4">
            <Wordmark />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t.nav.close}
              autoFocus
              className="inline-flex size-10 items-center justify-center rounded-full hover:bg-ink/5"
            >
              <CloseIcon />
            </button>
          </div>
          <nav aria-label={t.nav.label} className="flex-1 overflow-y-auto px-3 py-4">
            <NavList items={items} onNavigate={() => setOpen(false)} />
          </nav>
          <div className="space-y-3 border-t border-ink/8 p-4">
            <Link href={localePath(locale, "/")} onClick={() => setOpen(false)} className="text-step--1 text-ink-soft hover:text-ink">
              {t.nav.viewStore}
            </Link>
            <UserCard user={user} />
          </div>
        </div>
      </dialog>

      <main id="admin-main" tabIndex={-1} className="min-w-0 px-4 py-6 outline-none sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
