import { z } from "zod";
import type { Locale, Localized } from "@/i18n/config";

// Structured device specifications and information sections. Every field is
// optional: only values Rana Scent has entered are shown, nothing is guessed.
// Shared by the storefront (display) and the admin (editing).

const text = z.object({ ar: z.string().trim().max(400), en: z.string().trim().max(400).default("") });
const positive = z.number().positive().max(1_000_000);

export const dimensionUnits = ["cm", "mm"] as const;
export const weightUnits = ["g", "kg"] as const;

export const deviceSpecsSchema = z.object({
  device_type: text.optional(),
  // Phase 6: the six specifications the owner fills in, as plain text.
  coverage: text.optional(),
  screen: text.optional(),
  capacity: text.optional(),
  color: text.optional(),
  coverage_m2: positive.optional(),
  capacity_ml: positive.optional(),
  // Always width × height × depth, in one unit.
  dimensions: z.object({ width: positive, height: positive, depth: positive, unit: z.enum(dimensionUnits) }).optional(),
  weight: z.object({ value: positive, unit: z.enum(weightUnits) }).optional(),
  power_supply: text.optional(),
  power_consumption_w: positive.optional(),
  operating_method: text.optional(),
  control_type: text.optional(),
  colors: text.optional(),
  material: text.optional(),
  installation: text.optional(),
  fragrance_consumption: text.optional(),
  noise_db: positive.optional(),
  environments: text.optional(),
  maintenance: text.optional(),
  warranty: text.optional(),
  package_contents: text.optional(),
});
export type DeviceSpecs = z.infer<typeof deviceSpecsSchema>;

// Display order of the specification table.
export const specKeys = [
  "device_type",
  "coverage_m2",
  "capacity_ml",
  "dimensions",
  "weight",
  "power_supply",
  "power_consumption_w",
  "operating_method",
  "control_type",
  "colors",
  "material",
  "installation",
  "fragrance_consumption",
  "noise_db",
  "environments",
  "maintenance",
  "warranty",
  "package_contents",
] as const;
export type SpecKey = (typeof specKeys)[number];

export const textSpecKeys = specKeys.filter((key) =>
  !["coverage_m2", "capacity_ml", "dimensions", "weight", "power_consumption_w", "noise_db"].includes(key),
) as Array<Exclude<SpecKey, "coverage_m2" | "capacity_ml" | "dimensions" | "weight" | "power_consumption_w" | "noise_db">>;

export const infoKeys = [
  "overview",
  "features",
  "coverage_usage",
  "operation",
  "installation",
  "maintenance",
  "cartridges",
  "in_the_box",
  "warranty_support",
  "usage_notes",
] as const;
export type InfoKey = (typeof infoKeys)[number];

const infoText = z.object({ ar: z.string().trim().max(5000), en: z.string().trim().max(5000).default("") });
export const infoSectionsSchema = z.object(
  Object.fromEntries(infoKeys.map((key) => [key, infoText.optional()])) as Record<InfoKey, z.ZodOptional<typeof infoText>>,
);
export type InfoSections = z.infer<typeof infoSectionsSchema>;

// Lenient parsing for stored JSON: invalid fields are dropped, never shown.
export function parseDeviceSpecs(value: unknown): DeviceSpecs {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, unknown> = {};
  const shape = deviceSpecsSchema.shape as Record<string, z.ZodType>;
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const field = shape[key];
    if (!field) continue;
    const parsed = field.safeParse(raw);
    if (parsed.success && parsed.data !== undefined) out[key] = parsed.data;
  }
  return out as DeviceSpecs;
}

export function parseInfoSections(value: unknown): InfoSections {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const key of infoKeys) {
    const parsed = infoText.safeParse((value as Record<string, unknown>)[key]);
    if (parsed.success && (parsed.data.ar || parsed.data.en)) out[key] = parsed.data;
  }
  return out as InfoSections;
}

// The six specifications shown on the storefront, in this order. Older
// structured values (coverage in m², capacity in ml, colours) are used as a
// fallback so existing products keep their information.
export const simpleSpecKeys = ["device_type", "coverage", "screen", "capacity", "installation", "color"] as const;
export type SimpleSpecKey = (typeof simpleSpecKeys)[number];

export type SpecLabels = Record<SimpleSpecKey, string> & {
  units: { m2: string; ml: string };
  upTo: string;
};

const number = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);

// A text value in the visitor's language; English falls back to Arabic so
// the owner never has to type everything twice.
export function specText(value: Localized | undefined, locale: Locale): string {
  if (!value) return "";
  return (value[locale] || value.ar || value.en || "").trim();
}

export function specValue(specs: DeviceSpecs, key: SimpleSpecKey, locale: Locale, labels: SpecLabels): string {
  switch (key) {
    case "coverage":
      return specText(specs.coverage, locale) ||
        (specs.coverage_m2 ? labels.upTo.replace("{value}", `${number(specs.coverage_m2)} ${labels.units.m2}`) : "");
    case "capacity":
      return specText(specs.capacity, locale) || (specs.capacity_ml ? `${number(specs.capacity_ml)} ${labels.units.ml}` : "");
    case "color":
      return specText(specs.color, locale) || specText(specs.colors, locale);
    default:
      return specText(specs[key], locale);
  }
}

// Rows for the specification table, skipping anything without a value.
export function specRows(specs: DeviceSpecs, locale: Locale, labels: SpecLabels): Array<{ key: SimpleSpecKey; label: string; value: string }> {
  return simpleSpecKeys
    .map((key) => ({ key, label: labels[key], value: specValue(specs, key, locale, labels) }))
    .filter((row) => row.value);
}
