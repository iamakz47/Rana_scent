import type { Metadata } from "next";
import Link from "next/link";
import { localePath } from "@/i18n/config";
import { format } from "@/i18n/format";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/features/admin/auth/dal";
import { formatDateTime } from "@/features/admin/format";
import { getAdminDictionary } from "@/features/admin/i18n";
import { AdminPageHeader, Badge, Notice } from "@/features/admin/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminDictionary();
  return { title: t.p5.policies.title };
}

export default async function PoliciesPage() {
  await requireStaff("settings.write");
  const { locale, t } = await getAdminDictionary();
  const c = t.p5.policies;
  const supabase = await createClient();
  const { data: policies, error } = await supabase
    .from("site_policies")
    .select("key, draft_title_ar, draft_title_en, draft_body_ar, draft_body_en, published_title_ar, published_title_en, published_body_ar, published_body_en, draft_updated_at, published_at")
    .order("position");

  return (
    <div className="space-y-6">
      <AdminPageHeader title={c.title} body={c.body} />
      <Notice tone="warning">{c.draftsNotice}</Notice>
      {error ? <Notice tone="danger">{c.unavailable}</Notice> : null}
      <ul className="divide-y divide-ink/8 overflow-hidden rounded-2xl border border-ink/10 bg-canvas">
        {(policies ?? []).map((p) => {
          const changed =
            p.published_at &&
            (p.draft_title_ar !== p.published_title_ar || p.draft_title_en !== p.published_title_en ||
              p.draft_body_ar !== p.published_body_ar || p.draft_body_en !== p.published_body_en);
          return (
            <li key={p.key}>
              <Link
                href={localePath(locale, `/admin/policies/${p.key}`)}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-surface/70"
              >
                <span className="min-w-0">
                  <span className="block font-medium text-ink">{locale === "ar" ? p.draft_title_ar : p.draft_title_en}</span>
                  <span className="block text-[0.78rem] text-ink-soft">
                    {format(c.draftUpdated, { date: formatDateTime(p.draft_updated_at, locale) })}
                    {p.published_at ? ` · ${format(c.publishedOn, { date: formatDateTime(p.published_at, locale) })}` : ""}
                  </span>
                </span>
                <span className="flex gap-2">
                  <Badge tone={p.published_at ? "success" : "neutral"}>{p.published_at ? c.published : c.notPublished}</Badge>
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
