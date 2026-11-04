"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { localePath } from "@/i18n/config";
import { useAdminI18n } from "@/features/admin/i18n/client";
import { MediaPicker, type PickerAsset } from "@/features/admin/media/media-picker";
import { ActionMessage, idle, SubmitButton, type ActionResult } from "@/features/admin/ui/form";
import {
  adminButton,
  Badge,
  BilingualFields,
  Checkbox,
  Field,
  Notice,
  Panel,
  Select,
  statusTone,
  TextInput,
} from "@/features/admin/ui/primitives";
import { deleteProduct, saveProduct, setProductStatus } from "./actions";
import { productTypes, spaces } from "./schema";

export type VariantValue = {
  key: string;
  id?: string;
  sku: string;
  label_ar: string;
  label_en: string;
  price: string;
  compare_at: string;
  is_active: boolean;
  on_hand?: number;
};

export type ProductValues = {
  id?: string;
  slug: string;
  type: (typeof productTypes)[number];
  status: "draft" | "published" | "archived";
  name_ar: string;
  name_en: string;
  short_description_ar: string;
  short_description_en: string;
  description_ar: string;
  description_en: string;
  notes: { top: { ar: string; en: string }; heart: { ar: string; en: string }; base: { ar: string; en: string } };
  specs_ar: string;
  specs_en: string;
  specs_confirmed: boolean;
  spaces: string[];
  is_featured: boolean;
  is_new: boolean;
  position: number;
  category_id: string;
  seo_title_ar: string;
  seo_title_en: string;
  seo_description_ar: string;
  seo_description_en: string;
  variants: VariantValue[];
  media: string[];
  scents: string[];
  compatible: string[];
};

export type ProductOptions = {
  categories: Array<{ id: string; name: string }>;
  scents: Array<{ id: string; name: string }>;
  products: Array<{ id: string; name: string; type: string }>;
  library: PickerAsset[];
};

let keySeed = 0;
const newKey = () => `new-${++keySeed}`;

