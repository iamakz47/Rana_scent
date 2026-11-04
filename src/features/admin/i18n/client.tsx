"use client";

import { createContext, use, type ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { AdminDictionary } from "./en";

type AdminI18n = { locale: Locale; t: AdminDictionary };

const AdminI18nContext = createContext<AdminI18n | null>(null);

export function AdminI18nProvider({ value, children }: { value: AdminI18n; children: ReactNode }) {
  return <AdminI18nContext value={value}>{children}</AdminI18nContext>;
}

export function useAdminI18n(): AdminI18n {
  const value = use(AdminI18nContext);
  if (!value) throw new Error("useAdminI18n must be used inside <AdminI18nProvider>");
  return value;
}
