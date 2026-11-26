"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { localePath } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { useAdminI18n } from "@/features/admin/i18n/client";
import type { PickerAsset } from "@/features/admin/media/media-picker";
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
  TextArea,
  TextInput,
} from "@/features/admin/ui/primitives";
import { deleteProduct, duplicateProduct, saveProduct, setProductStatus } from "./actions";
import { InfoSectionsFields } from "./details-fields";
import { PhotoPicker } from "./photo-picker";
import { simpleSpecKeys, type DeviceSpecs, type InfoSections, type SimpleSpecKey } from "@/features/catalog/product-details";
import { useFormAction } from "@/lib/use-form-action";
import { editorProductTypes, productTypes, spaces } from "./schema";

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
  // Phase 6: colour swatch, wanted stock and this colour's photos.
  color_hex?: string;
  stock?: string;
  media?: string[];
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
  device_specs: DeviceSpecs;
  simple_specs: Record<SimpleSpecKey, { ar: string; en: string }>;
  info_sections: InfoSections;
  free_fragrances: "" | "1" | "2";
  free_fragrance_eligible: boolean;
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
  // A SKU suggestion for a new product's first variant.
  new_sku: string;
};

export type ProductOptions = {
  categories: Array<{ id: string; name: string }>;
  scents: Array<{ id: string; name: string }>;
  products: Array<{ id: string; name: string; type: string }>;
  library: PickerAsset[];
};

