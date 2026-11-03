"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { localeCookie, locales } from "@/i18n/config";
import { cn } from "@/lib/cn";

const shortLabel = { ar: "ع", en: "EN" } as const;

// Links to the same page in the other language. `compact` shows a short
// label on small screens so the switcher always fits in the header.
export function LocaleSwitcher({ className, compact }: { className?: string; compact?: boolean }) {
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
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-ink/12 px-3 text-step--1 text-ink transition-colors hover:border-gold hover:text-gold-deep"
          >
            {compact ? (
              <>
                <span className="sm:hidden" aria-hidden>
                  {shortLabel[target]}
                </span>
                <span className="sr-only sm:not-sr-only">{dict.localeSwitcher[target]}</span>
              </>
            ) : (
              dict.localeSwitcher[target]
            )}
          </Link>
        ))}
    </nav>
  );
}
