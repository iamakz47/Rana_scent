import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { localePath } from "@/i18n/config";
import { format } from "@/i18n/format";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/features/admin/auth/dal";
import { formatDateTime } from "@/features/admin/format";
import { getAdminDictionary } from "@/features/admin/i18n";
import { PageEditor } from "@/features/admin/pages/page-editor";
import { AdminPageHeader, Badge, Notice } from "@/features/admin/ui/primitives";
import { builtInContent } from "@/features/site-pages/defaults";
import { isSitePageKey, parsePageContent } from "@/features/site-pages/schema";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminDictionary();
  return { title: t.p8.pages.title };
}

export default async function EditPagePage({ params }: PageProps<"/[lang]/admin/pages/[key]">) {
  await requireStaff("content.write");
  const { key } = await params;
  if (!isSitePageKey(key)) notFound();
  const { locale, t } = await getAdminDictionary();
  const c = t.p8.pages;
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("site_pages")
    .select("draft_content, draft_updated_at, published_at")
    .eq("key", key)
    .maybeSingle();
  // A draft that was never saved starts from the page's built-in text.
  const saved = row ? parsePageContent(row.draft_content) : null;
  const hasDraft = Boolean(saved && (saved.title.ar || saved.title.en));
  const initial = hasDraft ? saved! : builtInContent(key);
  const storePath = key === "about" ? "/about" : key === "contact" ? "/contact" : "/faq";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow={c.title}
        title={c.names[key]}
        body={
          row
            ? `${format(c.draftUpdated, { date: formatDateTime(row.draft_updated_at, locale) })}${
                row.published_at ? ` · ${format(c.publishedOn, { date: formatDateTime(row.published_at, locale) })}` : ""
              }`
            : undefined
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={row?.published_at ? "success" : "neutral"}>{row?.published_at ? c.published : c.notPublished}</Badge>
            <Link href={localePath(locale, storePath)} target="_blank" className="text-step--1 underline underline-offset-4">
              {c.viewLive}
            </Link>
          </div>
        }
      />
      {error || !row ? (
        <Notice tone="danger">{c.unavailable}</Notice>
      ) : (
        <PageEditor key={key} pageKey={key} initial={initial} fromBuiltIn={!hasDraft} published={Boolean(row.published_at)} />
      )}
    </div>
  );
}
