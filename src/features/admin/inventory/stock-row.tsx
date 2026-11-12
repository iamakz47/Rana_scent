"use client";

import { useActionState, useState } from "react";
import { useAdminI18n } from "@/features/admin/i18n/client";
import { ActionMessage, idle, SubmitButton, type ActionResult } from "@/features/admin/ui/form";
import { adminButton, Badge, Field, Select, TextInput } from "@/features/admin/ui/primitives";
import { adjustStock, setThreshold } from "./actions";

export type StockRowData = {
  variantId: string;
  product: string;
  variant: string;
  sku: string;
  onHand: number;
  threshold: number;
  status: "in_stock" | "low_stock" | "out_of_stock";
};

const reasons = ["restock", "adjustment", "correction", "damage", "initial"] as const;

export function StockRow({ row, canAdjust }: { row: StockRowData; canAdjust: boolean }) {
  const { locale, t } = useAdminI18n();
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ActionResult, FormData>(adjustStock, idle);
  const [thresholdState, thresholdAction] = useActionState<ActionResult, FormData>(setThreshold, idle);
  const tone = row.status === "out_of_stock" ? "danger" : row.status === "low_stock" ? "warning" : "success";
  const id = `adj-${row.variantId}`;

  return (
    <li className="px-4 py-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 md:grid-cols-[minmax(0,1fr)_8rem_6rem_7rem_auto]">
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{row.product}</p>
          <p className="truncate text-[0.78rem] text-ink-soft">
            {row.variant} · <span dir="ltr">{row.sku}</span>
          </p>
        </div>
        <p className="hidden text-step--1 text-ink-soft md:block">
          {t.inventory.threshold}: <span className="tabular-nums">{row.threshold}</span>
        </p>
        <p className="font-display text-step-2 tabular-nums text-ink md:text-end">{row.onHand}</p>
        <Badge tone={tone} className="hidden justify-self-start md:inline-flex">
          {t.inventory.statuses[row.status]}
        </Badge>
        {canAdjust ? (
          <button
            type="button"
            className={adminButton("outline", "sm") + " col-span-2 md:col-span-1"}
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setOpen((v) => !v)}
          >
            {t.inventory.adjust}
          </button>
        ) : null}
      </div>
      {open && canAdjust ? (
        <div id={id} className="mt-3 grid gap-4 rounded-xl border border-ink/10 bg-surface/60 p-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <form action={action} className="grid gap-3 sm:grid-cols-[8rem_12rem_minmax(0,1fr)] sm:items-end">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="variant_id" value={row.variantId} />
            <Field label={t.inventory.change} htmlFor={`${id}-change`} hint={t.inventory.changeHint}>
              <TextInput id={`${id}-change`} name="change" type="number" step={1} required dir="ltr" placeholder="+10" />
            </Field>
            <Field label={t.inventory.reason} htmlFor={`${id}-reason`}>
              <Select id={`${id}-reason`} name="reason" defaultValue="restock">
                {reasons.map((reason) => (
                  <option key={reason} value={reason}>
                    {t.inventory.reasons[reason]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t.inventory.note} htmlFor={`${id}-note`}>
              <TextInput id={`${id}-note`} name="note" maxLength={300} />
            </Field>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
              <SubmitButton size="sm">{t.common.save}</SubmitButton>
              <ActionMessage state={state} />
            </div>
          </form>
          <form action={thresholdAction} className="space-y-3 border-t border-ink/10 pt-3 lg:border-s lg:border-t-0 lg:ps-4 lg:pt-0">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="variant_id" value={row.variantId} />
            <Field label={t.inventory.threshold} htmlFor={`${id}-threshold`}>
              <TextInput id={`${id}-threshold`} name="threshold" type="number" min={0} defaultValue={row.threshold} dir="ltr" />
            </Field>
            <SubmitButton size="sm" tone="outline">
              {t.common.save}
            </SubmitButton>
            <ActionMessage state={thresholdState} />
          </form>
        </div>
      ) : null}
    </li>
  );
}
