"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { localePath } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { useFormAction } from "@/lib/use-form-action";
import { formatKWD } from "@/lib/money";
import { useAdminI18n } from "@/features/admin/i18n/client";
import { parseKwdToFils } from "@/features/admin/format";
import { computeSavings } from "@/features/offers/types";
import { deleteProduct, setProductStatus } from "@/features/admin/products/actions";
import type { PickerAsset } from "@/features/admin/media/media-picker";
import { PhotoPicker } from "@/features/admin/products/photo-picker";
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
import { duplicateOffer, saveOffer, searchOfferCatalogProducts } from "./actions";

type OfferStatus = "draft" | "published" | "archived";

export type CatalogSearchItem = {
  id: string;
  slug: string;
  status: OfferStatus;
  name: { ar: string; en: string };
  cover: { id: string; url: string; alt: string } | null;
  variants: Array<{ id: string; label: { ar: string; en: string }; color_hex: string | null; price_fils: number }>;
};

export type OfferItemValue = {
  key: string;
  product_id: string;
  slug: string;
  name: { ar: string; en: string };
  status: OfferStatus;
  cover: { id: string; url: string; alt: string } | null;
  quantity: number;
  // "" means the customer chooses any available colour.
  locked_variant_id: string;
  variants: Array<{ id: string; label: { ar: string; en: string }; color_hex: string | null; price_fils: number }>;
};

export type OfferValues = {
  id?: string;
  status: OfferStatus;
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
  price: string;
  allow_discount_stacking: boolean;
  starts_at: string;
  ends_at: string;
  media: string[];
  items: OfferItemValue[];
};

export type OfferOptions = {
  library: PickerAsset[];
};

export const emptyOffer: OfferValues = {
  status: "draft",
  name_ar: "",
  name_en: "",
  description_ar: "",
  description_en: "",
  price: "",
  allow_discount_stacking: false,
  starts_at: "",
  ends_at: "",
  media: [],
  items: [],
};

// The cheapest currently active colour, or the locked one when the owner
// pinned a colour — same rule save_offer uses server-side for the original
// total, so this preview tracks what the server will actually compute.
function unitPriceFor(item: OfferItemValue): number {
  if (item.locked_variant_id) {
    const locked = item.variants.find((v) => v.id === item.locked_variant_id);
    if (locked) return locked.price_fils;
  }
  const cheapest = [...item.variants].sort((a, b) => a.price_fils - b.price_fils)[0];
  return cheapest?.price_fils ?? 0;
}

