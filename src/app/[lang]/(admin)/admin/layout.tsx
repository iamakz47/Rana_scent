import type { Metadata } from "next";
import { getDirection } from "@/i18n/config";
import { getAdminDictionary } from "@/features/admin/i18n";
import { AdminI18nProvider } from "@/features/admin/i18n/client";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminDictionary();
  return {
    title: { default: t.console, template: `%s · ${t.console} · ${t.brand}` },
    robots: { index: false, follow: false, nocache: true },
  };
}

// Shared by the sign-in pages and the console. Reads no session here, so the
// shell stays static; the console layout checks access inside Suspense.
export default async function AdminRootLayout({ children }: LayoutProps<"/[lang]/admin">) {
  const { locale, t } = await getAdminDictionary();
  return (
    <AdminI18nProvider value={{ locale, t }}>
      <div dir={getDirection(locale)} className="min-h-dvh bg-surface/60 text-ink">
        {children}
      </div>
    </AdminI18nProvider>
  );
}
