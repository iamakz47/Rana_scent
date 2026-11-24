import type { Metadata } from "next";
import Link from "next/link";
import { localePath } from "@/i18n/config";
import { format } from "@/i18n/format";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/features/admin/auth/dal";
import { formatDateTime } from "@/features/admin/format";
import { getAdminDictionary } from "@/features/admin/i18n";
import { AdminPageHeader, Badge, Notice } from "@/features/admin/ui/primitives";
import { sitePageKeys } from "@/features/site-pages/schema";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminDictionary();
  return { title: t.p8.pages.title };
}

export default async function PagesPage() {
  await requireStaff("content.write");
  const { locale, t } = await getAdminDictionary();
  const c = t.p8.pages;
  const supabase = await createClient();
  const { data, error } = await supabase.from("site_pages").select("key, draft_content, published_content, draft_updated_at, published_at");
  const rows = new Map((data ?? []).map((row) => [row.key, row]));

  return (
    <div className="space-y-6">
      <AdminPageHeader title={c.title} body={c.body} />
      {error ? <Notice tone="danger">{c.unavailable}</Notice> : null}
      <ul className="divide-y divide-ink/8 overflow-hidden rounded-2xl border border-ink/10 bg-canvas">
        {sitePageKeys.map((key) => {
          const row = rows.get(key);
          const changed = row?.published_at && JSON.stringify(row.draft_content) !== JSON.stringify(row.published_content);
          return (
            <li key={key}>
              <Link
                href={localePath(locale, `/admin/pages/${key}`)}
                className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-surface/70"
              >
                <span className="min-w-0">
                  <span className="block font-medium text-ink">{c.names[key]}</span>
                  {row ? (
                    <span className="block text-[0.78rem] text-ink-soft">
                      {format(c.draftUpdated, { date: formatDateTime(row.draft_updated_at, locale) })}
                      {row.published_at ? ` · ${format(c.publishedOn, { date: formatDateTime(row.published_at, locale) })}` : ""}
                    </span>
                  ) : null}
                </span>
                <span className="flex gap-2">
                  <Badge tone={row?.published_at ? "success" : "neutral"}>{row?.published_at ? c.published : c.notPublished}</Badge>
                  {changed ? <Badge tone="warning">{c.changes}</Badge> : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
