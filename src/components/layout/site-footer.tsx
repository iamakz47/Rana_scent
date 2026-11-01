import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import type { Dictionary } from "@/i18n/dictionaries";
import { localePath, type Locale } from "@/i18n/config";

export function SiteFooter({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const columns = [
    {
      title: dict.footer.shop,
      links: [
        { label: dict.nav.diffusers, path: "/collections/diffusers" },
        { label: dict.nav.refills, path: "/collections/refills" },
        { label: dict.nav.sets, path: "/collections/bundles" },
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
      ],
    },
  ];

  return (
    <footer className="grain relative overflow-hidden border-t border-gold-400/15 bg-navy-950">
      <div className="container-page grid gap-12 py-16 md:grid-cols-[1.4fr_repeat(3,1fr)] md:py-20">
        <div className="max-w-xs">
          <Logo label={dict.meta.title} className="text-[1.15rem]" />
          <p className="mt-6 text-ivory/60">{dict.footer.tagline}</p>
        </div>
        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="text-step--1 text-gold-300">{column.title}</h2>
            <ul className="mt-4 space-y-1">
              {column.links.map((link) => (
                <li key={link.path}>
                  <Link
                    href={localePath(locale, link.path)}
                    className="inline-flex min-h-11 items-center text-ivory/70 transition-colors hover:text-ivory md:min-h-9"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="container-page flex flex-col gap-3 border-t border-white/6 py-6 text-step--1 text-ivory/45 md:flex-row md:items-center md:justify-between">
        <p>{dict.footer.payments}</p>
        <p>
          © {dict.meta.title}. {dict.footer.rights}
        </p>
      </div>
    </footer>
  );
}
