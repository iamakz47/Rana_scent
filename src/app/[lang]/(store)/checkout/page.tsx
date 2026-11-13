import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { isSupabaseConfigured } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/public";
import { isServiceConfigured } from "@/lib/supabase/service";
import { isLiveCatalog } from "@/features/catalog/source";
import { CheckoutForm } from "@/features/checkout/checkout-form";
import { onlinePaymentsAvailable } from "@/features/payments/config";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.checkout.title, robots: { index: false, follow: false } };
}

async function Checkout() {
  // Payment availability is a request-time decision (settings can change).
  await connection();
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  let online = false;
  let cod = false;
  let deliveryNote = "";
  if (isLiveCatalog() && isSupabaseConfigured()) {
    const { data } = await createPublicClient()
      .from("store_settings")
      .select("cod_enabled, online_payments_enabled, delivery_note_ar, delivery_note_en")
      .eq("id", 1)
      .maybeSingle();
    online = Boolean(data?.online_payments_enabled) && onlinePaymentsAvailable() && isServiceConfigured();
    cod = Boolean(data?.cod_enabled);
    deliveryNote = (locale === "ar" ? data?.delivery_note_ar : data?.delivery_note_en) ?? "";
  }
  if (!online && !cod) {
    return (
      <div className="rounded-[2rem] border border-dashed border-gold/50 px-6 py-20 text-center">
        <p className="font-display text-step-4 text-ink">{dict.checkout.unavailableTitle}</p>
        <p className="mx-auto mt-3 max-w-md text-ink-soft">{dict.checkout.unavailableBody}</p>
        <ButtonLink href={localePath(locale, "/cart")} className="mt-8" variant="outline">
          {dict.checkout.backToCart}
        </ButtonLink>
      </div>
    );
  }
  return <CheckoutForm online={online} cod={cod} deliveryNote={deliveryNote} />;
}

export default async function CheckoutPage() {
  const dict = await getDictionary();
  return (
    <>
      <PageHeader title={dict.checkout.title} />
      <div className="container-page pb-24 pt-8">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-[2rem] bg-ink/5" />}>
          <Checkout />
        </Suspense>
      </div>
    </>
  );
}
