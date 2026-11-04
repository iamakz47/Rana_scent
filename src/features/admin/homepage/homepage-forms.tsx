"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { localePath } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { useAdminI18n } from "@/features/admin/i18n/client";
import { MediaPicker, type PickerAsset } from "@/features/admin/media/media-picker";
import { ActionMessage, idle, SubmitButton, type ActionResult } from "@/features/admin/ui/form";
import { adminButton, BilingualFields, Checkbox, Field, Panel, Select, TextInput } from "@/features/admin/ui/primitives";
import { deleteSlide, saveSections, saveSlide, saveSliderSettings } from "./actions";

export function SliderSettingsForm({ autoplay, interval }: { autoplay: boolean; interval: number }) {
  const { locale, t } = useAdminI18n();
  const [state, action] = useActionState<ActionResult, FormData>(saveSliderSettings, idle);
  return (
    <form action={action} className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <input type="hidden" name="locale" value={locale} />
      <Field label={t.homepage.interval} htmlFor="slider_interval_seconds" hint={t.homepage.intervalHint} className="sm:max-w-sm">
        <TextInput
          id="slider_interval_seconds"
          name="slider_interval_seconds"
          type="number"
          min={2}
          max={30}
          step={1}
          required
          defaultValue={interval}
          dir="ltr"
          className="sm:w-32"
        />
      </Field>
      <Checkbox name="slider_autoplay" label={t.homepage.autoplay} defaultChecked={autoplay} className="sm:mb-7" />
      <div className="flex flex-wrap items-center gap-3 sm:mb-6">
        <SubmitButton size="sm">{t.common.save}</SubmitButton>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

export function SectionsForm({ sections }: { sections: Array<{ key: string; visible: boolean }> }) {
  const { locale, t } = useAdminI18n();
  const [order, setOrder] = useState(sections);
  const [state, action] = useActionState<ActionResult, FormData>(saveSections, idle);
  const move = (index: number, delta: number) =>
    setOrder((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <ol className="divide-y divide-ink/8 rounded-xl border border-ink/10">
        {order.map((section, index) => (
          <li key={section.key} className="flex items-center gap-3 px-3 py-2">
            <input type="hidden" name="order" value={section.key} />
            <span className="w-5 text-center text-taupe tabular-nums">{index + 1}</span>
            <Checkbox
              name={`visible_${section.key}`}
              defaultChecked={section.visible}
              label={t.homepage.sectionNames[section.key] ?? section.key}
              className="flex-1"
            />
            <button type="button" className={cn(adminButton("ghost", "sm"), "px-2")} onClick={() => move(index, -1)} disabled={index === 0} aria-label={t.common.moveUp}>
              ↑
            </button>
            <button
              type="button"
              className={cn(adminButton("ghost", "sm"), "px-2")}
              onClick={() => move(index, 1)}
              disabled={index === order.length - 1}
              aria-label={t.common.moveDown}
            >
              ↓
            </button>
          </li>
        ))}
      </ol>
      <p className="text-[0.78rem] text-ink-soft">{t.homepage.featuredHint}</p>
      <p className="text-[0.78rem] text-ink-soft">{t.homepage.categoriesHint}</p>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton size="sm">{t.common.save}</SubmitButton>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

export type SlideValues = {
  id?: string;
  status: "draft" | "published";
  is_enabled: boolean;
  theme: "light" | "dark";
  title_ar: string;
  title_en: string;
  description_ar: string;
  description_en: string;
  primary_cta_label_ar: string;
  primary_cta_label_en: string;
  primary_cta_href: string;
  secondary_cta_label_ar: string;
  secondary_cta_label_en: string;
  secondary_cta_href: string;
  desktop_media_id: string;
  mobile_media_id: string;
  composition: string;
  accent: string;
  alt_ar: string;
  alt_en: string;
};

export function SlideForm({ values, library }: { values: SlideValues; library: PickerAsset[] }) {
  const { locale, t } = useAdminI18n();
  const [state, action] = useActionState<ActionResult, FormData>(saveSlide, idle);
  const [deleteState, deleteAction] = useActionState<ActionResult, FormData>(deleteSlide, idle);
  const labels = { ar: t.common.arabic, en: t.common.english };
  return (
    <div className="space-y-6">
      <form action={action} className="space-y-6">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={values.id ?? ""} />
        <Panel title={t.homepage.slideTitle}>
          <div className="space-y-4">
            <BilingualFields name="title" label={t.homepage.slideTitle} values={{ ar: values.title_ar, en: values.title_en }} required maxLength={90} labels={labels} />
            <BilingualFields
              name="description"
              label={t.homepage.slideDescription}
              values={{ ar: values.description_ar, en: values.description_en }}
              multiline
              rows={3}
              maxLength={240}
              labels={labels}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t.common.status} htmlFor="status">
                <Select id="status" name="status" defaultValue={values.status}>
                  <option value="draft">{t.status.draft}</option>
                  <option value="published">{t.status.published}</option>
                </Select>
              </Field>
              <Field label={t.homepage.theme} htmlFor="theme">
                <Select id="theme" name="theme" defaultValue={values.theme}>
                  <option value="light">{t.homepage.themes.light}</option>
                  <option value="dark">{t.homepage.themes.dark}</option>
                </Select>
              </Field>
              <Checkbox name="is_enabled" label={t.common.enabled} defaultChecked={values.is_enabled} className="sm:mt-8" />
            </div>
          </div>
        </Panel>
        <Panel title={t.homepage.primaryCta}>
          <div className="space-y-4">
            <BilingualFields
              name="primary_cta_label"
              label={t.homepage.ctaLabel}
              values={{ ar: values.primary_cta_label_ar, en: values.primary_cta_label_en }}
              required
              maxLength={32}
              labels={labels}
            />
            <Field label={t.homepage.ctaHref} htmlFor="primary_cta_href" hint={t.homepage.ctaHrefHint}>
              <TextInput id="primary_cta_href" name="primary_cta_href" dir="ltr" required defaultValue={values.primary_cta_href} pattern="/[^/].*|/" />
            </Field>
          </div>
        </Panel>
        <Panel title={t.homepage.secondaryCta} description={t.common.optional}>
          <div className="space-y-4">
            <BilingualFields
              name="secondary_cta_label"
              label={t.homepage.ctaLabel}
              values={{ ar: values.secondary_cta_label_ar, en: values.secondary_cta_label_en }}
              maxLength={32}
              labels={labels}
            />
            <Field label={t.homepage.ctaHref} htmlFor="secondary_cta_href" hint={t.homepage.ctaHrefHint}>
              <TextInput id="secondary_cta_href" name="secondary_cta_href" dir="ltr" defaultValue={values.secondary_cta_href} />
            </Field>
          </div>
        </Panel>
        <Panel title={t.homepage.desktopImage} description={t.homepage.compositionHint}>
          <div className="space-y-5">
            <MediaPicker name="desktop_media_id" library={library} initial={values.desktop_media_id ? [values.desktop_media_id] : []} label={t.homepage.desktopImage} />
            <div>
              <p className="mb-2 text-step--1 font-medium text-ink">{t.homepage.mobileImage}</p>
              <MediaPicker name="mobile_media_id" library={library} initial={values.mobile_media_id ? [values.mobile_media_id] : []} label={t.homepage.mobileImage} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.homepage.composition} htmlFor="composition" hint={t.homepage.compositionHint}>
                <Select id="composition" name="composition" defaultValue={values.composition}>
                  <option value="">{t.common.none}</option>
                  {(["diffusers", "refills", "accessories"] as const).map((c) => (
                    <option key={c} value={c}>
                      {t.homepage.compositions[c]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t.homepage.accent} htmlFor="accent">
                <Select id="accent" name="accent" defaultValue={values.accent}>
                  <option value="">{t.common.none}</option>
                  {(["oud", "musk", "floral", "fresh", "woody"] as const).map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <BilingualFields name="alt" label={t.homepage.alt} values={{ ar: values.alt_ar, en: values.alt_en }} maxLength={160} labels={labels} />
          </div>
        </Panel>
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pending={t.common.saving}>{values.id ? t.common.save : t.common.create}</SubmitButton>
          <Link href={localePath(locale, "/admin/homepage")} className={adminButton("ghost")}>
            {t.common.back}
          </Link>
          <ActionMessage state={state} />
        </div>
      </form>
      {values.id ? (
        <form
          action={deleteAction}
          className="border-t border-ink/10 pt-4"
          onSubmit={(event) => {
            if (!window.confirm(t.homepage.deleteSlideConfirm)) event.preventDefault();
          }}
        >
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value={values.id} />
          <SubmitButton tone="danger" size="sm">
            {t.common.delete}
          </SubmitButton>
          <ActionMessage state={deleteState} />
        </form>
      ) : null}
    </div>
  );
}
