"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { localeCookie, locales, type Locale } from "@/i18n/config";

type Props = {
  current: Locale;
  label: string;
  names: Record<Locale, string>;
};

export function LocaleSwitcher({ current, label, names }: Props) {
  const pathname = usePathname();

  // Swap the leading /{locale} segment and keep the rest of the path.
  const hrefFor = (locale: Locale) =>
    `/${locale}${pathname.replace(/^\/[^/]+/, "")}`;

  return (
    <nav aria-label={label} className="flex gap-2 text-sm">
      {locales
        .filter((locale) => locale !== current)
        .map((locale) => (
          <Link
            key={locale}
            href={hrefFor(locale)}
            hrefLang={locale}
            lang={locale}
            onClick={() => {
              document.cookie = `${localeCookie}=${locale}; path=/; max-age=31536000; samesite=lax`;
            }}
            className="rounded-full border border-foreground/20 px-4 py-2 transition-colors hover:bg-foreground/5"
          >
            {names[locale]}
          </Link>
        ))}
    </nav>
  );
}
