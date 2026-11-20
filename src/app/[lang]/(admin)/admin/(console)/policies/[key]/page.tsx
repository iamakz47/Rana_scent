import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RichText } from "@/components/ui/rich-text";
import { localePath } from "@/i18n/config";
import { format } from "@/i18n/format";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/features/admin/auth/dal";
import { formatDateTime } from "@/features/admin/format";
import { getAdminDictionary } from "@/features/admin/i18n";
import { PolicyDraftForm, PolicyPublishForm } from "@/features/admin/policies/policy-forms";
import { AdminPageHeader, Badge, Notice, Panel } from "@/features/admin/ui/primitives";
import { isPolicyKey, ownerMarker } from "@/features/policies/keys";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminDictionary();
  return { title: t.p5.policies.title };
}

export default async function PolicyEditPage({ params }: PageProps<"/[lang]/admin/policies/[key]">) {
  await requireStaff("settings.write");
  const { key } = await params;
  if (!isPolicyKey(key)) notFound();
  const { locale, t } = await getAdminDictionary();
  const c = t.p5.policies;
  const supabase = await createClient();
  const { data: p } = await supabase.from("site_policies").select("*").eq("key", key).maybeSingle();
  if (!p) notFound();
  const markers = ownerMarker.test(p.draft_body_ar) || ownerMarker.test(p.draft_body_en) || ownerMarker.test(p.draft_title_en);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow={c.title}
        title={locale === "ar" ? p.draft_title_ar : p.draft_title_en}
        body={`${format(c.draftUpdated, { date: formatDateTime(p.draft_updated_at, locale) })}${
          p.published_at ? ` · ${format(c.publishedOn, { date: formatDateTime(p.published_at, locale) })}` : ""
        }`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={p.published_at ? "success" : "neutral"}>{p.published_at ? c.published : c.notPublished}</Badge>
            {p.published_at ? (
              <Link href={localePath(locale, `/policies/${key}`)} className="text-step--1 underline underline-offset-4">
                {c.viewLive}
              </Link>
            ) : null}
          </div>
        }
      />
      {markers ? <Notice tone="warning">{c.markersWarning}</Notice> : null}
      <Panel title={c.saveDraft}>
        <PolicyDraftForm
          policyKey={key}
          values={{ title_ar: p.draft_title_ar, title_en: p.draft_title_en, body_ar: p.draft_body_ar, body_en: p.draft_body_en }}
        />
      </Panel>
      <Panel title={c.preview}>
        <div className="grid gap-6 lg:grid-cols-2">
          {(["ar", "en"] as const).map((lang) => (
            <article key={lang} dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} className="min-w-0 rounded-2xl border border-ink/10 p-4">
              <h2 className="font-display text-step-2 text-ink">{lang === "ar" ? p.draft_title_ar : p.draft_title_en}</h2>
              <RichText text={lang === "ar" ? p.draft_body_ar : p.draft_body_en} className="mt-3 text-step--1" />
            </article>
          ))}
        </div>
      </Panel>
      <Panel title={c.publish}>
        <PolicyPublishForm policyKey={key} published={Boolean(p.published_at)} />
      </Panel>
    </div>
  );
}