function VariantsEditor({ initial }: { initial: VariantValue[] }) {
  const { t } = useAdminI18n();
  const [rows, setRows] = useState<VariantValue[]>(
    initial.length
      ? initial
      : [{ key: "new-0", sku: "", label_ar: "", label_en: "", price: "", compare_at: "", is_active: true }],
  );
  const update = (key: string, patch: Partial<VariantValue>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  return (
    <div className="space-y-3">
      <input
        type="hidden"
        name="variants"
        value={JSON.stringify(rows.map(({ id, sku, label_ar, label_en, price, compare_at, is_active }) => ({ id: id ?? "", sku, label_ar, label_en, price, compare_at, is_active })))}
      />
      {rows.map((row, index) => (
        <fieldset key={row.key} className="min-w-0 rounded-xl border border-ink/10 bg-surface/60 p-4">
          <legend className="px-1 text-[0.72rem] uppercase tracking-[0.16em] text-ink-soft">
            {t.products.variant} {index + 1}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={t.products.sku} htmlFor={`${row.key}-sku`}>
              <TextInput
                id={`${row.key}-sku`}
                dir="ltr"
                required
                value={row.sku}
                onChange={(e) => update(row.key, { sku: e.target.value.toUpperCase() })}
                pattern="[A-Za-z0-9]+(-[A-Za-z0-9]+)*"
                maxLength={40}
              />
            </Field>
            <Field label={`${t.products.variantLabel} (${t.common.arabic})`} htmlFor={`${row.key}-la`}>
              <TextInput id={`${row.key}-la`} dir="rtl" lang="ar" required maxLength={60} value={row.label_ar} onChange={(e) => update(row.key, { label_ar: e.target.value })} />
            </Field>
            <Field label={`${t.products.variantLabel} (${t.common.english})`} htmlFor={`${row.key}-le`}>
              <TextInput id={`${row.key}-le`} dir="ltr" lang="en" required maxLength={60} value={row.label_en} onChange={(e) => update(row.key, { label_en: e.target.value })} />
            </Field>
            <Field label={t.products.priceKwd} htmlFor={`${row.key}-price`}>
              <TextInput
                id={`${row.key}-price`}
                dir="ltr"
                inputMode="decimal"
                required
                placeholder="0.000"
                value={row.price}
                onChange={(e) => update(row.key, { price: e.target.value })}
              />
            </Field>
            <Field label={t.products.compareAtKwd} htmlFor={`${row.key}-compare`} hint={t.products.compareAtHint}>
              <TextInput
                id={`${row.key}-compare`}
                dir="ltr"
                inputMode="decimal"
                placeholder="0.000"
                value={row.compare_at}
                onChange={(e) => update(row.key, { compare_at: e.target.value })}
              />
            </Field>
            <div className="flex flex-col justify-end gap-2">
              <Checkbox label={t.products.variantActive} checked={row.is_active} onChange={(e) => update(row.key, { is_active: e.target.checked })} />
              {row.on_hand !== undefined ? (
                <p className="text-[0.78rem] text-ink-soft">
                  {t.products.stock}: <span className="tabular-nums">{row.on_hand}</span>
                </p>
              ) : null}
            </div>
          </div>
          {rows.length > 1 ? (
            <button
              type="button"
              className={adminButton("ghost", "sm") + " mt-2"}
              onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
            >
              {t.products.removeVariant}
            </button>
          ) : null}
        </fieldset>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className={adminButton("outline", "sm")}
          onClick={() =>
            setRows((current) => [...current, { key: newKey(), sku: "", label_ar: "", label_en: "", price: "", compare_at: "", is_active: true }])
          }
        >
          {t.products.addVariant}
        </button>
        <p className="text-[0.78rem] text-ink-soft">{t.products.stockHint}</p>
      </div>
    </div>
  );
}

function CheckboxGroup({
  name,
  options,
  initial,
  asJson,
}: {
  name: string;
  options: Array<{ id: string; label: string }>;
  initial: string[];
  asJson?: boolean;
}) {
  const [values, setValues] = useState<string[]>(initial);
  const toggle = (id: string, on: boolean) =>
    setValues((current) => (on ? [...current, id] : current.filter((value) => value !== id)));
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {asJson ? <input type="hidden" name={name} value={JSON.stringify(values)} /> : null}
      {options.map((option) => (
        <Checkbox
          key={option.id}
          name={asJson ? undefined : name}
          value={option.id}
          label={option.label}
          checked={values.includes(option.id)}
          onChange={(e) => toggle(option.id, e.target.checked)}
        />
      ))}
    </div>
  );
}

function StatusControls({ id, status, canPublish }: { id: string; status: ProductValues["status"]; canPublish: boolean }) {
  const { locale, t } = useAdminI18n();
  const [state, action] = useActionState<ActionResult, FormData>(setProductStatus, idle);
  const [deleteState, deleteAction] = useActionState<ActionResult, FormData>(deleteProduct, idle);
  if (!canPublish) return <p className="text-step--1 text-ink-soft">{t.products.publishRole}</p>;
  const transitions: Array<{ to: ProductValues["status"]; label: string; tone: "primary" | "outline" | "danger" }> =
    status === "published"
      ? [
          { to: "draft", label: t.common.unpublish, tone: "outline" },
          { to: "archived", label: t.common.archive, tone: "outline" },
        ]
      : status === "draft"
        ? [
            { to: "published", label: t.common.publish, tone: "primary" },
            { to: "archived", label: t.common.archive, tone: "outline" },
          ]
        : [{ to: "draft", label: t.common.restore, tone: "outline" }];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {transitions.map((transition) => (
          <form key={transition.to} action={action}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="entity_id" value={id} />
            <input type="hidden" name="status" value={transition.to} />
            <SubmitButton tone={transition.tone} size="sm">
              {transition.label}
            </SubmitButton>
          </form>
        ))}
        {status !== "published" ? (
          <form
            action={deleteAction}
            onSubmit={(event) => {
              if (!window.confirm(t.products.deleteConfirm)) event.preventDefault();
            }}
          >
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="entity_id" value={id} />
            <SubmitButton tone="danger" size="sm">
              {t.common.delete}
            </SubmitButton>
          </form>
        ) : null}
      </div>
      <ActionMessage state={state.status !== "idle" ? state : deleteState} />
    </div>
  );
}

export function ProductEditor({
  values,
  options,
  canPublish,
  created,
}: {
  values: ProductValues;
  options: ProductOptions;
  canPublish: boolean;
  created?: boolean;
}) {
  const { locale, t } = useAdminI18n();
  const [state, action] = useActionState<ActionResult, FormData>(saveProduct, idle);
  const labels = { ar: t.common.arabic, en: t.common.english };
  const familyField = values.type === "refill" || values.type === "bundle";

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <form action={action} className="min-w-0 space-y-6" id="product-form">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="entity_id" value={values.id ?? ""} />
        {created ? <Notice tone="success">{t.products.created}</Notice> : null}

        <Panel title={t.products.sections.basics}>
          <div className="space-y-4">
            <BilingualFields name="name" label={t.products.name} values={{ ar: values.name_ar, en: values.name_en }} required maxLength={120} labels={labels} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.products.slug} htmlFor="slug" hint={t.products.slugHint} error={state.fieldErrors?.slug ? t.products.slugHint : undefined}>
                <TextInput id="slug" name="slug" dir="ltr" required defaultValue={values.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} />
              </Field>
              <Field label={t.products.type} htmlFor="type">
                <Select id="type" name="type" defaultValue={values.type}>
                  {productTypes.map((type) => (
                    <option key={type} value={type}>
                      {t.products.types[type]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>
        </Panel>

        <Panel title={t.products.sections.content}>
          <div className="space-y-4">
            <BilingualFields
              name="short_description"
              label={t.products.shortDescription}
              values={{ ar: values.short_description_ar, en: values.short_description_en }}
              maxLength={200}
              labels={labels}
            />
            <BilingualFields
              name="description"
              label={t.products.description}
              values={{ ar: values.description_ar, en: values.description_en }}
              multiline
              rows={6}
              maxLength={5000}
              labels={labels}
            />
          </div>
        </Panel>

        <Panel title={t.products.sections.variants}>
          <VariantsEditor initial={values.variants} />
          {state.fieldErrors?.variants ? <p className="mt-2 text-step--1 text-[#86352b]">{t.common.error}</p> : null}
        </Panel>

        <Panel title={t.products.sections.images} description={t.products.imagesHint}>
          <MediaPicker name="media" library={options.library} initial={values.media} multiple label={t.products.images} />
        </Panel>

        <Panel title={t.products.sections.organisation}>
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.products.category} htmlFor="category_id">
                <Select id="category_id" name="category_id" defaultValue={values.category_id}>
                  <option value="">{t.products.noCategory}</option>
                  {options.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t.common.position} htmlFor="position" hint={t.products.positionHint}>
                <TextInput id="position" name="position" type="number" min={0} max={100000} defaultValue={values.position} dir="ltr" />
              </Field>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <Checkbox name="is_featured" label={t.products.featured} defaultChecked={values.is_featured} />
              <Checkbox name="is_new" label={t.products.isNew} defaultChecked={values.is_new} />
            </div>
            <fieldset>
              <legend className="mb-2 text-step--1 font-medium text-ink">{t.products.scents}</legend>
              <CheckboxGroup name="scents" asJson options={options.scents.map((s) => ({ id: s.id, label: s.name }))} initial={values.scents} />
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-step--1 font-medium text-ink">{t.products.spaces}</legend>
              <CheckboxGroup
                name="spaces"
                options={spaces.map((space) => ({ id: space, label: t.spaces[space] ?? space }))}
                initial={values.spaces}
              />
            </fieldset>
          </div>
        </Panel>

        <Panel title={t.products.sections.compatibility} description={t.products.worksWith}>
          {options.products.length === 0 ? (
            <p className="text-step--1 text-ink-soft">{t.products.emptyBody}</p>
          ) : (
            <CheckboxGroup
              name="compatible"
              asJson
              options={options.products.map((p) => ({ id: p.id, label: `${p.name} · ${t.products.types[p.type as "refill"] ?? p.type}` }))}
              initial={values.compatible}
            />
          )}
        </Panel>

        <Panel title={t.products.sections.details}>
          <div className="space-y-5">
            {familyField || values.notes.top.ar || values.notes.top.en ? (
              <div className="space-y-3">
                <p className="text-step--1 font-medium text-ink">{t.products.notes}</p>
                <BilingualFields name="notes_top" label={t.products.notesTop} values={values.notes.top} maxLength={80} labels={labels} />
                <BilingualFields name="notes_heart" label={t.products.notesHeart} values={values.notes.heart} maxLength={80} labels={labels} />
                <BilingualFields name="notes_base" label={t.products.notesBase} values={values.notes.base} maxLength={80} labels={labels} />
              </div>
            ) : null}
            <BilingualFields
              name="specs"
              label={t.products.specs}
              values={{ ar: values.specs_ar, en: values.specs_en }}
              multiline
              rows={5}
              hint={t.products.specsHint}
              labels={labels}
            />
            {state.fieldErrors?.specs ? <p className="text-step--1 text-[#86352b]">{t.products.specsHint}</p> : null}
            <Checkbox name="specs_confirmed" label={t.products.specsConfirmed} defaultChecked={values.specs_confirmed} />
          </div>
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

        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-ink/10 bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
          <SubmitButton pending={t.common.saving}>{values.id ? t.common.save : t.common.create}</SubmitButton>
          <Link href={localePath(locale, "/admin/products")} className={adminButton("ghost")}>
            {t.common.back}
          </Link>
          <div className="min-w-0 flex-1">
            <ActionMessage state={state} />
          </div>
        </div>
      </form>

      {values.id ? (
        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <Panel title={t.products.sections.publishing}>
            <div className="space-y-4">
              <Badge tone={statusTone(values.status)}>{t.status[values.status]}</Badge>
              <StatusControls id={values.id} status={values.status} canPublish={canPublish} />
              {values.status === "published" ? (
                <Link href={localePath(locale, `/products/${values.slug}`)} className={adminButton("outline", "sm")} target="_blank">
                  {t.products.viewOnStore}
                </Link>
              ) : null}
            </div>
          </Panel>
        </aside>
      ) : null}
    </div>
  );
}
