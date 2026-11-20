import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

export function addressLine(a: Record<string, string | boolean | null | undefined>, locale: Locale, dict: Dictionary): string {
  const c = dict.checkout;
  const names = c.governorates as Record<string, string>;
  return [
    names[String(a.governorate)] ?? String(a.governorate),
    a.area,
    `${c.block} ${a.block}`,
    `${c.street} ${a.street}`,
    a.avenue ? `${c.avenue} ${a.avenue}` : "",
    `${c.building} ${a.building}`,
    a.floor ? `${c.floor} ${a.floor}` : "",
    a.apartment ? `${c.apartment} ${a.apartment}` : "",
  ]
    .filter(Boolean)
    .join(locale === "ar" ? "، " : ", ");
}