function OfferStatusControls({ id, status, canPublish }: { id: string; status: OfferStatus; canPublish: boolean }) {
  const { locale, t } = useAdminI18n();
  const [state, action] = useActionState<ActionResult, FormData>(setProductStatus, idle);
  const [deleteState, deleteAction] = useActionState<ActionResult, FormData>(deleteProduct, idle);
  if (!canPublish) return <p className="text-step--1 text-ink-soft">{t.products.publishRole}</p>;
  const transitions: Array<{ to: OfferStatus; label: string; tone: "primary" | "outline" | "danger"; testId?: string }> =
    status === "published"
      ? [
          { to: "draft", label: t.common.unpublish, tone: "outline" },
          { to: "archived", label: t.common.archive, tone: "outline" },
        ]
      : status === "draft"
        ? [
            { to: "published", label: t.common.publish, tone: "primary", testId: "offer-publish-button" },
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
            <span data-testid={transition.testId}>
              <SubmitButton tone={transition.tone} size="sm">
                {transition.label}
              </SubmitButton>
            </span>
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

// Compact quick actions for one row of the offers list: publish/unpublish,
// duplicate and delete, reusing the exact same generic actions as the
// editor's own aside (setProductStatus, deleteProduct) plus duplicateOffer.
export function OfferRowActions({
  id,
  status,
  canWrite,
  canPublish,
}: {
  id: string;
  status: OfferStatus;
  canWrite: boolean;
  canPublish: boolean;
}) {
  const { locale, t } = useAdminI18n();
  const [statusState, statusAction] = useActionState<ActionResult, FormData>(setProductStatus, idle);
  const [dupState, dupAction] = useActionState<ActionResult, FormData>(duplicateOffer, idle);
  const [delState, delAction] = useActionState<ActionResult, FormData>(deleteProduct, idle);
  if (!canWrite && !canPublish) return null;
  const transitions: Array<{ to: OfferStatus; label: string; testId?: string }> =
    status === "published"
      ? [{ to: "draft", label: t.common.unpublish }]
      : status === "draft"
        ? [{ to: "published", label: t.common.publish, testId: "offer-publish-button" }]
        : [{ to: "draft", label: t.common.restore }];
  const message = [statusState, dupState, delState].find((s) => s.status !== "idle") ?? idle;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {canPublish
          ? transitions.map((transition) => (
              <form key={transition.to} action={statusAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="entity_id" value={id} />
                <input type="hidden" name="status" value={transition.to} />
                <span data-testid={transition.testId}>
                  <SubmitButton tone="outline" size="sm">
                    {transition.label}
                  </SubmitButton>
                </span>
              </form>
            ))
          : null}
        {canWrite ? (
          <form action={dupAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="entity_id" value={id} />
            <SubmitButton tone="ghost" size="sm">
              {t.offers.duplicate}
            </SubmitButton>
          </form>
        ) : null}
        {canPublish && status !== "published" ? (
          <form
            action={delAction}
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
      <ActionMessage state={message} />
    </div>
  );
}

function OfferDuplicateButton({ id }: { id: string }) {
  const { locale, t } = useAdminI18n();
  const [state, action] = useActionState<ActionResult, FormData>(duplicateOffer, idle);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="entity_id" value={id} />
      <SubmitButton tone="outline" size="sm" pending={t.common.saving}>
        {t.offers.duplicate}
      </SubmitButton>
      <p className="text-[0.78rem] text-ink-soft">{t.offers.duplicateHint}</p>
      <ActionMessage state={state} />
    </form>
  );
}

function ColorSwatch({ hex }: { hex: string | null }) {
  return <span aria-hidden className="inline-block size-3.5 shrink-0 rounded-full border border-ink/20" style={{ backgroundColor: hex || "#ffffff" }} />;
}

export function OfferEditor({
  values,
  options,
  canPublish,
  created,
  duplicated,
}: {
  values: OfferValues;
  options: OfferOptions;
  canPublish: boolean;
  created?: boolean;
  duplicated?: boolean;
}) {
  const { locale, t } = useAdminI18n();
  const c = t.offers;
  const labels = { ar: t.common.arabic, en: t.common.english };
  const [state, action, , submit] = useFormAction<ActionResult>(saveOffer, idle);

  const [library, setLibrary] = useState(options.library);
  const addToLibrary = (asset: PickerAsset) => setLibrary((current) => (current.some((a) => a.id === asset.id) ? current : [asset, ...current]));

  const [items, setItems] = useState<OfferItemValue[]>(values.items);
  const [media, setMedia] = useState<string[]>(values.media);
  const [price, setPrice] = useState(values.price);
  const [advancedOpen, setAdvancedOpen] = useState(
    Boolean(values.description_ar || values.description_en || values.starts_at || values.ends_at || values.allow_discount_stacking),
  );

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogSearchItem[]>([]);
  const [searching, startSearch] = useTransition();
  useEffect(() => {
    const handle = setTimeout(() => {
      startSearch(async () => {
        const rows = await searchOfferCatalogProducts(query);
        setResults(rows.filter((row) => row.id !== values.id));
      });
    }, 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const toggleItem = (row: CatalogSearchItem) =>
    setItems((current) => {
      if (current.some((i) => i.product_id === row.id)) return current.filter((i) => i.product_id !== row.id);
      if (current.length >= 20) return current;
      return [
        ...current,
        { key: row.id, product_id: row.id, slug: row.slug, name: row.name, status: row.status, cover: row.cover, quantity: 1, locked_variant_id: "", variants: row.variants },
      ];
    });
  const patchItem = (key: string, patch: Partial<OfferItemValue>) =>
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  const removeItem = (key: string) => setItems((current) => current.filter((item) => item.key !== key));

  const priceFils = parseKwdToFils(price) ?? 0;
  const originalTotal = items.reduce((sum, item) => sum + unitPriceFor(item) * Math.max(item.quantity, 1), 0);
  const { savingsFils, savingsPercent } = computeSavings(priceFils, originalTotal);

  const postedItems = items.map((item) => ({ item_product_id: item.product_id, quantity: item.quantity, locked_variant_id: item.locked_variant_id }));

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <form action={action} onSubmit={submit} className="min-w-0 space-y-6">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="entity_id" value={values.id ?? ""} />
        <input type="hidden" name="items" value={JSON.stringify(postedItems)} />
        <input type="hidden" name="media" value={JSON.stringify(media)} />
        {created ? <Notice tone="success">{c.savedOk}</Notice> : null}
        {duplicated ? <Notice tone="gold">{c.duplicatedOk}</Notice> : null}

        <Panel title={c.sections.basics}>
          <BilingualFields name="name" label={c.name} values={{ ar: values.name_ar, en: values.name_en }} maxLength={120} required labels={labels} />
        </Panel>

        <Panel title={c.sections.items} description={c.itemsHint}>
          <div className="space-y-4">
            <TextInput
              aria-label={c.searchPlaceholder}
              placeholder={c.searchPlaceholder}
              dir={locale === "ar" ? "rtl" : "ltr"}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            {query.trim() ? (
              searching ? null : results.length === 0 ? (
                <p className="text-step--1 text-ink-soft">{c.noSearchResults}</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {results.map((row) => {
                    const checked = items.some((i) => i.product_id === row.id);
                    return (
                      <li key={row.id}>
                        <label className={cn("flex min-w-0 cursor-pointer items-center gap-3 rounded-xl border p-2.5", checked ? "border-gold-deep bg-gold/8" : "border-ink/12 hover:border-gold/50")}>
                          <input type="checkbox" className="size-4 shrink-0 accent-[#7a5f33]" checked={checked} onChange={() => toggleItem(row)} />
                          <span className="block size-10 shrink-0 overflow-hidden rounded-lg bg-beige">
                            {row.cover ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={row.cover.url} alt="" className="size-full object-contain" loading="lazy" />
                            ) : null}
                          </span>
                          <span className="min-w-0 truncate text-step--1 text-ink">{row.name[locale]}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : null}

            {items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-ink/15 px-4 py-5 text-center text-step--1 text-ink-soft">{c.itemsEmpty}</p>
            ) : (
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.key} data-testid="offer-item-row" className="flex flex-wrap items-center gap-3 rounded-xl border border-ink/10 bg-surface/50 p-3">
                    <span className="block size-10 shrink-0 overflow-hidden rounded-lg bg-beige">
                      {item.cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.cover.url} alt="" className="size-full object-contain" loading="lazy" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-step--1 text-ink">{item.name[locale]}</span>
                    <label className="flex items-center gap-1.5 text-step--1 text-ink-soft">
                      {c.quantity}
                      <input
                        type="number"
                        min={1}
                        max={50}
                        dir="ltr"
                        className="min-h-9 w-16 rounded-lg border border-ink/15 bg-canvas px-2 text-center text-step--1 text-ink"
                        value={item.quantity}
                        onChange={(e) => patchItem(item.key, { quantity: Math.min(50, Math.max(1, Number(e.target.value) || 1)) })}
                      />
                    </label>
                    {item.variants.length >= 2 ? (
                      <label className="flex items-center gap-1.5 text-step--1 text-ink-soft">
                        {c.lockColor}
                        <Select
                          className="w-auto min-w-36"
                          value={item.locked_variant_id}
                          onChange={(e) => patchItem(item.key, { locked_variant_id: e.target.value })}
                        >
                          <option value="">{c.customerChooses}</option>
                          {item.variants.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.label[locale]}
                            </option>
                          ))}
                        </Select>
                        <ColorSwatch hex={item.locked_variant_id ? item.variants.find((v) => v.id === item.locked_variant_id)?.color_hex ?? null : null} />
                      </label>
                    ) : null}
                    <button type="button" className={adminButton("ghost", "sm")} onClick={() => removeItem(item.key)}>
                      {t.common.remove}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>

        <Panel title={c.sections.price}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={c.price} htmlFor="price">
              <TextInput id="price" name="price" dir="ltr" inputMode="decimal" required placeholder="0.000" value={price} onChange={(e) => setPrice(e.target.value)} />
            </Field>
            <div data-testid="offer-savings-preview" className="rounded-xl border border-gold/35 bg-gold/8 p-3 text-step--1 text-ink">
              <p className="flex justify-between gap-3">
                <span className="text-ink-soft">{c.originalTotal}</span>
                <span className="tabular-nums">{formatKWD(originalTotal, locale)}</span>
              </p>
              <p className="flex justify-between gap-3">
                <span className="text-ink-soft">{c.offerPrice}</span>
                <span className="tabular-nums">{formatKWD(priceFils, locale)}</span>
              </p>
              <p className="mt-1 flex justify-between gap-3 border-t border-gold/25 pt-1 font-medium text-gold-deep">
                <span>{c.savings}</span>
                <span className="tabular-nums" dir="ltr">
                  {formatKWD(savingsFils, locale)} ({savingsPercent}%)
                </span>
              </p>
            </div>
          </div>
        </Panel>

        <Panel title={c.sections.image}>
          <PhotoPicker value={media} onChange={(ids) => setMedia(ids.slice(-1))} library={library} onUploaded={addToLibrary} label={c.image} testId="offer-image" />
        </Panel>

        <details open={advancedOpen} onToggle={(e) => setAdvancedOpen(e.currentTarget.open)} className="rounded-2xl border border-ink/10 bg-canvas">
          <summary className="cursor-pointer select-none px-5 py-4 text-step--1 font-medium text-ink">{c.sections.advanced}</summary>
          <div className="space-y-4 border-t border-ink/8 p-5">
            <BilingualFields
              name="description"
              label={c.description}
              values={{ ar: values.description_ar, en: values.description_en }}
              multiline
              maxLength={5000}
              labels={labels}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={c.startsAt} htmlFor="starts_at" hint={c.scheduleHint}>
                <TextInput id="starts_at" name="starts_at" type="datetime-local" dir="ltr" defaultValue={values.starts_at} />
              </Field>
              <Field label={c.endsAt} htmlFor="ends_at">
                <TextInput id="ends_at" name="ends_at" type="datetime-local" dir="ltr" defaultValue={values.ends_at} />
              </Field>
            </div>
            <Checkbox name="allow_discount_stacking" label={c.allowStacking} defaultChecked={values.allow_discount_stacking} />
          </div>
        </details>

        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-ink/10 bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
          <SubmitButton name="intent" value="save" tone={canPublish && values.status !== "published" ? "outline" : "primary"} pending={t.common.saving}>
            {values.status === "published" ? t.common.save : c.saveDraft}
          </SubmitButton>
          {canPublish && values.status !== "published" ? (
            <SubmitButton name="intent" value="publish" pending={t.common.saving}>
              {c.savePublish}
            </SubmitButton>
          ) : null}
          <Link href={localePath(locale, "/admin/offers")} className={adminButton("ghost")}>
            {t.common.back}
          </Link>
          <div className="min-w-0 flex-1">
            <ActionMessage state={state} />
          </div>
        </div>
      </form>

      {values.id ? (
        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <Panel title={c.sections.publishing}>
            <div className="space-y-4">
              <Badge tone={statusTone(values.status)}>{t.status[values.status]}</Badge>
              <OfferStatusControls id={values.id} status={values.status} canPublish={canPublish} />
            </div>
          </Panel>
          <Panel>
            <OfferDuplicateButton id={values.id} />
          </Panel>
        </aside>
      ) : null}
    </div>
  );
}
