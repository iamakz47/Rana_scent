export const locales = ["ar", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ar";

// Cookie that remembers a visitor's explicit language choice.
export const localeCookie = "NEXT_LOCALE";

const rtlLocales: ReadonlySet<Locale> = new Set(["ar"]);

export function isLocale(value: string | undefined): value is Locale {
  return locales.includes(value as Locale);
}

export function getDirection(locale: Locale): "rtl" | "ltr" {
  return rtlLocales.has(locale) ? "rtl" : "ltr";
}
