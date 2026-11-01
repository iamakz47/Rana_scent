import type { Metadata } from "next";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { locales } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

// Canonical and hreflang URLs are per page; each new page should declare its own.
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}`])),
    },
  };
}

// Placeholder landing page; the storefront is built separately.
export default async function Home() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between">
        <span className="text-lg font-semibold">{dict.meta.title}</span>
        <LocaleSwitcher
          current={locale}
          label={dict.localeSwitcher.label}
          names={{ ar: dict.localeSwitcher.ar, en: dict.localeSwitcher.en }}
        />
      </header>

      <section className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
          {dict.meta.title}
        </h1>
        <p className="text-base text-foreground/70 sm:text-lg">
          {dict.home.tagline}
        </p>
        <p className="text-sm text-foreground/50">{dict.home.comingSoon}</p>
      </section>
    </main>
  );
}
