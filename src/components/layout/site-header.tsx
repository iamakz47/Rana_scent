"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { Logo } from "@/components/brand/logo";
import { BagIcon, HeartIcon, MenuIcon, SearchIcon } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/button";
import { cartTotals, setCartDrawerOpen, useCartLines } from "@/features/cart/store";
import { useWishlist } from "@/features/wishlist/store";
import { useI18n } from "@/i18n/client";
import { localePath } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { LocaleSwitcher } from "./locale-switcher";
import { MobileNav } from "./mobile-nav";
import { primaryNav } from "./nav-links";

// A stable sticky header. It never hides or moves: scrolling only deepens
// its background and adds a hairline shadow. It sits in normal flow (no
// overlap with content) and has its own view-transition layer, so route
// changes don't cross-fade it.
export function SiteHeader() {
  const { locale, dict } = useI18n();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const lines = useCartLines();
  const wishlist = useWishlist();
  const { count } = cartTotals(lines);

  useEffect(() => {
    // React skips re-rendering when the boolean doesn't change, so this only
    // updates when the threshold is crossed.
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Display is set per link (hidden on phones, inline-flex from sm) so the
  // utilities never compete.
  const iconLink =
    "relative size-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5 hover:text-gold-deep";

  return (
    <>
      <header
        className={cn(
          "site-header sticky top-0 z-40 border-b bg-canvas/95 backdrop-blur-md transition-[background-color,border-color,box-shadow] duration-300",
          scrolled
            ? "border-ink/10 bg-canvas/97 shadow-[0_12px_30px_-24px_rgba(53,42,36,0.45)]"
            : "border-transparent",
        )}
      >
        <div className="container-page grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-2 lg:h-20">
          <div className="flex items-center gap-1">
            <IconButton
              label={dict.nav.openMenu}
              className="lg:hidden"
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              onClick={() => setMenuOpen(true)}
            >
              <MenuIcon />
            </IconButton>
            <nav aria-label={dict.nav.primary} className="hidden lg:block">
              <ul className="flex items-center gap-1 xl:gap-3">
                {primaryNav.map((item) => {
                  const href = localePath(locale, item.path);
                  const active = pathname === href;
                  return (
                    <li key={item.key}>
                      <Link
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className="group/nav relative inline-flex min-h-11 items-center px-2.5 text-step--1 text-ink transition-colors hover:text-gold-deep"
                      >
                        {dict.nav[item.key]}
                        <span
                          aria-hidden
                          className={cn(
                            "absolute inset-x-2.5 bottom-2 h-px origin-[inline-start] scale-x-0 bg-gold transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover/nav:scale-x-100",
                            active && "scale-x-100",
                          )}
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>

          <Link
            href={localePath(locale)}
            aria-label={dict.nav.home}
            className="flex items-center px-1 text-[0.9rem] sm:text-[1.05rem]"
          >
            <Logo label={dict.meta.title} priority />
          </Link>

          <div className="flex items-center justify-end gap-0.5 sm:gap-1">
            <LocaleSwitcher compact />
            <Link
              href={`${localePath(locale, "/shop")}#search`}
              aria-label={dict.nav.search}
              className={cn(iconLink, "hidden sm:inline-flex")}
            >
              <SearchIcon />
            </Link>
            <Link
              href={localePath(locale, "/wishlist")}
              aria-label={`${dict.nav.wishlist} (${wishlist.length})`}
              className={cn(iconLink, "hidden sm:inline-flex")}
            >
              <HeartIcon filled={wishlist.length > 0} />
            </Link>
            <IconButton label={`${dict.nav.cart} (${count})`} onClick={() => setCartDrawerOpen(true)}>
              <BagIcon />
              <AnimatePresence initial={false}>
                {count > 0 && (
                  <m.span
                    key={count}
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.4, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 520, damping: 22 }}
                    className="absolute -end-0.5 top-0.5 grid min-w-5 place-items-center rounded-full bg-ink px-1 text-[0.65rem] font-semibold leading-5 text-canvas tabular-nums"
                    aria-hidden
                  >
                    {count}
                  </m.span>
                )}
              </AnimatePresence>
            </IconButton>
          </div>
        </div>
      </header>
      <MobileNav open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
