import "server-only";
import type { Locale } from "@/i18n/config";
import { getLocale } from "@/i18n/dictionaries";
import { adminAr } from "./ar";
import { adminEn, type AdminDictionary } from "./en";

export type { AdminDictionary };

const dictionaries: Record<Locale, AdminDictionary> = { ar: adminAr, en: adminEn };

export async function getAdminDictionary(): Promise<{ locale: Locale; t: AdminDictionary }> {
  const locale = await getLocale();
  return { locale, t: dictionaries[locale] };
}
