"use client";

import { useActionState } from "react";
import { useAdminI18n } from "@/features/admin/i18n/client";
import { ActionMessage, idle, SubmitButton, type ActionResult } from "@/features/admin/ui/form";
import { setMessageStatus } from "./actions";

export function MessageStatusForm({ id, status }: { id: string; status: "new" | "read" | "archived" }) {
  const { locale, t } = useAdminI18n();
  const c = t.p8.messages;
  const [state, action] = useActionState<ActionResult, FormData>(setMessageStatus, idle);
  const buttons: Array<{ to: "new" | "read" | "archived"; label: string }> =
    status === "new"
      ? [{ to: "read", label: c.markRead }, { to: "archived", label: c.archive }]
      : status === "read"
        ? [{ to: "new", label: c.markNew }, { to: "archived", label: c.archive }]
        : [{ to: "read", label: c.restore }];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {buttons.map((button) => (
        <form key={button.to} action={action}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="message_id" value={id} />
          <input type="hidden" name="status" value={button.to} />
          <SubmitButton tone="outline" size="sm">
            {button.label}
          </SubmitButton>
        </form>
      ))}
      {state.status === "error" ? <ActionMessage state={state} /> : null}
    </div>
  );
}
