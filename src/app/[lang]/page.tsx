import { LocaleSwitcher } from "@/components/locale-switcher";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

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
