"use client";

import { useActionState } from "react";
import { useAdminI18n } from "@/features/admin/i18n/client";
import { ActionMessage, idle, SubmitButton, type ActionResult } from "@/features/admin/ui/form";
import { Field, TextArea, TextInput } from "@/features/admin/ui/primitives";
import {
  addOrderNote,
  reopenRefund,
  requestRefund,
  resolveRefund,
  retryEmail,
  saveTracking,
  sendRefund,
  updateOrderStatus,
} from "./actions";

function Hidden({ id }: { id: string }) {
  const { locale } = useAdminI18n();
  return (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="entity_id" value={id} />
    </>
  );
}

export function StatusControls({ id, next, canCancel }: { id: string; next: string[]; canCancel: boolean }) {
  const { t } = useAdminI18n();
  const c = t.commerce;
  const [state, action] = useActionState<ActionResult, FormData>(updateOrderStatus, idle);
  if (next.length === 0 && !canCancel) return null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {next.map((status, index) => (
          <form key={status} action={action}>
            <Hidden id={id} />
            <input type="hidden" name="status" value={status} />
            <SubmitButton size="sm" tone={index === 0 ? "primary" : "outline"}>
              {c.orders.moveTo}: {c.statuses[status]}
            </SubmitButton>
          </form>
        ))}
        {canCancel ? (
          <form
            action={action}
            onSubmit={(event) => {
              if (!window.confirm(c.orders.cancelConfirm)) event.preventDefault();
            }}
          >
            <Hidden id={id} />
            <input type="hidden" name="status" value="cancelled" />
            <SubmitButton size="sm" tone="danger">
              {c.orders.cancel}
            </SubmitButton>
          </form>
        ) : null}
      </div>
      <ActionMessage state={state} />
    </div>
  );
}

export function TrackingForm({
  id,
  courier,
  trackingNumber,
  eta,
}: {
  id: string;
  courier: string;
  trackingNumber: string;
  eta: string;
}) {
  const { t } = useAdminI18n();
  const c = t.commerce.orders;
  const [state, action] = useActionState<ActionResult, FormData>(saveTracking, idle);
  return (
    <form action={action} className="space-y-3">
      <Hidden id={id} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={c.courier} htmlFor="courier">
          <TextInput id="courier" name="courier" defaultValue={courier} maxLength={80} />
        </Field>
        <Field label={c.trackingNumber} htmlFor="tracking_number">
          <TextInput id="tracking_number" name="tracking_number" defaultValue={trackingNumber} maxLength={80} dir="ltr" />
        </Field>
        <Field label={c.eta} htmlFor="estimated_delivery">
          <TextInput id="estimated_delivery" name="estimated_delivery" type="date" defaultValue={eta} dir="ltr" />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton size="sm" tone="outline">
          {t.common.save}
        </SubmitButton>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

export function NoteForm({ id }: { id: string }) {
  const { t } = useAdminI18n();
  const c = t.commerce.orders;
  const [state, action] = useActionState<ActionResult, FormData>(addOrderNote, idle);
  return (
    <form action={action} className="space-y-2">
      <Hidden id={id} />
      <Field label={c.noteLabel} htmlFor="note-body">
        <TextArea id="note-body" name="body" rows={2} maxLength={1000} required />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton size="sm" tone="outline">
          {c.addNote}
        </SubmitButton>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

export function RefundRequestForm({ id, maxKwd }: { id: string; maxKwd: string }) {
  const { t } = useAdminI18n();
  const c = t.commerce.orders;
  const [state, action] = useActionState<ActionResult, FormData>(requestRefund, idle);
  return (
    <form action={action} className="space-y-3">
      <Hidden id={id} />
      <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <Field label={c.refundAmount} htmlFor="refund-amount">
          <TextInput id="refund-amount" name="amount" defaultValue={maxKwd} inputMode="decimal" dir="ltr" required />
        </Field>
        <Field label={c.refundReason} htmlFor="refund-reason">
          <TextInput id="refund-reason" name="reason" maxLength={500} required />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton size="sm" tone="outline">
          {c.requestRefund}
        </SubmitButton>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

// Manual resolution: cash refunds, refunds made in the provider dashboard,
// or confirming a refund whose provider outcome was checked by hand.
export function RefundResolveForm({ id, refundId, canReject }: { id: string; refundId: string; canReject: boolean }) {
  const { t } = useAdminI18n();
  const c = t.commerce.orders;
  const [state, action] = useActionState<ActionResult, FormData>(resolveRefund, idle);
  return (
    <form action={action} className="mt-2 space-y-2">
      <Hidden id={id} />
      <input type="hidden" name="refund_id" value={refundId} />
      <p className="text-[0.75rem] text-ink-soft">
        {t.p4.manualResolve}: {t.p4.manualHint}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <Field label={c.providerRefundId} htmlFor={`prov-${refundId}`}>
          <TextInput id={`prov-${refundId}`} name="provider_refund_id" maxLength={80} dir="ltr" className="min-h-8 py-1" />
        </Field>
        <SubmitButton size="sm" tone="outline" name="approve" value="1">
          {t.p4.markRefunded}
        </SubmitButton>
        {canReject ? (
          <SubmitButton size="sm" tone="ghost" name="approve" value="0">
            {c.reject}
          </SubmitButton>
        ) : null}
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

export function RefundSendForm({ id, refundId }: { id: string; refundId: string }) {
  const { t } = useAdminI18n();
  const [state, action] = useActionState<ActionResult, FormData>(sendRefund, idle);
  return (
    <form
      action={action}
      className="mt-2 flex flex-wrap items-center gap-3"
      onSubmit={(event) => {
        if (!window.confirm(t.p4.sendRefundConfirm)) event.preventDefault();
      }}
    >
      <Hidden id={id} />
      <input type="hidden" name="refund_id" value={refundId} />
      <SubmitButton size="sm">{t.p4.sendRefund}</SubmitButton>
      <ActionMessage state={state} />
    </form>
  );
}

export function RefundReopenForm({ id, refundId }: { id: string; refundId: string }) {
  const { t } = useAdminI18n();
  const [state, action] = useActionState<ActionResult, FormData>(reopenRefund, idle);
  return (
    <form action={action} className="mt-2 flex flex-wrap items-center gap-3">
      <Hidden id={id} />
      <input type="hidden" name="refund_id" value={refundId} />
      <SubmitButton size="sm" tone="outline">
        {t.p4.reopen}
      </SubmitButton>
      <ActionMessage state={state} />
    </form>
  );
}

export function EmailRetryForm({ id, emailId }: { id: string; emailId: string }) {
  const { t } = useAdminI18n();
  const [state, action] = useActionState<ActionResult, FormData>(retryEmail, idle);
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <Hidden id={id} />
      <input type="hidden" name="email_id" value={emailId} />
      <SubmitButton size="sm" tone="ghost">
        {t.p4.emailRetry}
      </SubmitButton>
      <ActionMessage state={state} />
    </form>
  );
}
