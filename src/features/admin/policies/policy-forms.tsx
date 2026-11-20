"use client";

import { useActionState } from "react";
import { useAdminI18n } from "@/features/admin/i18n/client";
import { ActionMessage, idle, SubmitButton, type ActionResult } from "@/features/admin/ui/form";
import { BilingualFields } from "@/features/admin/ui/primitives";
import { useFormAction } from "@/lib/use-form-action";
import { savePolicyDraft, setPolicyPublished } from "./actions";

export function PolicyDraftForm({
  policyKey,
  values,
}: {
  policyKey: string;
  values: { title_ar: string; title_en: string; body_ar: string; body_en: string };
}) {
  const { locale, t } = useAdminI18n();
  const c = t.p5.policies;
  const labels = { ar: t.common.arabic, en: t.common.english };
  const [state, action, , submit] = useFormAction<ActionResult>(savePolicyDraft, idle);
  return (
    <form action={action} onSubmit={submit} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="policy_key" value={policyKey} />
      <BilingualFields name="title" label={c.titleField} values={{ ar: values.title_ar, en: values.title_en }} maxLength={120} labels={labels} />
      <BilingualFields
        name="body"
        label={c.bodyField}
        hint={c.bodyHint}
        values={{ ar: values.body_ar, en: values.body_en }}
        multiline
        rows={18}
        maxLength={30000}
        labels={labels}
      />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>{c.saveDraft}</SubmitButton>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

export function PolicyPublishForm({ policyKey, published }: { policyKey: string; published: boolean }) {
  const { locale, t } = useAdminI18n();
  const c = t.p5.policies;
  const [state, action] = useActionState<ActionResult, FormData>(setPolicyPublished, idle);
  return (
    <form
      action={action}
      className="flex flex-wrap items-center gap-3"
      onSubmit={(event) => {
        const intent = ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value;
        if (!window.confirm(intent === "publish" ? c.publishConfirm : c.unpublishConfirm)) event.preventDefault();
      }}
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="policy_key" value={policyKey} />
      <SubmitButton name="intent" value="publish">
        {c.publish}
      </SubmitButton>
      {published ? (
        <SubmitButton tone="ghost" name="intent" value="unpublish">
          {c.unpublish}
        </SubmitButton>
      ) : null}
      <ActionMessage state={state} />
    </form>
  );
}
