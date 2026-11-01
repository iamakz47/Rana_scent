import type { Locale } from "@/i18n/config";

// Prices are integer fils: 1 KWD = 1000 fils. Never use floats for money.
export type Fils = number;

export const FILS_PER_KWD = 1000;

export function assertFils(value: number): Fils {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`Invalid fils amount: ${value}`);
  }
  return value;
}

const formatters = new Map<Locale, Intl.NumberFormat>();

export function formatKWD(fils: Fils, locale: Locale): string {
  let formatter = formatters.get(locale);
  if (!formatter) {
    // Arabic text keeps Western digits, as is common in Kuwaiti e-commerce and
    // consistent with SKUs and order numbers.
    formatter = new Intl.NumberFormat(locale === "ar" ? "ar-KW-u-nu-latn" : "en-KW", {
      style: "currency",
      currency: "KWD",
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });
    formatters.set(locale, formatter);
  }
  // Division by 1000 is exact for display; arithmetic stays in integer fils.
  return formatter.format(fils / FILS_PER_KWD);
}

export function sumFils(values: readonly Fils[]): Fils {
  return values.reduce((total, value) => total + value, 0);
}

export function multiplyFils(unit: Fils, quantity: number): Fils {
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new RangeError(`Invalid quantity: ${quantity}`);
  }
  return assertFils(unit * quantity);
}
