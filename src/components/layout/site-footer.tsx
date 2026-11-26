import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import type { Dictionary } from "@/i18n/dictionaries";
import { localePath, type Locale } from "@/i18n/config";
import { telHref, whatsappHref, type StoreContact } from "@/features/contact/channels";

export function SiteFooter({ locale, dict, contact }: { locale: Locale; dict: Dictionary; contact?: StoreContact }) {
  const whatsapp = contact?.whatsapp ? whatsappHref(contact.whatsapp) : null;
  const call = contact?.phone ? telHref(contact.phone) : null;
  const columns = [
    {
      title: dict.footer.shop,
      links: [
        { label: dict.nav.diffusers, path: "/collections/diffusers" },
        { label: dict.nav.refills, path: "/collections/refills" },
        { label: dict.nav.offers, path: "/offers" },
        { label: dict.nav.accessories, path: "/collections/accessories" },
      ],
    },
    {
      title: dict.footer.help,
      links: [
        { label: dict.nav.faq, path: "/faq" },
        { label: dict.footer.shipping, path: "/shipping-returns" },
        { label: dict.nav.contact, path: "/contact" },
      ],
    },
    {
      title: dict.footer.company,
      links: [
        { label: dict.nav.about, path: "/about" },
        { label: dict.footer.privacy, path: "/privacy" },
        { label: dict.footer.terms, path: "/terms" },
        { label: dict.footer.policies, path: "/policies" },
      ],
    },
  ];

  return (
    <footer className="theme-dark grain relative overflow-hidden">
      <div className="container-page grid gap-12 py-16 md:grid-cols-[1.4fr_repeat(3,1fr)] md:py-20">
        <div className="max-w-xs">
          <Logo label={dict.meta.title} className="text-[1.15rem]" />
          <p className="mt-6 text-ink-soft">{dict.footer.tagline}</p>
          {/* Quick contact, from Admin → Settings. */}
          {whatsapp || call ? (
            <div className="mt-6 flex flex-wrap gap-2" data-testid="footer-contact">
              {whatsapp ? (
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-full border border-ink/20 px-4 text-step--1 text-ink transition-colors hover:border-gold">
                  {dict.pages.contact.whatsapp}
                </a>
              ) : null}
              {call ? (
                <a href={call} className="inline-flex min-h-11 items-center rounded-full border border-ink/20 px-4 text-step--1 text-ink transition-colors hover:border-gold">
                  {dict.pages.contact.call}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="text-step--1 text-gold-deep">{column.title}</h2>
            <ul className="mt-4 space-y-1">
              {column.links.map((link) => (
                <li key={link.path}>
                  <Link
                    href={localePath(locale, link.path)}
                    className="inline-flex min-h-11 items-center text-ink-soft transition-colors hover:text-ink md:min-h-9"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="container-page flex flex-col gap-3 border-t border-ink/10 py-6 text-step--1 text-ink-soft md:flex-row md:items-center md:justify-between">
        <p>{dict.footer.payments}</p>
        <p>
          © {dict.meta.title}. {dict.footer.rights}
        </p>
      </div>
    </footer>
  );
}
