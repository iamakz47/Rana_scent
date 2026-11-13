import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { formatKWD } from "@/lib/money";
import { createServiceClient } from "@/lib/supabase/service";
import { completeTestPayment } from "@/features/checkout/actions";
import { getPaymentsConfig } from "@/features/payments/config";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// Test mode only: stands in for the bank's payment page. Not available when
// the real provider (or no provider) is configured, nor in production.
async function TestPayment({ searchParams }: { searchParams: PageProps<"/[lang]/checkout/test-payment">["searchParams"] }) {
  const [query, locale, dict] = await Promise.all([searchParams, getLocale(), getDictionary()]);
  if (getPaymentsConfig().kind !== "mock") notFound();
  const charge = typeof query.charge === "string" ? query.charge : "";
  if (!/^mock_[a-f0-9]{32}$/.test(charge)) notFound();
  const { data } = await createServiceClient()
    .from("payments")
    .select("amount_fils, status")
    .eq("provider", "mock")
    .eq("provider_charge_id", charge)
    .maybeSingle();
  if (!data) notFound();
  const t = dict.testPayment;
  return (
    <div className="container-page max-w-lg py-16">
      <div className="rounded-[2rem] border border-dashed border-gold bg-surface p-8 text-center">
        <p className="text-[0.7rem] uppercase tracking-[0.24em] text-gold-deep">{t.title}</p>
        <p className="mt-3 text-ink-soft">{t.body}</p>
        <p className="mt-6 text-step--1 text-ink-soft">{t.amount}</p>
        <p className="font-display text-step-4 tabular-nums text-ink">{formatKWD(data.amount_fils, locale)}</p>
        <form action={completeTestPayment} className="mt-8 grid gap-3">
          <input type="hidden" name="charge" value={charge} />
          <input type="hidden" name="locale" value={locale} />
          <Button type="submit" name="outcome" value="CAPTURED" size="lg">
            {t.success}
          </Button>
          <Button type="submit" name="outcome" value="DECLINED" variant="outline">
            {t.decline}
          </Button>
          <Button type="submit" name="outcome" value="CANCELLED" variant="ghost">
            {t.cancel}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function TestPaymentPage({ searchParams }: PageProps<"/[lang]/checkout/test-payment">) {
  return (
    <Suspense fallback={<div className="container-page py-24" aria-busy />}>
      <TestPayment searchParams={searchParams} />
    </Suspense>
  );
}
