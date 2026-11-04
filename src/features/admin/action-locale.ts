import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { adminAr } from "./i18n/ar";
import { adminEn, type AdminDictionary } from "./i18n/en";

// Server Actions can't read root params, so forms post the locale as a
// hidden field. Anything unexpected falls back to the default locale.
export function actionLocale(formData: FormData): Locale {
  const value = formData.get("locale");
  return typeof value === "string" && isLocale(value) ? value : defaultLocale;
}

export function actionDictionary(formData: FormData): AdminDictionary {
  return actionLocale(formData) === "ar" ? adminAr : adminEn;
}

type DbError = { code?: string; message?: string } | null | undefined;

// Maps a database error to a message safe to show staff. Raw messages are
// only used for our own check failures, which are written for people.
export function dbErrorMessage(error: DbError, t: AdminDictionary, duplicate?: string): string {
  if (!error) return t.common.error;
  if (error.code === "23505") return duplicate ?? t.common.error;
  if (error.code === "42501") return t.common.noPermissionAction;
  return t.common.error;
}
