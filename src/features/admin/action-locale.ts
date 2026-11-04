import { defaultLocale, isLocale, type Locale } from "@/i18n/config";

// Server Actions can't read root params, so forms post the locale as a
// hidden field. Anything unexpected falls back to the default locale.
export function actionLocale(formData: FormData): Locale {
  const value = formData.get("locale");
  return typeof value === "string" && isLocale(value) ? value : defaultLocale;
}