let keySeed = 0;
const newKey = () => `new-${++keySeed}`;
const randomSku = () => `RS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

// Common device colours, one click away; any colour can still be picked.
const swatchPresets = ["#111111", "#f5f5f0", "#b3261e", "#c9a45c", "#b8b8b8", "#6b4f3a", "#4a4a4a", "#e8dccb", "#1f3a5f", "#2f5d50"];

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

function ColorCard({
  value,
  index,
  isDefault,
  canAdjust,
  library,
  onUploaded,
  onChange,
  onRemove,
  onMakeDefault,
}: {
  value: VariantValue;
  index: number;
  isDefault: boolean;
  canAdjust: boolean;
  library: PickerAsset[];
  onUploaded: (asset: PickerAsset) => void;
  onChange: (patch: Partial<VariantValue>) => void;
  onRemove: () => void;
  onMakeDefault: () => void;
}) {
  const { t } = useAdminI18n();
  const c = t.p6;
  const id = `color-${value.key}`;
  return (
    <fieldset
      className={cn("min-w-0 rounded-2xl border bg-surface/50 p-4", isDefault ? "border-gold/60" : "border-ink/10")}
      data-testid="color-card"
    >
      <legend className="flex items-center gap-2 px-1 text-step--1 font-medium text-ink">
        <span aria-hidden className="inline-block size-5 rounded-full border border-ink/20" style={{ background: value.color_hex || "#ffffff" }} />
        {value.label_ar || `${c.colorName} ${index + 1}`}
        {isDefault ? <Badge tone="gold">{c.defaultColor}</Badge> : null}
      </legend>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={c.colorName} htmlFor={`${id}-ar`}>
          <TextInput id={`${id}-ar`} dir="rtl" lang="ar" required maxLength={60} value={value.label_ar} onChange={(e) => onChange({ label_ar: e.target.value })} placeholder="أسود" />
        </Field>
        <Field label={c.colorNameEn} htmlFor={`${id}-en`}>
          <TextInput id={`${id}-en`} dir="ltr" lang="en" maxLength={60} value={value.label_en} onChange={(e) => onChange({ label_en: e.target.value })} placeholder="Black" />
        </Field>
      </div>

      <div className="mt-3">
        <p className="mb-1.5 text-step--1 font-medium text-ink">{c.swatch}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {swatchPresets.map((hex) => (
            <button
              key={hex}
              type="button"
              aria-label={hex}
              aria-pressed={value.color_hex?.toLowerCase() === hex}
              onClick={() => onChange({ color_hex: hex })}
              className={cn(
                "grid size-8 place-items-center rounded-full border-2",
                value.color_hex?.toLowerCase() === hex ? "border-gold-deep" : "border-transparent hover:border-ink/20",
              )}
            >
              <span aria-hidden className="size-5 rounded-full border border-ink/20" style={{ background: hex }} />
            </button>
          ))}
          <input
            type="color"
            aria-label={c.swatch}
            value={value.color_hex || "#111111"}
            onChange={(e) => onChange({ color_hex: e.target.value })}
            className="h-8 w-10 cursor-pointer rounded border border-ink/15 bg-canvas"
          />
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field label={c.stock} htmlFor={`${id}-stock`} hint={canAdjust ? undefined : c.stockReadOnly}>
          <TextInput
            id={`${id}-stock`}
            type="number"
            min={0}
            max={999999}
            dir="ltr"
            value={value.stock ?? ""}
            readOnly={!canAdjust}
            onChange={(e) => onChange({ stock: e.target.value })}
          />
        </Field>
        <Field label={c.colorPrice} htmlFor={`${id}-price`}>
          <TextInput id={`${id}-price`} dir="ltr" inputMode="decimal" placeholder="0.000" value={value.price} onChange={(e) => onChange({ price: e.target.value })} />
        </Field>
        <Field label={c.sku} htmlFor={`${id}-sku`}>
          <TextInput
            id={`${id}-sku`}
            dir="ltr"
            required
            value={value.sku}
            pattern="[A-Za-z0-9]+(-[A-Za-z0-9]+)*"
            maxLength={40}
            onChange={(e) => onChange({ sku: e.target.value.toUpperCase() })}
          />
        </Field>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-step--1 font-medium text-ink">{c.colorPhotos}</p>
        <PhotoPicker
          value={value.media ?? []}
          onChange={(media) => onChange({ media })}
          library={library}
          onUploaded={onUploaded}
          label={`${c.colorPhotos}: ${value.label_ar}`}
          testId="color-photos"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-ink/8 pt-3">
        <Checkbox label={c.available} checked={value.is_active} onChange={(e) => onChange({ is_active: e.target.checked })} />
        {!isDefault ? (
          <button type="button" className={adminButton("ghost", "sm")} onClick={onMakeDefault}>
            {c.makeDefault}
          </button>
        ) : null}
        <button
          type="button"
          className={cn(adminButton("ghost", "sm"), "text-[#86352b]")}
          onClick={() => {
            if (window.confirm(c.removeConfirm)) onRemove();
          }}
        >
          {c.removeColor}
        </button>
      </div>
    </fieldset>
  );
}

// Price and stock for products without colours: one item, or a few options
// such as sizes.
function OptionRows({
  rows,
  canAdjust,
  onChange,
  onAdd,
  onRemove,
}: {
  rows: VariantValue[];
  canAdjust: boolean;
  onChange: (key: string, patch: Partial<VariantValue>) => void;
  onAdd: () => void;
  onRemove: (key: string) => void;
}) {
  const { t } = useAdminI18n();
  const c = t.p6;
  const single = rows.length === 1;
  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div key={row.key} className={cn(!single && "rounded-xl border border-ink/10 bg-surface/50 p-4")} data-testid="option-row">
          {!single ? (
            <div className="mb-3 grid gap-3 sm:grid-cols-2">
              <Field label={c.optionName} htmlFor={`${row.key}-la`}>
                <TextInput id={`${row.key}-la`} dir="rtl" lang="ar" required maxLength={60} value={row.label_ar} onChange={(e) => onChange(row.key, { label_ar: e.target.value })} />
              </Field>
              <Field label={c.optionNameEn} htmlFor={`${row.key}-le`}>
                <TextInput id={`${row.key}-le`} dir="ltr" lang="en" maxLength={60} value={row.label_en} onChange={(e) => onChange(row.key, { label_en: e.target.value })} />
              </Field>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={c.price} htmlFor={index === 0 ? "price" : `${row.key}-price`}>
              <TextInput
                id={index === 0 ? "price" : `${row.key}-price`}
                dir="ltr"
                inputMode="decimal"
                required
                placeholder="0.000"
                value={row.price}
                onChange={(e) => onChange(row.key, { price: e.target.value })}
              />
            </Field>
            <Field label={c.stock} htmlFor={index === 0 ? "stock" : `${row.key}-stock`} hint={canAdjust ? undefined : c.stockReadOnly}>
              <TextInput
                id={index === 0 ? "stock" : `${row.key}-stock`}
                type="number"
                min={0}
                max={999999}
                dir="ltr"
                readOnly={!canAdjust}
                value={row.stock ?? ""}
                onChange={(e) => onChange(row.key, { stock: e.target.value })}
              />
            </Field>
            <Field label={c.sku} htmlFor={index === 0 ? "sku" : `${row.key}-sku`} hint={index === 0 ? c.skuHint : undefined}>
              <TextInput
                id={index === 0 ? "sku" : `${row.key}-sku`}
                dir="ltr"
                required
                pattern="[A-Za-z0-9]+(-[A-Za-z0-9]+)*"
                maxLength={40}
                value={row.sku}
                onChange={(e) => onChange(row.key, { sku: e.target.value.toUpperCase() })}
              />
            </Field>
          </div>
          {!single ? (
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <Checkbox label={c.available} checked={row.is_active} onChange={(e) => onChange(row.key, { is_active: e.target.checked })} />
              <button type="button" className={adminButton("ghost", "sm")} onClick={() => onRemove(row.key)}>
                {c.removeOption}
              </button>
            </div>
          ) : null}
        </div>
      ))}
      <button type="button" className={cn(adminButton("ghost", "sm"), "px-0 underline underline-offset-4")} onClick={onAdd}>
        {c.addOption}
      </button>
    </div>
  );
}

function DuplicateButton({ id }: { id: string }) {
  const { locale, t } = useAdminI18n();
  const [state, action] = useActionState<ActionResult, FormData>(duplicateProduct, idle);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="entity_id" value={id} />
      <SubmitButton tone="outline" size="sm" pending={t.common.saving}>
        {t.p6.duplicate}
      </SubmitButton>
      <p className="text-[0.78rem] text-ink-soft">{t.p6.duplicateHint}</p>
      <ActionMessage state={state} />
    </form>
  );
}
export function ProductEditor({
  values,
  options,
  canPublish,
  canAdjust = true,
  created,
  duplicated,
}: {
  values: ProductValues;
  options: ProductOptions;
  canPublish: boolean;
  canAdjust?: boolean;
  created?: "draft" | "published";
  duplicated?: boolean;
}) {
  const { locale, t } = useAdminI18n();
  const c = t.p6;
  // Keeps everything typed if the server rejects the save.
  const [state, action, , submit] = useFormAction<ActionResult>(saveProduct, idle);
  const labels = { ar: t.common.arabic, en: t.common.english };

  const [library, setLibrary] = useState(options.library);
  const addToLibrary = (asset: PickerAsset) => setLibrary((current) => (current.some((a) => a.id === asset.id) ? current : [asset, ...current]));
  const [type, setType] = useState(values.type);
  const [shared, setShared] = useState(values.media);
  const initialColorMode = values.variants.some((v) => v.color_hex);
  const [basePrice, setBasePrice] = useState(values.variants[0]?.price ?? "");
  const [variants, setVariants] = useState<VariantValue[]>(() => {
    if (!values.variants.length) {
      return [{ key: "new-0", sku: values.new_sku || randomSku(), label_ar: "", label_en: "", price: "", compare_at: "", is_active: true, stock: "0", color_hex: "", media: [] }];
    }
    // Colours show their own price only when it differs from the base price.
    return values.variants.map((v) => (initialColorMode && v.price === values.variants[0].price ? { ...v, price: "" } : v));
  });
  const colorMode = variants.some((v) => v.color_hex);
  const [showEnglish, setShowEnglish] = useState(simpleSpecKeys.some((key) => values.simple_specs[key].en));
  const [descTab, setDescTab] = useState<"ar" | "en">("ar");
  const [advancedOpen, setAdvancedOpen] = useState(Boolean(state.fieldErrors?.slug));

  const patch = (key: string, change: Partial<VariantValue>) =>
    setVariants((current) => current.map((v) => (v.key === key ? { ...v, ...change } : v)));

  const addColor = () => {
    if (!colorMode && variants.length === 1) {
      // The product's single item becomes its first colour (keeping its stock).
      const only = variants[0];
      setBasePrice(only.price || basePrice);
      const generic = ["قياسي", "Standard"].includes(only.label_ar) || !only.label_ar;
      setVariants([{ ...only, color_hex: "#111111", price: "", label_ar: generic ? "" : only.label_ar, label_en: generic ? "" : only.label_en, media: only.media ?? [] }]);
      return;
    }
    if (!colorMode) setBasePrice(variants[0]?.price || basePrice);
    const used = new Set(variants.map((v) => v.color_hex?.toLowerCase()));
    const hex = swatchPresets.find((h) => !used.has(h)) ?? "#111111";
    setVariants((current) => [
      ...current.map((v) => (v.color_hex ? v : { ...v, color_hex: "#111111", price: v.price === basePrice ? "" : v.price })),
      { key: newKey(), sku: randomSku(), label_ar: "", label_en: "", price: "", compare_at: "", is_active: true, color_hex: hex, stock: "0", media: [] },
    ]);
  };

  const removeVariant = (key: string) =>
    setVariants((current) => {
      const next = current.filter((v) => v.key !== key);
      return next.length
        ? next
        : [{ key: newKey(), sku: randomSku(), label_ar: "", label_en: "", price: basePrice, compare_at: "", is_active: true, stock: "0", color_hex: "", media: [] }];
    });

  // What is posted: every variant with its final price, and photos with
  // their colour (matched by SKU so new colours work in the same save).
  const posted = variants.map((v) => ({
    id: v.id ?? "",
    sku: v.sku,
    label_ar: v.label_ar || (colorMode ? "" : "قياسي"),
    label_en: v.label_en || (v.label_ar ? "" : colorMode ? "" : "Standard"),
    price: colorMode ? v.price.trim() || basePrice : v.price,
    compare_at: v.compare_at,
    is_active: v.is_active,
    color_hex: v.color_hex ?? "",
    stock: canAdjust ? (v.stock ?? "") : "",
  }));
  // Colour photos are linked to their colour; a photo can belong to one colour.
  const colorMedia = colorMode
    ? variants
        .flatMap((v) => (v.media ?? []).map((id) => ({ media_id: id, variant_sku: v.sku })))
        .filter((m, i, all) => all.findIndex((x) => x.media_id === m.media_id) === i)
    : [];
  const sharedOnly = shared.filter((id) => !colorMedia.some((m) => m.media_id === id));
  const mediaPayload = [...sharedOnly, ...colorMedia.map((m) => m.media_id)];
  const mediaVariants = colorMedia;

  const familyField = type === "refill" || type === "bundle";
  const statusNow = values.status;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <form action={action} onSubmit={submit} className="min-w-0 space-y-6" id="product-form">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="entity_id" value={values.id ?? ""} />
        <input type="hidden" name="variants" value={JSON.stringify(posted)} />
        <input type="hidden" name="media" value={JSON.stringify(mediaPayload)} />
        <input type="hidden" name="media_variants" value={JSON.stringify(mediaVariants)} />
        <input type="hidden" name="device_specs_keep" value={JSON.stringify(values.device_specs)} />
        {created ? <Notice tone="success">{created === "published" ? t.products.publishedOk : t.products.created}</Notice> : null}
        {duplicated ? <Notice tone="gold">{c.duplicated}</Notice> : null}

        {/* 1. Basic information */}
        <Panel title={c.sections.basic}>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={c.nameAr} htmlFor="name_ar">
                <TextInput id="name_ar" name="name_ar" dir="rtl" lang="ar" required maxLength={120} defaultValue={values.name_ar} />
              </Field>
              <Field label={c.nameEn} htmlFor="name_en" hint={c.nameEnHint}>
                <TextInput id="name_en" name="name_en" dir="ltr" lang="en" maxLength={120} defaultValue={values.name_en === values.name_ar ? "" : values.name_en} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.products.type} htmlFor="type">
                <Select id="type" name="type" value={type} onChange={(e) => setType(e.target.value as ProductValues["type"])}>
                  {editorProductTypes.map((productType) => (
                    <option key={productType} value={productType}>
                      {t.products.types[productType]}
                    </option>
                  ))}
                </Select>
              </Field>
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
            </div>
          </div>
        </Panel>

        {/* 2. Price & stock */}
        <Panel title={c.sections.price}>
          {colorMode ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={c.price} htmlFor="price" hint={c.priceHint}>
                <TextInput id="price" dir="ltr" inputMode="decimal" required placeholder="0.000" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
              </Field>
              <p className="self-end text-step--1 text-ink-soft">{c.colorsHint}</p>
            </div>
          ) : (
            <OptionRows
              rows={variants}
              canAdjust={canAdjust}
              onChange={patch}
              onAdd={() =>
                setVariants((current) => [
                  ...current.map((v) => (v.label_ar ? v : { ...v, label_ar: "" })),
                  { key: newKey(), sku: randomSku(), label_ar: "", label_en: "", price: current[0]?.price ?? "", compare_at: "", is_active: true, stock: "0", color_hex: "", media: [] },
                ])
              }
              onRemove={removeVariant}
            />
          )}
          {canAdjust ? <p className="mt-3 text-[0.78rem] text-ink-soft">{c.stockHint}</p> : null}
          {state.fieldErrors?.variants ? <p className="mt-2 text-step--1 text-[#86352b]">{t.common.error}</p> : null}
        </Panel>

        {/* 3. Photos & colours */}
        <Panel title={c.sections.photos}>
          <div className="space-y-6">
            <div>
              <p className="text-step--1 font-medium text-ink">{c.sharedPhotos}</p>
              <p className="mb-3 text-[0.78rem] text-ink-soft">{c.sharedPhotosHint}</p>
              <PhotoPicker value={shared} onChange={setShared} library={library} onUploaded={addToLibrary} label={c.sharedPhotos} testId="shared-photos" />
            </div>
            <div className="border-t border-ink/8 pt-5">
              <p className="text-step--1 font-medium text-ink">{c.colors}</p>
              <p className="mb-3 text-[0.78rem] text-ink-soft">{colorMode ? c.colorsHint : c.noColorsYet}</p>
              {colorMode ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {variants.map((v, index) => (
                    <ColorCard
                      key={v.key}
                      value={v}
                      index={index}
                      isDefault={index === 0}
                      canAdjust={canAdjust}
                      library={library}
                      onUploaded={addToLibrary}
                      onChange={(change) => patch(v.key, change)}
                      onRemove={() => removeVariant(v.key)}
                      onMakeDefault={() => setVariants((current) => [v, ...current.filter((x) => x.key !== v.key)])}
                    />
                  ))}
                </div>
              ) : null}
              <button type="button" className={cn(adminButton("outline", "sm"), "mt-3")} onClick={addColor}>
                {c.addColor}
              </button>
            </div>
          </div>
        </Panel>

        {/* 4. Specifications & description */}
        <Panel title={c.sections.specs} description={c.specsHint}>
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {simpleSpecKeys.map((key) =>
                key === "color" && colorMode ? (
                  <div key={key} className="min-w-0">
                    <p className="mb-1.5 text-step--1 font-medium text-ink">{c.specLabels.color}</p>
                    <p className="rounded-xl border border-dashed border-ink/15 px-3 py-2 text-step--1 text-ink-soft">{c.colorFromVariants}</p>
                    <input type="hidden" name="spec_color_ar" value={values.simple_specs.color.ar} />
                    <input type="hidden" name="spec_color_en" value={values.simple_specs.color.en} />
                  </div>
                ) : (
                  <div key={key} className="min-w-0 space-y-2">
                    <Field label={c.specLabels[key]} htmlFor={`spec_${key}_ar`}>
                      <TextInput
                        id={`spec_${key}_ar`}
                        name={`spec_${key}_ar`}
                        dir="rtl"
                        lang="ar"
                        maxLength={400}
                        placeholder={c.specExamples[key]}
                        defaultValue={values.simple_specs[key].ar}
                      />
                    </Field>
                    <div className={showEnglish ? "" : "hidden"}>
                      <TextInput
                        aria-label={`${c.specLabels[key]} (${t.common.english})`}
                        name={`spec_${key}_en`}
                        dir="ltr"
                        lang="en"
                        maxLength={400}
                        defaultValue={values.simple_specs[key].en}
                      />
                    </div>
                  </div>
                ),
              )}
            </div>
            <Checkbox label={c.showEnglish} checked={showEnglish} onChange={(e) => setShowEnglish(e.target.checked)} />

            <div>
              <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                <p className="text-step--1 font-medium text-ink">{c.description}</p>
                <div role="tablist" aria-label={c.description} className="inline-flex rounded-full border border-ink/12 p-0.5">
                  {(["ar", "en"] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      role="tab"
                      aria-selected={descTab === lang}
                      aria-controls={`description_${lang}`}
                      onClick={() => setDescTab(lang)}
                      className={cn("rounded-full px-3 py-1 text-step--1", descTab === lang ? "bg-ink text-canvas" : "text-ink-soft")}
                    >
                      {lang === "ar" ? c.arabicTab : c.englishTab}
                    </button>
                  ))}
                </div>
              </div>
              {(["ar", "en"] as const).map((lang) => (
                <TextArea
                  key={lang}
                  id={`description_${lang}`}
                  name={`description_${lang}`}
                  role="tabpanel"
                  aria-label={`${c.description} (${lang === "ar" ? c.arabicTab : c.englishTab})`}
                  dir={lang === "ar" ? "rtl" : "ltr"}
                  lang={lang}
                  rows={14}
                  maxLength={5000}
                  defaultValue={lang === "ar" ? values.description_ar : values.description_en}
                  hidden={descTab !== lang}
                  className="min-h-[22rem] w-full resize-y text-step-0"
                  placeholder={lang === "ar" ? "المميزات:\n1. …\n\nطريقة الاستخدام:\n…" : "Features:\n1. …"}
                />
              ))}
              <p className="mt-1 text-[0.78rem] text-ink-soft">{c.descriptionHint}</p>
            </div>
          </div>
        </Panel>

        {/* 5. Free fragrances */}
        {type === "diffuser" || type === "refill" ? (
          <Panel title={c.sections.free}>
            {type === "diffuser" ? (
              <Field label={c.freeCount} htmlFor="free_fragrances" className="sm:max-w-xs">
                <Select id="free_fragrances" name="free_fragrances" defaultValue={values.free_fragrances || "0"}>
                  <option value="0">{c.freeNone}</option>
                  <option value="1">{c.freeOne}</option>
                  <option value="2">{c.freeTwo}</option>
                </Select>
              </Field>
            ) : (
              <Checkbox name="free_fragrance_eligible" label={t.p5.freeEligible} hint={t.p5.freeEligibleHint} defaultChecked={values.free_fragrance_eligible} />
            )}
          </Panel>
        ) : null}
        {type !== "refill" ? <input type="hidden" name="free_fragrance_eligible" value={values.free_fragrance_eligible ? "on" : "off"} /> : null}

        {/* 6. Publishing */}
        <Panel title={c.sections.publish}>
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <Checkbox name="is_featured" label={t.products.featured} defaultChecked={values.is_featured} />
            <Checkbox name="is_new" label={t.products.isNew} defaultChecked={values.is_new} />
          </div>
        </Panel>

        {/* Advanced settings, closed by default. */}
        <details
          className="rounded-2xl border border-ink/10 bg-canvas"
          open={advancedOpen}
          onToggle={(e) => setAdvancedOpen((e.currentTarget as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer list-none px-5 py-4 [&::-webkit-details-marker]:hidden">
            <span className="text-step-0 font-medium text-ink">{c.advanced}</span>
            <span className="mt-0.5 block text-step--1 text-ink-soft">{c.advancedHint}</span>
          </summary>
          <div className="space-y-6 border-t border-ink/8 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.products.slug} htmlFor="slug" hint={c.slugHint} error={state.fieldErrors?.slug ? t.products.slugHint : undefined}>
                <TextInput id="slug" name="slug" dir="ltr" defaultValue={values.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} />
              </Field>
              <Field label={t.common.position} htmlFor="position" hint={t.products.positionHint}>
                <TextInput id="position" name="position" type="number" min={0} max={100000} defaultValue={values.position} dir="ltr" />
              </Field>
            </div>
            <BilingualFields
              name="short_description"
              label={t.products.shortDescription}
              values={{ ar: values.short_description_ar, en: values.short_description_en }}
              maxLength={200}
              labels={labels}
            />
            <fieldset>
              <legend className="mb-2 text-step--1 font-medium text-ink">{t.products.scents}</legend>
              <CheckboxGroup name="scents" asJson options={options.scents.map((s) => ({ id: s.id, label: s.name }))} initial={values.scents} />
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-step--1 font-medium text-ink">{t.products.spaces}</legend>
              <CheckboxGroup name="spaces" options={spaces.map((space) => ({ id: space, label: t.spaces[space] ?? space }))} initial={values.spaces} />
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-step--1 font-medium text-ink">{t.products.sections.compatibility}</legend>
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
            </fieldset>
            {familyField || values.notes.top.ar || values.notes.top.en ? (
              <div className="space-y-3">
                <p className="text-step--1 font-medium text-ink">{t.products.notes}</p>
                <BilingualFields name="notes_top" label={t.products.notesTop} values={values.notes.top} maxLength={80} labels={labels} />
                <BilingualFields name="notes_heart" label={t.products.notesHeart} values={values.notes.heart} maxLength={80} labels={labels} />
                <BilingualFields name="notes_base" label={t.products.notesBase} values={values.notes.base} maxLength={80} labels={labels} />
              </div>
            ) : null}
            <div className="space-y-3">
              <BilingualFields name="specs" label={t.products.specs} values={{ ar: values.specs_ar, en: values.specs_en }} multiline rows={3} hint={t.products.specsHint} labels={labels} />
              {state.fieldErrors?.specs ? <p className="text-step--1 text-[#86352b]">{t.products.specsHint}</p> : null}
              <Checkbox name="specs_confirmed" label={t.products.specsConfirmed} defaultChecked={values.specs_confirmed} />
            </div>
            <div>
              <p className="mb-3 text-step--1 font-medium text-ink">{c.olderInfo}</p>
              <InfoSectionsFields info={values.info_sections} />
            </div>
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
        </details>

        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-ink/10 bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
          <SubmitButton name="intent" value="save" tone={canPublish && statusNow !== "published" ? "outline" : "primary"} pending={t.common.saving}>
            {statusNow === "published" ? t.common.save : c.saveDraft}
          </SubmitButton>
          {canPublish && statusNow !== "published" ? (
            <SubmitButton name="intent" value="publish" pending={t.common.saving}>
              {c.savePublish}
            </SubmitButton>
          ) : null}
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
          <Panel>
            <DuplicateButton id={values.id} />
          </Panel>
        </aside>
      ) : null}
    </div>
  );
}
