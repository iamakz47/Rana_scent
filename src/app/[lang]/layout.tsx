import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Readex_Pro, Reem_Kufi } from "next/font/google";
import { getDirection, locales } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { getSiteUrl, isIndexingEnabled } from "@/lib/env";
import "../globals.css";

// Readex Pro is drawn for Arabic and Latin together, so body text feels like
// one voice in both languages. Display type switches per script.
const readex = Readex_Pro({
  variable: "--font-readex",
  subsets: ["arabic", "latin"],
  axes: ["HEXP"],
  display: "swap",
});

const bodoni = Bodoni_Moda({
  variable: "--font-bodoni",
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
  display: "swap",
});

const reemKufi = Reem_Kufi({
  variable: "--font-reem-kufi",
  subsets: ["arabic"],
  display: "swap",
});

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return {
    metadataBase: getSiteUrl(),
    title: { default: dict.meta.title, template: `%s | ${dict.meta.title}` },
    description: dict.meta.description,
    robots: isIndexingEnabled() ? undefined : { index: false, follow: false },
    openGraph: { siteName: dict.meta.title, type: "website" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f8f5ef",
};

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      dir={getDirection(locale)}
      className={`${readex.variable} ${bodoni.variable} ${reemKufi.variable} antialiased`}
    >
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
