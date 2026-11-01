"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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

// Transparent over the hero, frosted navy once the page scrolls, and tucked
// away while scrolling down so content has the full screen.
export function SiteHeader() {
  const { locale, dict } = useI18n();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const lastY = useRef(0);
  const lines = useCartLines();
  const wishlist = useWishlist();
  const { count } = cartTotals(lines);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 24);
      setHidden(y > 320 && y > lastY.current + 4);
      if (y < lastY.current - 4 || y < 320) setHidden(false);
      lastY.current = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-40 transition-[transform,background-color,backdrop-filter,border-color] duration-500 ease-[var(--ease-out-expo)]",
          scrolled
            ? "border-b border-gold-400/15 bg-navy-950/72 backdrop-blur-xl backdrop-saturate-150"
            : "border-b border-transparent",
          hidden && !menuOpen && "-translate-y-full",
        )}
      >
        <div className="container-page grid h-[4.5rem] grid-cols-[1fr_auto_1fr] items-center gap-2 lg:h-20">
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
                        className="group/nav relative inline-flex min-h-11 items-center px-2.5 text-step--1 text-ivory/80 transition-colors hover:text-gold-200"
                      >
                        {dict.nav[item.key]}
                        <span
                          aria-hidden
                          className={cn(
                            "absolute inset-x-2.5 bottom-2 h-px origin-[inline-start] scale-x-0 bg-gold-300 transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover/nav:scale-x-100",
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

          <Link href={localePath(locale)} className="flex items-center px-2 text-[0.95rem] sm:text-[1.05rem]">
            <Logo label={dict.meta.title} priority />
          </Link>

          <div className="flex items-center justify-end gap-0.5 sm:gap-1">
            <div className="hidden md:block">
              <LocaleSwitcher />
            </div>
            <Link
              href={`${localePath(locale, "/shop")}#search`}
              aria-label={dict.nav.search}
              className="hidden size-11 items-center justify-center rounded-full text-ivory/85 transition-colors hover:bg-white/8 hover:text-gold-200 sm:inline-flex"
            >
              <SearchIcon />
            </Link>
            <Link
              href={localePath(locale, "/wishlist")}
              aria-label={`${dict.nav.wishlist} (${wishlist.length})`}
              className="relative inline-flex size-11 items-center justify-center rounded-full text-ivory/85 transition-colors hover:bg-white/8 hover:text-gold-200"
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
                    className="absolute -end-0.5 top-0.5 grid min-w-5 place-items-center rounded-full bg-gold px-1 text-[0.65rem] font-semibold leading-5 text-navy-950 tabular-nums"
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
