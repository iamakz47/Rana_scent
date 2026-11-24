"use client";

import { useActionState, useState } from "react";
import { RichText } from "@/components/ui/rich-text";
import { cn } from "@/lib/cn";
import { useFormAction } from "@/lib/use-form-action";
import { useAdminI18n } from "@/features/admin/i18n/client";
import { ActionMessage, idle, SubmitButton, type ActionResult } from "@/features/admin/ui/form";
import { adminButton, Field, Notice, Panel, TextArea, TextInput } from "@/features/admin/ui/primitives";
import type { FaqItem, PageContent, SitePageKey } from "@/features/site-pages/schema";
import { savePageDraft, setPagePublished } from "./actions";

type Lang = "ar" | "en";
let keySeed = 0;
const withKeys = (items: FaqItem[]) => items.map((item) => ({ ...item, key: `q-${++keySeed}` }));

// Edits one content page: Arabic and English in tabs, plain text with the
// same simple formatting as product descriptions, and (FAQ) a list of
// questions to add, edit, reorder and remove. Saving keeps a draft; visitors
// see the page only after it is published.
export function PageEditor({
  pageKey,
  initial,
  fromBuiltIn,
  published,
  canPublish = true,
}: {
  pageKey: SitePageKey;
  initial: PageContent;
  fromBuiltIn: boolean;
  published: boolean;
  canPublish?: boolean;
}) {
  const { locale, t } = useAdminI18n();
  const c = t.p8.pages;
  const [lang, setLang] = useState<Lang>("ar");
  const [content, setContent] = useState<Omit<PageContent, "items">>({ title: initial.title, lead: initial.lead, body: initial.body });
  const [items, setItems] = useState(() => withKeys(initial.items));
  const [state, action, , submit] = useFormAction<ActionResult>(savePageDraft, idle);
  const [publishState, publishAction] = useActionState<ActionResult, FormData>(setPagePublished, idle);
  const isFaq = pageKey === "faq";
  const dir = lang === "ar" ? "rtl" : "ltr";

  const setText = (field: "title" | "lead" | "body", value: string) =>
    setContent((current) => ({ ...current, [field]: { ...current[field], [lang]: value } }));
  const setItem = (key: string, part: "q" | "a", value: string) =>
    setItems((current) => current.map((item) => (item.key === key ? { ...item, [part]: { ...item[part], [lang]: value } } : item)));
  const move = (index: number, delta: number) =>
    setItems((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const payload: PageContent = { ...content, items: isFaq ? items.map(({ q, a }) => ({ q, a })) : [] };

  return (
    <div className="space-y-6">
      {fromBuiltIn ? <Notice tone="gold">{c.startedFromBuiltIn}</Notice> : null}

      <form action={action} onSubmit={submit} className="space-y-6" data-testid="page-editor">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="page_key" value={pageKey} />
        <input type="hidden" name="content" value={JSON.stringify(payload)} />

        <div role="tablist" aria-label={c.title} className="inline-flex rounded-full border border-ink/12 p-0.5">
          {(["ar", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={lang === l}
              onClick={() => setLang(l)}
              className={cn("min-h-10 rounded-full px-4 text-step--1", lang === l ? "bg-ink text-canvas" : "text-ink-soft")}
            >
              {l === "ar" ? c.arabic : c.english}
            </button>
          ))}
        </div>

        <Panel>
          <div className="space-y-4" dir={dir} lang={lang}>
            <Field label={c.pageTitle} htmlFor={`title-${lang}`}>
              <TextInput id={`title-${lang}`} value={content.title[lang]} maxLength={120} onChange={(e) => setText("title", e.target.value)} />
            </Field>
            <Field label={c.lead} htmlFor={`lead-${lang}`}>
              <TextArea id={`lead-${lang}`} rows={2} value={content.lead[lang]} maxLength={400} onChange={(e) => setText("lead", e.target.value)} />
            </Field>
            {!isFaq ? (
              <Field
                label={pageKey === "contact" ? c.contactText : c.text}
                htmlFor={`body-${lang}`}
                hint={pageKey === "contact" ? `${c.contactHint} ${c.textHint}` : c.textHint}
              >
                <TextArea
                  id={`body-${lang}`}
                  rows={pageKey === "contact" ? 6 : 14}
                  value={content.body[lang]}
                  maxLength={20000}
                  onChange={(e) => setText("body", e.target.value)}
                  className="min-h-40 w-full resize-y text-step-0"
                />
              </Field>
            ) : null}
          </div>
        </Panel>

        {isFaq ? (
          <Panel title={c.questions}>
            <ol className="space-y-3" dir={dir} lang={lang}>
              {items.map((item, index) => (
                <li key={item.key} className="rounded-xl border border-ink/10 bg-surface/50 p-3 sm:p-4" data-testid="faq-question">
                  <div className="space-y-3">
                    <Field label={`${c.question} ${index + 1}`} htmlFor={`${item.key}-q-${lang}`}>
                      <TextInput id={`${item.key}-q-${lang}`} value={item.q[lang]} maxLength={300} onChange={(e) => setItem(item.key, "q", e.target.value)} />
                    </Field>
                    <Field label={c.answer} htmlFor={`${item.key}-a-${lang}`}>
                      <TextArea id={`${item.key}-a-${lang}`} rows={3} value={item.a[lang]} maxLength={3000} onChange={(e) => setItem(item.key, "a", e.target.value)} />
                    </Field>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <button type="button" className={adminButton("ghost", "sm")} onClick={() => move(index, -1)} disabled={index === 0}>
                      {c.moveUp}
                    </button>
                    <button type="button" className={adminButton("ghost", "sm")} onClick={() => move(index, 1)} disabled={index === items.length - 1}>
                      {c.moveDown}
                    </button>
                    <button
                      type="button"
                      className={cn(adminButton("ghost", "sm"), "text-[#86352b]")}
                      onClick={() => setItems((current) => current.filter((x) => x.key !== item.key))}
                    >
                      {c.removeQuestion}
                    </button>
                  </div>
                </li>
              ))}
            </ol>
            <button
              type="button"
              className={cn(adminButton("outline", "sm"), "mt-3")}
              onClick={() => setItems((current) => [...current, ...withKeys([{ q: { ar: "", en: "" }, a: { ar: "", en: "" } }])])}
            >
              {c.addQuestion}
            </button>
          </Panel>
        ) : null}

        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-ink/10 bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
          <SubmitButton pending={c.saving}>{c.saveDraft}</SubmitButton>
          <div className="min-w-0 flex-1">
            <ActionMessage state={state} />
          </div>
        </div>
      </form>

      {canPublish ? (
        <Panel>
          <div className="flex flex-wrap items-center gap-3">
            <form action={publishAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="page_key" value={pageKey} />
              <input type="hidden" name="intent" value="publish" />
              <input type="hidden" name="content" value={JSON.stringify(payload)} />
              <SubmitButton>{c.publish}</SubmitButton>
            </form>
            {published ? (
              <form action={publishAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="page_key" value={pageKey} />
                <input type="hidden" name="intent" value="unpublish" />
                <SubmitButton tone="outline">{c.unpublish}</SubmitButton>
              </form>
            ) : null}
            <div className="min-w-0 flex-1">
              <ActionMessage state={publishState} />
            </div>
          </div>
        </Panel>
      ) : null}

      <Panel title={c.preview}>
        <article dir={dir} lang={lang} className="min-w-0 space-y-4" data-testid="page-preview">
          <h2 className="font-display text-step-3 text-ink">{content.title[lang]}</h2>
          {content.lead[lang] ? <p className="text-step-1 text-ink-soft">{content.lead[lang]}</p> : null}
          {isFaq ? (
            <dl className="divide-y divide-ink/10">
              {items.map((item) => (
                <div key={item.key} className="py-3">
                  <dt className="font-medium text-ink">{item.q[lang]}</dt>
                  <dd className="mt-1 whitespace-pre-line text-ink-soft">{item.a[lang]}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <RichText text={content.body[lang]} />
          )}
        </article>
      </Panel>
    </div>
  );
}
