"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { localeCookie, locales } from "@/i18n/config";
import { cn } from "@/lib/cn";

export function LocaleSwitcher({ className }: { className?: string }) {
  const { locale, dict } = useI18n();
  const pathname = usePathname();

  // Swap the leading /{locale} segment and keep the rest of the path.
  const hrefFor = (target: string) => `/${target}${pathname.replace(/^\/[^/]+/, "")}`;

  return (
    <nav aria-label={dict.localeSwitcher.label} className={cn("flex", className)}>
      {locales
        .filter((target) => target !== locale)
        .map((target) => (
          <Link
            key={target}
            href={hrefFor(target)}
            hrefLang={target}
            lang={target}
            onClick={() => {
              document.cookie = `${localeCookie}=${target}; path=/; max-age=31536000; samesite=lax`;
            }}
            className="inline-flex min-h-11 items-center rounded-full px-3 text-step--1 text-ivory/80 transition-colors hover:bg-white/8 hover:text-gold-200"
          >
            {dict.localeSwitcher[target]}
          </Link>
        ))}
    </nav>
  );
}
