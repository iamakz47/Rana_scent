import type { Locale } from "@/i18n/config";

// Dates are formatted from stored timestamps only (never "now"), so pages
// stay deterministic under Cache Components.
export function formatDateTime(value: string | null | undefined, locale: Locale): string {
  if (!value) return "";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-KW-u-nu-latn" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kuwait",
  }).format(new Date(value));
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-KW-u-nu-latn" : "en-GB").format(value);
}

// KWD text input ("12.5", "12.500") ↔ integer fils. Rejects more than three
// decimals and anything that isn't a plain non-negative number.
export function parseKwdToFils(input: unknown): number | null {
  if (typeof input !== "string") return null;
  const value = input.trim().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace("٫", ".");
  if (!/^\d{1,6}(\.\d{1,3})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 1000 + Number(fraction.padEnd(3, "0"));
}

export function filsToKwdInput(fils: number | null | undefined): string {
  if (fils === null || fils === undefined) return "";
  return (fils / 1000).toFixed(3);
}
