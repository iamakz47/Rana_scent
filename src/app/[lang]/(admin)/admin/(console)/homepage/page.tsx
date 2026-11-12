import type { Metadata } from "next";
import Link from "next/link";
import { StoreProviders } from "@/components/providers";
import { getDirection, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/features/admin/auth/dal";
import { reorderSlides } from "@/features/admin/homepage/actions";
import { SectionsForm, SliderSettingsForm } from "@/features/admin/homepage/homepage-forms";
import { getAdminDictionary } from "@/features/admin/i18n";
import { AdminPageHeader, adminButton, Badge, EmptyState, Notice, Panel, statusTone } from "@/features/admin/ui/primitives";
import { SortableList } from "@/features/admin/ui/sortable-list";
import { HeroCarousel } from "@/features/merchandising/hero-carousel";
import { HeroSlideContent } from "@/features/merchandising/hero-slide-content";
import { rowToHeroSlide, slideSelect, type SlideRow } from "@/features/merchandising/slide-rows";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminDictionary();
  return { title: t.homepage.title };
}

export default async function HomepageAdminPage({ searchParams }: PageProps<"/[lang]/admin/homepage">) {
  await requireStaff("content.write");
  const [{ locale, t }, dict, query] = await Promise.all([getAdminDictionary(), getDictionary(), searchParams]);
  const supabase = await createClient();
  const [settings, slides, sections] = await Promise.all([
    supabase.from("store_settings").select("slider_autoplay, slider_interval_seconds").eq("id", 1).single(),
    supabase.from("homepage_slides").select(slideSelect).order("position"),
    supabase.from("homepage_sections").select("key, position, is_visible").order("position"),
  ]);
  const rows = (slides.data ?? []) as unknown as SlideRow[];
  const previewSlides = rows.filter((row) => row.is_enabled).map(rowToHeroSlide);
  const interval = settings.data?.slider_interval_seconds ?? 4;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t.homepage.title}
        body={t.homepage.body}
        actions={
          <Link href={localePath(locale, "/admin/homepage/slides/new")} className={adminButton("primary")}>
            {t.homepage.newSlide}
          </Link>
        }
      />
      {query.saved === "slide" ? <Notice tone="success">{t.homepage.slideSaved}</Notice> : null}
      {query.saved === "deleted" ? <Notice tone="success">{t.homepage.slideDeleted}</Notice> : null}

      <Panel title={t.homepage.slides}>
        <div className="space-y-6">
          <SliderSettingsForm autoplay={settings.data?.slider_autoplay ?? true} interval={interval} />
          {rows.length === 0 ? (
            <EmptyState title={t.homepage.slides} body={t.homepage.emptySlides} />
          ) : (
            <SortableList
              action={reorderSlides}
              items={rows.map((row) => ({
                id: row.id,
                content: (
                  <Link href={localePath(locale, `/admin/homepage/slides/${row.id}`)} className="flex min-w-0 flex-wrap items-center gap-2 hover:text-gold-deep">
                    <span className="min-w-0 truncate font-medium text-ink">{locale === "ar" ? row.title_ar : row.title_en}</span>
                    <span className="ms-auto flex gap-1.5">
                      <Badge tone={statusTone(row.status)}>{t.status[row.status]}</Badge>
                      <Badge tone={row.is_enabled ? "success" : "neutral"}>{row.is_enabled ? t.common.enabled : t.common.disabled}</Badge>
                    </span>
                  </Link>
                ),
              }))}
            />
          )}
        </div>
      </Panel>

      {previewSlides.length > 0 ? (
        <Panel title={t.homepage.previewTitle} description={t.homepage.previewBody}>
          <div className="-m-5 overflow-hidden rounded-b-2xl">
            <StoreProviders locale={locale} dir={getDirection(locale)} dict={dict}>
              <HeroCarousel
                autoplay={settings.data?.slider_autoplay ?? true}
                intervalMs={interval * 1000}
                slides={previewSlides.map((slide, index) => ({
                  id: slide.id,
                  label: slide.title[locale],
                  content: <HeroSlideContent slide={slide} locale={locale} priority={index === 0} />,
                }))}
              />
            </StoreProviders>
          </div>
        </Panel>
      ) : null}

      <Panel title={t.homepage.sections} description={t.homepage.sectionsBody}>
        <SectionsForm sections={(sections.data ?? []).map((s) => ({ key: s.key, visible: s.is_visible }))} />
      </Panel>
    </div>
  );
}
