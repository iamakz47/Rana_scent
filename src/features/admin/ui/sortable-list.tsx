"use client";

import { useActionState, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useAdminI18n } from "@/features/admin/i18n/client";
import { ActionMessage, idle, SubmitButton, type ActionResult } from "./form";
import { adminButton } from "./primitives";

// Keyboard- and touch-friendly reordering with explicit up/down buttons
// (no drag-only interaction). Saving posts the ids in their new order.
export function SortableList({
  items,
  action,
  disabled,
}: {
  items: Array<{ id: string; content: ReactNode }>;
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  disabled?: boolean;
}) {
  const { locale, t } = useAdminI18n();
  const [order, setOrder] = useState(items.map((item) => item.id));
  const [state, formAction] = useActionState(action, idle);
  const byId = new Map(items.map((item) => [item.id, item]));
  const changed = order.join() !== items.map((item) => item.id).join();

  const move = (index: number, delta: number) =>
    setOrder((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      {order.map((id) => (
        <input key={id} type="hidden" name="ids" value={id} />
      ))}
      <ol className="divide-y divide-ink/8 overflow-hidden rounded-2xl border border-ink/10 bg-canvas">
        {order.map((id, index) => (
          <li key={id} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
            <span className="w-6 shrink-0 text-center font-display text-step-0 text-taupe tabular-nums">{index + 1}</span>
            <div className="min-w-0 flex-1">{byId.get(id)?.content}</div>
            {!disabled ? (
              <span className="flex shrink-0 flex-col gap-1 sm:flex-row">
                <button
                  type="button"
                  className={cn(adminButton("ghost", "sm"), "px-2")}
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={t.common.moveUp}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={cn(adminButton("ghost", "sm"), "px-2")}
                  onClick={() => move(index, 1)}
                  disabled={index === order.length - 1}
                  aria-label={t.common.moveDown}
                >
                  ↓
                </button>
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      {!disabled ? (
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton tone={changed ? "primary" : "outline"} size="sm">
            {t.common.save} · {t.common.position}
          </SubmitButton>
          <ActionMessage state={state} />
        </div>
      ) : null}
    </form>
  );
}
