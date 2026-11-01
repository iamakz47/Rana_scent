"use client";

import { createContext, use, type ReactNode } from "react";
import type { Locale } from "./config";
import type { Dictionary } from "./dictionaries";

type I18n = { locale: Locale; dir: "rtl" | "ltr"; dict: Dictionary };

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ value, children }: { value: I18n; children: ReactNode }) {
  return <I18nContext value={value}>{children}</I18nContext>;
}

// Locale and dictionary for Client Components. Server Components should use
// getLocale() / getDictionary() instead.
export function useI18n(): I18n {
  const value = use(I18nContext);
  if (!value) throw new Error("useI18n must be used inside <I18nProvider>");
  return value;
}
