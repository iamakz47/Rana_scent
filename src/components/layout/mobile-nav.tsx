"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { m } from "motion/react";
import { Logo } from "@/components/brand/logo";
import { CloseIcon } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";
import { localePath } from "@/i18n/config";
import { LocaleSwitcher } from "./locale-switcher";
import { primaryNav } from "./nav-links";

// Full-screen menu built on <dialog> for free focus trapping and Escape
// handling. Links rise in sequence each time it opens.
export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { locale, dict } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    onClose();
    // Close whenever navigation lands on a new page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const links = [
    { label: dict.nav.shop, href: localePath(locale, "/shop") },
    ...primaryNav.map((item) => ({ label: dict.nav[item.key], href: localePath(locale, item.path) })),
    { label: dict.nav.faq, href: localePath(locale, "/faq") },
    { label: dict.nav.contact, href: localePath(locale, "/contact") },
  ];

  return (
    <dialog
      id="mobile-nav"
      ref={ref}
      onClose={onClose}
      aria-label={dict.nav.primary}
      className="sheet m-0 h-dvh max-h-none w-screen max-w-none bg-navy-950 p-0 text-ivory"
    >
      <div className="grain relative flex h-full flex-col overflow-y-auto">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_50%_at_85%_100%,color-mix(in_oklab,var(--color-gold-500)_22%,transparent),transparent_70%)]"
        />
        <div className="container-page relative flex h-[4.5rem] items-center justify-between">
          <Logo label={dict.meta.title} className="text-[0.95rem]" />
          <IconButton label={dict.nav.closeMenu} onClick={onClose} autoFocus>
            <CloseIcon />
          </IconButton>
        </div>

        <nav className="container-page relative flex flex-1 flex-col justify-center py-10">
          <ul className="space-y-1">
            {open &&
              links.map((link, index) => (
                <m.li
                  key={link.href}
                  initial={{ opacity: 0, y: 28 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06 + index * 0.05, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Link
                    href={link.href}
                    aria-current={pathname === link.href ? "page" : undefined}
                    className="block py-2 font-display text-step-4 leading-tight text-ivory transition-colors hover:text-gold-200 aria-[current=page]:text-gold-300"
                  >
                    {link.label}
                  </Link>
                </m.li>
              ))}
          </ul>
        </nav>

        <div className="container-page relative flex items-center justify-between border-t border-gold-400/15 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <LocaleSwitcher />
          <p className="text-step--1 text-ivory/50">{dict.announcement}</p>
        </div>
      </div>
    </dialog>
  );
}
