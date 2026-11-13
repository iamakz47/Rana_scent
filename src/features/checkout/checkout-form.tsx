"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { ProductVisual } from "@/components/brand/product-visual";
import { Button, ButtonLink } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";
import { localePath } from "@/i18n/config";
import { format } from "@/i18n/format";
import { formatKWD } from "@/lib/money";
import { cn } from "@/lib/cn";
import { useCartLines } from "@/features/cart/store";
import { placeOrder, quoteCheckout, type CheckoutState, type Quote } from "./actions";
import { governorates, normalizeKuwaitPhone } from "./schema";

const field =
  "block w-full min-w-0 rounded-xl border border-ink/15 bg-canvas px-4 py-3 text-step-0 text-ink transition-colors placeholder:text-ink-soft/60 hover:border-ink/30 focus:border-gold-deep focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold-deep aria-[invalid=true]:border-[#a4493d]";

function Field({
  id,
  label,
  optional,
  hint,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  optional?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className="mb-1.5 block text-step--1 font-medium text-ink">
        {label}
        {optional ? <span className="ms-1 font-normal text-ink-soft">({optional})</span> : null}
      </label>
      {children}
      {hint ? <p className="mt-1 text-[0.8rem] text-ink-soft">{hint}</p> : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-[0.8rem] text-[#86352b]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0 rounded-[1.75rem] border border-ink/10 bg-canvas p-5 sm:p-7">
      <legend className="sr-only">{title}</legend>
      <h2 aria-hidden className="mb-5 font-display text-step-2 text-ink">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </fieldset>
  );
}

export function CheckoutForm({
  online,
  cod,
  deliveryNote,
}: {
  online: boolean;
  cod: boolean;
  deliveryNote: string;
}) {
  const { locale, dict } = useI18n();
  const t = dict.checkout;
  const lines = useCartLines();
  const [state, action, pending] = useActionState<CheckoutState, FormData>(placeOrder, {});
  const keyRef = useRef<string>("");
  const keyInput = useRef<HTMLInputElement>(null);

  const [governorate, setGovernorate] = useState("");
  const [area, setArea] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [code, setCode] = useState("");
  const [method, setMethod] = useState<"tap" | "cod">(online ? "tap" : "cod");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, startQuote] = useTransition();

  const items = useMemo(
    () => lines.map((line) => ({ variant_id: line.variantId, quantity: line.quantity })),
    [lines],
  );
  const itemsJson = JSON.stringify(items);

  useEffect(() => {
    if (items.length === 0) return;
    const handle = window.setTimeout(() => {
      startQuote(async () => {
        const result = await quoteCheckout({ items, governorate, area, discountCode: code });
        if (result.ok) {
          setQuote(result.quote);
          setQuoteError(null);
        } else {
          setQuote(null);
          setQuoteError(result.error);
        }
      });
    }, 350);
    return () => window.clearTimeout(handle);
    // itemsJson captures cart changes without re-running on identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsJson, governorate, area, code]);

  if (lines.length === 0) {
    return (
      <div className="rounded-[2rem] border border-dashed border-gold/50 px-6 py-20 text-center">
        <p className="font-display text-step-4 text-ink">{t.emptyTitle}</p>
        <p className="mx-auto mt-3 max-w-md text-ink-soft">{t.emptyBody}</p>
        <ButtonLink href={localePath(locale, "/shop")} className="mt-8" size="lg">
          {dict.cart.startShopping}
        </ButtonLink>
      </div>
    );
  }

  const errorText = (key?: string) =>
    key ? ((t.errors as Record<string, string>)[key] ?? t.errors.generic) : undefined;
  const fieldError = (name: string) => (state.field === name ? errorText(state.error) : undefined);
  const phoneInvalid = phoneTouched && phone.trim() !== "" && !normalizeKuwaitPhone(phone);
  const shortStock = new Set(quote?.short_stock ?? []);
  const blocked =
    !quote ||
    quote.unavailable_count > 0 ||
    shortStock.size > 0 ||
    (governorate !== "" && !quote.delivery_available) ||
    Boolean(quote.discount_problem);
  // Prices shown come from the server quote; the cart snapshot is a fallback
  // while the first quote loads.
  const unitPrice = (variantId: string, fallback: number) =>
    quote?.lines.find((l) => l.variant_id === variantId)?.unit_price_fils ?? fallback;

  return (
    <form
      action={action}
      onSubmit={() => {
        if (!keyRef.current) keyRef.current = crypto.randomUUID();
        if (keyInput.current) keyInput.current.value = keyRef.current;
      }}
      className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start xl:gap-12"
      noValidate
    >
      <input ref={keyInput} type="hidden" name="idempotency_key" defaultValue="" />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="items" value={itemsJson} />
      <input type="hidden" name="discount_code" value={code} />
      <input type="hidden" name="payment_method" value={method} />

      <div className="min-w-0 space-y-6">
        {state.error && !state.field ? (
          <p role="alert" className="rounded-2xl border border-[#a4493d]/30 bg-[#a4493d]/8 px-4 py-3 text-[#86352b]">
            {errorText(state.error)}
          </p>
        ) : null}

        <Section title={t.contact}>
          <Field id="customer_name" label={t.name} error={fieldError("customer_name")}>
            <input id="customer_name" name="customer_name" autoComplete="name" required maxLength={120} className={field}
              aria-invalid={Boolean(fieldError("customer_name"))} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="phone" label={t.phone} hint={t.phoneHint} error={phoneInvalid ? t.errors.phone_invalid : fieldError("phone")}>
              <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required dir="ltr"
                placeholder="5xxx xxxx" value={phone} onChange={(e) => setPhone(e.target.value)}
                onBlur={() => setPhoneTouched(true)} className={field} aria-invalid={phoneInvalid} />
            </Field>
            <Field id="email" label={t.email} optional={t.optional} hint={t.emailHint} error={fieldError("email")}>
              <input id="email" name="email" type="email" autoComplete="email" dir="ltr" maxLength={254} className={field} />
            </Field>
          </div>
        </Section>

        <Section title={t.delivery}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="governorate" label={t.governorate}>
              <select id="governorate" name="governorate" required value={governorate}
                onChange={(e) => setGovernorate(e.target.value)} className={cn(field, "pe-10")}>
                <option value="" disabled>
                  {t.chooseGovernorate}
                </option>
                {governorates.map((g) => (
                  <option key={g} value={g}>
                    {t.governorates[g]}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="area" label={t.area}>
              <input id="area" name="area" required maxLength={80} autoComplete="address-level2" value={area}
                onChange={(e) => setArea(e.target.value)} className={field} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field id="block" label={t.block}>
              <input id="block" name="block" required maxLength={20} inputMode="numeric" className={field} />
            </Field>
            <Field id="street" label={t.street} className="col-span-2 sm:col-span-3">
              <input id="street" name="street" required maxLength={80} className={field} />
            </Field>
            <Field id="avenue" label={t.avenue} optional={t.optional}>
              <input id="avenue" name="avenue" maxLength={40} className={field} />
            </Field>
            <Field id="building" label={t.building}>
              <input id="building" name="building" required maxLength={40} className={field} />
            </Field>
            <Field id="floor" label={t.floor} optional={t.optional}>
              <input id="floor" name="floor" maxLength={10} className={field} />
            </Field>
            <Field id="apartment" label={t.apartment} optional={t.optional}>
              <input id="apartment" name="apartment" maxLength={20} className={field} />
            </Field>
          </div>
          {state.error === "address_invalid" ? <p role="alert" className="text-step--1 text-[#86352b]">{t.errors.address_invalid}</p> : null}
          <Field id="delivery_instructions" label={t.instructions} optional={t.optional}>
            <textarea id="delivery_instructions" name="delivery_instructions" rows={2} maxLength={300} className={field} />
          </Field>
          {deliveryNote ? <p className="text-step--1 text-ink-soft">{deliveryNote}</p> : null}
        </Section>

        <Section title={t.payment}>
          <div role="radiogroup" aria-label={t.payment} className="grid gap-3">
            {online ? (
              <PaymentOption checked={method === "tap"} onSelect={() => setMethod("tap")} title={t.payOnline} hint={t.payOnlineHint} />
            ) : null}
            {cod ? (
              <PaymentOption checked={method === "cod"} onSelect={() => setMethod("cod")} title={t.cod} hint={t.codHint} />
            ) : null}
          </div>
          <Field id="customer_note" label={t.note} optional={t.optional}>
            <textarea id="customer_note" name="customer_note" rows={2} maxLength={500} className={field} />
          </Field>
        </Section>
      </div>

      <aside aria-labelledby="checkout-summary" className="rounded-[2rem] border border-gold/50 bg-surface p-6 lg:sticky lg:top-28 lg:p-8">
        <h2 id="checkout-summary" className="font-display text-step-2 text-ink">
          {t.summary}
        </h2>
        <ul className="mt-5 space-y-4">
          {lines.map((line) => (
            <li key={line.variantId} className="flex items-center gap-3">
              <ProductVisual src={line.image} alt={line.name[locale]} pendingLabel={dict.common.photoComingSoon}
                sizes="64px" className="size-16 shrink-0 rounded-xl bg-beige" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-ink">{line.name[locale]}</p>
                <p className="text-step--1 text-ink-soft">
                  {line.variantLabel[locale]} × {line.quantity}
                </p>
                {shortStock.has(line.variantId) ? <p className="text-step--1 text-[#86352b]">{t.errors.out_of_stock}</p> : null}
              </div>
              <p className="text-step--1 tabular-nums text-ink">
                {formatKWD(unitPrice(line.variantId, line.unitPriceFils) * line.quantity, locale)}
              </p>
            </li>
          ))}
        </ul>
        {quote && quote.unavailable_count > 0 ? (
          <p role="alert" className="mt-4 text-step--1 text-[#86352b]">
            {t.errors.item_unavailable}{" "}
            <Link href={localePath(locale, "/cart")} className="underline">
              {t.backToCart}
            </Link>
          </p>
        ) : null}

        <div className="mt-6 flex gap-2 border-t border-ink/10 pt-6">
          <label htmlFor="code" className="sr-only">
            {t.discount}
          </label>
          <input id="code" value={codeInput} onChange={(e) => setCodeInput(e.target.value)} placeholder={t.discount}
            dir="ltr" maxLength={24} className={cn(field, "py-2.5 uppercase")} />
          {code ? (
            <Button type="button" variant="outline" onClick={() => { setCode(""); setCodeInput(""); }}>
              {t.remove}
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => setCode(codeInput.trim().toUpperCase())} disabled={!codeInput.trim()}>
              {t.apply}
            </Button>
          )}
        </div>
        {code && quote?.discount_problem ? (
          <p role="alert" className="mt-2 text-step--1 text-[#86352b]">{errorText(quote.discount_problem)}</p>
        ) : code && quote && quote.discount_fils > 0 ? (
          <p className="mt-2 text-step--1 text-[#3f5c3b]">{t.discountApplied}</p>
        ) : null}

        <dl className="mt-6 space-y-2 text-step--1" aria-live="polite" aria-busy={quoting}>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-soft">{t.subtotal}</dt>
            <dd className="tabular-nums text-ink">{quote ? formatKWD(quote.subtotal_fils, locale) : "…"}</dd>
          </div>
          {quote && quote.discount_fils > 0 ? (
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">{t.discountLine}</dt>
              <dd className="tabular-nums text-[#3f5c3b]">−{formatKWD(quote.discount_fils, locale)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <dt className="text-ink-soft">{t.deliveryFee}</dt>
            <dd className="tabular-nums text-ink">
              {!governorate
                ? t.chooseArea
                : !quote
                  ? "…"
                  : !quote.delivery_available
                    ? "—"
                    : quote.shipping_fils === 0
                      ? t.free
                      : formatKWD(quote.shipping_fils, locale)}
            </dd>
          </div>
          {quote?.delivery_days ? (
            <p className="text-[0.8rem] text-ink-soft">
              {format(t.deliveryDays, { min: quote.delivery_days.min, max: quote.delivery_days.max })}
            </p>
          ) : null}
          {governorate && quote && !quote.delivery_available ? (
            <p role="alert" className="text-[#86352b]">{t.errors.delivery_unavailable}</p>
          ) : null}
          <div className="flex items-baseline justify-between gap-4 border-t border-ink/10 pt-4">
            <dt className="text-step-0 text-ink">{t.total}</dt>
            <dd className="text-step-2 tabular-nums text-gold-deep">{quote ? formatKWD(quote.total_fils, locale) : "…"}</dd>
          </div>
        </dl>
        {quoteError ? <p role="alert" className="mt-3 text-step--1 text-[#86352b]">{errorText(quoteError)}</p> : null}

        <Button type="submit" size="lg" className="mt-6 w-full" disabled={pending || blocked || !governorate}>
          {pending ? t.placing : method === "tap" ? t.payNow : t.placeOrder}
        </Button>
        <p className="mt-3 text-center text-[0.78rem] text-ink-soft">{t.secure}</p>
      </aside>
    </form>
  );
}

function PaymentOption({ checked, onSelect, title, hint }: { checked: boolean; onSelect: () => void; title: string; hint: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 rounded-2xl border p-4 text-start transition-colors",
        checked ? "border-gold-deep bg-gold/8" : "border-ink/15 hover:border-gold",
      )}
    >
      <span aria-hidden className={cn("mt-1 grid size-4 shrink-0 place-items-center rounded-full border", checked ? "border-gold-deep" : "border-ink/30")}>
        {checked ? <span className="size-2 rounded-full bg-gold-deep" /> : null}
      </span>
      <span>
        <span className="block font-medium text-ink">{title}</span>
        <span className="block text-step--1 text-ink-soft">{hint}</span>
      </span>
    </button>
  );
}
