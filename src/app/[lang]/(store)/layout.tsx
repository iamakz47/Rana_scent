import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { StoreProviders } from "@/components/providers";
import { CartDrawer } from "@/features/cart/cart-drawer";
import { getDirection } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

export default async function StoreLayout({ children }: LayoutProps<"/[lang]">) {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);

  return (
    <StoreProviders locale={locale} dir={getDirection(locale)} dict={dict}>
      <a
        href="#main"
        className="fixed start-4 top-4 z-50 -translate-y-24 rounded-full bg-gold px-5 py-3 text-ink transition-transform focus:translate-y-0"
      >
        {dict.common.skipToContent}
      </a>
      <p className="theme-dark px-4 py-2 text-center text-step--1 text-ink-soft">{dict.announcement}</p>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <p className="border-t border-ink/10 bg-surface px-4 py-2.5 text-center text-step--1 text-ink-soft">
        {dict.common.sampleNotice}
      </p>
      <SiteFooter locale={locale} dict={dict} />
      <CartDrawer />
    </StoreProviders>
  );
}
