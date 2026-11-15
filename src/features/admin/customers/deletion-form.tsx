"use client";

import { useActionState } from "react";
import { useAdminI18n } from "@/features/admin/i18n/client";
import { ActionMessage, idle, SubmitButton, type ActionResult } from "@/features/admin/ui/form";
import { Field, TextInput } from "@/features/admin/ui/primitives";
import { resolveDeletion } from "./actions";

export function DeletionResolveForm({ requestId }: { requestId: string }) {
  const { locale, t } = useAdminI18n();
  const [state, action] = useActionState<ActionResult, FormData>(resolveDeletion, idle);
  return (
    <form
      action={action}
      className="mt-2 flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (submitter?.value === "1" && !window.confirm(t.p4.deletionConfirm)) event.preventDefault();
      }}
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="request_id" value={requestId} />
      <Field label={t.p4.deletionNote} htmlFor={`note-${requestId}`}>
        <TextInput id={`note-${requestId}`} name="note" maxLength={500} className="min-h-8 py-1" />
      </Field>
      <SubmitButton size="sm" tone="danger" name="complete" value="1">
        {t.p4.deletionComplete}
      </SubmitButton>
      <SubmitButton size="sm" tone="ghost" name="complete" value="0">
        {t.p4.deletionReject}
      </SubmitButton>
      <ActionMessage state={state} />
    </form>
  );
}
