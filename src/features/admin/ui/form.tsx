"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { adminButton } from "./primitives";

export type ActionResult = { status: "idle" | "ok" | "error"; message?: string; fieldErrors?: Record<string, string> };
export const idle: ActionResult = { status: "idle" };

export function SubmitButton({
  children,
  pending,
  tone = "primary",
  size = "md",
  className,
  name,
  value,
}: {
  children: ReactNode;
  pending?: ReactNode;
  tone?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md";
  className?: string;
  name?: string;
  value?: string;
}) {
  const status = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={status.pending}
      aria-busy={status.pending}
      className={cn(adminButton(tone, size), className)}
    >
      {status.pending && pending ? pending : children}
    </button>
  );
}

export function ActionMessage({ state }: { state: ActionResult }) {
  if (state.status === "idle" || !state.message) return <p aria-live="polite" className="sr-only" />;
  return (
    <p
      aria-live="polite"
      role={state.status === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg px-3 py-2 text-step--1",
        state.status === "ok" ? "bg-[#5f7f5a]/10 text-[#3f5c3b]" : "bg-[#a4493d]/10 text-[#86352b]",
      )}
    >
      {state.message}
    </p>
  );
}
