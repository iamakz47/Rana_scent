import { z } from "zod";
import type { Locale, Localized } from "@/i18n/config";

// Structured device specifications and information sections. Every field is
// optional: only values Rana Scent has entered are shown, nothing is guessed.
// Shared by the storefront (display) and the admin (editing).

const text = z.object({ ar: z.string().trim().max(400), en: z.string().trim().max(400) });
const positive = z.number().positive().max(1_000_000);

export const dimensionUnits = ["cm", "mm"] as const;
export const weightUnits = ["g", "kg"] as const;

export const deviceSpecsSchema = z.object({
  device_type: text.optional(),
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

const infoText = z.object({ ar: z.string().trim().max(5000), en: z.string().trim().max(5000) });
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

export type SpecLabels = Record<SpecKey, string> & {
  units: { cm: string; mm: string; g: string; kg: string; m2: string; ml: string; w: string; db: string };
  upTo: string;
};

const number = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);

// Rows for the specification table, in a fixed order, skipping anything
// without a value in the visitor's language.
export function specRows(specs: DeviceSpecs, locale: Locale, labels: SpecLabels): Array<{ key: SpecKey; label: string; value: string }> {
  const u = labels.units;
  const rows: Array<{ key: SpecKey; label: string; value: string }> = [];
  for (const key of specKeys) {
    const raw = specs[key];
    if (raw === undefined) continue;
    let value = "";
    switch (key) {
      case "coverage_m2":
        value = labels.upTo.replace("{value}", `${number(raw as number)} ${u.m2}`);
        break;
      case "capacity_ml":
        value = `${number(raw as number)} ${u.ml}`;
        break;
      case "power_consumption_w":
        value = `${number(raw as number)} ${u.w}`;
        break;
      case "noise_db":
        value = `${number(raw as number)} ${u.db}`;
        break;
      case "dimensions": {
        const d = raw as NonNullable<DeviceSpecs["dimensions"]>;
        value = `${number(d.width)} × ${number(d.height)} × ${number(d.depth)} ${u[d.unit]}`;
        break;
      }
      case "weight": {
        const w = raw as NonNullable<DeviceSpecs["weight"]>;
        value = `${number(w.value)} ${u[w.unit]}`;
        break;
      }
      default:
        value = ((raw as Localized)[locale] ?? "").trim();
    }
    if (value) rows.push({ key, label: labels[key], value });
  }
  return rows;
}
