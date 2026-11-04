"use client";

import Link from "next/link";
import { useActionState } from "react";
import { localePath } from "@/i18n/config";
import { useAdminI18n } from "@/features/admin/i18n/client";
import { MediaPicker, type PickerAsset } from "@/features/admin/media/media-picker";
import { ActionMessage, idle, SubmitButton, type ActionResult } from "@/features/admin/ui/form";
import { adminButton, BilingualFields, Checkbox, Field, Panel, Select, TextInput } from "@/features/admin/ui/primitives";
import { saveCategory, setCategoryArchived } from "./actions";

export type CategoryValues = {
  id?: string;
  slug: string;
  product_type: string;
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
  image_id: string;
  position: number;
  is_visible: boolean;
  show_on_home: boolean;
  seo_title_ar: string;
  seo_title_en: string;
  seo_description_ar: string;
  seo_description_en: string;
  archived: boolean;
};

export function CategoryForm({ values, library }: { values: CategoryValues; library: PickerAsset[] }) {
  const { locale, t } = useAdminI18n();
  const [state, action] = useActionState<ActionResult, FormData>(saveCategory, idle);
  const [archiveState, archiveAction] = useActionState<ActionResult, FormData>(setCategoryArchived, idle);
  const labels = { ar: t.common.arabic, en: t.common.english };

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-6">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={values.id ?? ""} />
        <Panel title={t.products.sections.basics}>
          <div className="space-y-4">
            <BilingualFields name="name" label={t.categories.name} values={{ ar: values.name_ar, en: values.name_en }} required maxLength={80} labels={labels} />
            <BilingualFields
              name="description"
              label={t.categories.description}
              values={{ ar: values.description_ar, en: values.description_en }}
              multiline
              rows={3}
              maxLength={400}
              labels={labels}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t.products.slug} htmlFor="slug" hint={t.products.slugHint}>
                <TextInput id="slug" name="slug" dir="ltr" required defaultValue={values.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={60} />
              </Field>
              <Field label={t.categories.productType} htmlFor="product_type">
                <Select id="product_type" name="product_type" defaultValue={values.product_type}>
                  <option value="">{t.categories.anyType}</option>
                  {(["diffuser", "refill", "accessory", "bundle"] as const).map((type) => (
                    <option key={type} value={type}>
                      {t.products.types[type]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t.common.position} htmlFor="position" hint={t.products.positionHint}>
                <TextInput id="position" name="position" type="number" min={0} defaultValue={values.position} dir="ltr" />
              </Field>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <Checkbox name="is_visible" label={t.categories.visible} defaultChecked={values.is_visible} />
              <Checkbox name="show_on_home" label={t.categories.showOnHome} defaultChecked={values.show_on_home} />
            </div>
          </div>
        </Panel>
        <Panel title={t.categories.image}>
          <MediaPicker name="image_id" library={library} initial={values.image_id ? [values.image_id] : []} label={t.categories.image} />
        </Panel>
        <Panel title={t.products.sections.seo}>
          <div className="space-y-4">
            <BilingualFields name="seo_title" label={t.products.seoTitle} values={{ ar: values.seo_title_ar, en: values.seo_title_en }} maxLength={70} labels={labels} />
            <BilingualFields
              name="seo_description"
              label={t.products.seoDescription}
              values={{ ar: values.seo_description_ar, en: values.seo_description_en }}
              multiline
              rows={2}
              maxLength={170}
              labels={labels}
            />
          </div>
        </Panel>
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pending={t.common.saving}>{values.id ? t.common.save : t.common.create}</SubmitButton>
          <Link href={localePath(locale, "/admin/categories")} className={adminButton("ghost")}>
            {t.common.back}
          </Link>
          <ActionMessage state={state} />
        </div>
      </form>

      {values.id ? (
        <form action={archiveAction} className="flex flex-wrap items-center gap-3 border-t border-ink/10 pt-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value={values.id} />
          <input type="hidden" name="archive" value={values.archived ? "0" : "1"} />
          <SubmitButton tone="outline" size="sm">
            {values.archived ? t.common.restore : t.common.archive}
          </SubmitButton>
          <ActionMessage state={archiveState} />
        </form>
      ) : null}
    </div>
  );
}
