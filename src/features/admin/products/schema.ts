import { z } from "zod";
import { parseKwdToFils } from "@/features/admin/format";

const text = (max: number) => z.string().trim().max(max);
const required = (max: number) => z.string().trim().min(1).max(max);
const uuid = z.uuid();

export const productTypes = ["diffuser", "refill", "accessory", "bundle"] as const;
export const spaces = ["majlis", "living", "bedroom", "office", "car"] as const;

export const variantSchema = z
  .object({
    id: z.union([uuid, z.literal("")]).optional(),
    sku: z.string().trim().toUpperCase().regex(/^[A-Z0-9]+(-[A-Z0-9]+)*$/).max(40),
    label_ar: required(60),
    label_en: required(60),
    price: z.string(),
    compare_at: z.string().optional(),
    is_active: z.boolean().default(true),
  })
  .transform((v, ctx) => {
    const price = parseKwdToFils(v.price);
    if (price === null) {
      ctx.addIssue({ code: "custom", message: "price", path: ["price"] });
      return z.NEVER;
    }
    const hasCompare = Boolean(v.compare_at?.trim());
    const compare = hasCompare ? parseKwdToFils(v.compare_at) : null;
    if (hasCompare && (compare === null || compare <= price)) {
      ctx.addIssue({ code: "custom", message: "compare", path: ["compare_at"] });
      return z.NEVER;
    }
    return {
      id: v.id || undefined,
      sku: v.sku,
      label_ar: v.label_ar,
      label_en: v.label_en,
      price_fils: price,
      compare_at_fils: compare,
      is_active: v.is_active,
    };
  });

// "Label | Value" per line; Arabic and English lines are matched by position.
export function parseSpecs(ar: string, en: string) {
  const split = (value: string) =>
    value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [label, ...rest] = line.split("|");
        return { label: label.trim(), value: rest.join("|").trim() };
      });
  const left = split(ar);
  const right = split(en);
  if (left.length !== right.length) return null;
  if ([...left, ...right].some((row) => !row.label || !row.value || row.label.length > 60 || row.value.length > 160)) {
    return null;
  }
  return left.map((row, index) => ({
    label: { ar: row.label, en: right[index].label },
    value: { ar: row.value, en: right[index].value },
  }));
}

export function formatSpecs(specs: unknown, lang: "ar" | "en"): string {
  if (!Array.isArray(specs)) return "";
  return specs
    .map((row: { label?: Record<string, string>; value?: Record<string, string> }) =>
      `${row?.label?.[lang] ?? ""} | ${row?.value?.[lang] ?? ""}`,
    )
    .join("\n");
}

function jsonList<T extends z.ZodType>(item: T, { min = 0 } = {}) {
  return z
    .string()
    .transform((value, ctx) => {
      try {
        return JSON.parse(value || "[]") as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "json" });
        return z.NEVER;
      }
    })
    .pipe(z.array(item).min(min).max(50));
}

export const productFormSchema = z.object({
  id: z.union([uuid, z.literal("")]).optional(),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80),
  type: z.enum(productTypes),
  name_ar: required(120),
  name_en: required(120),
  short_description_ar: text(200),
  short_description_en: text(200),
  description_ar: text(5000),
  description_en: text(5000),
  notes_top_ar: text(80),
  notes_top_en: text(80),
  notes_heart_ar: text(80),
  notes_heart_en: text(80),
  notes_base_ar: text(80),
  notes_base_en: text(80),
  specs_ar: text(4000),
  specs_en: text(4000),
  specs_confirmed: z.boolean(),
  spaces: z.array(z.enum(spaces)),
  is_featured: z.boolean(),
  is_new: z.boolean(),
  position: z.coerce.number().int().min(0).max(100000),
  category_id: z.union([uuid, z.literal("")]),
  seo_title_ar: text(70),
  seo_title_en: text(70),
  seo_description_ar: text(170),
  seo_description_en: text(170),
  variants: jsonList(variantSchema, { min: 1 }),
  media: jsonList(uuid),
  scents: jsonList(uuid),
  compatible: jsonList(uuid),
});

export type ProductForm = z.infer<typeof productFormSchema>;

const stringFields = [
  "id", "slug", "type", "name_ar", "name_en", "short_description_ar", "short_description_en",
  "description_ar", "description_en", "notes_top_ar", "notes_top_en", "notes_heart_ar", "notes_heart_en",
  "notes_base_ar", "notes_base_en", "specs_ar", "specs_en", "position", "category_id",
  "seo_title_ar", "seo_title_en", "seo_description_ar", "seo_description_en",
  "variants", "media", "scents", "compatible",
] as const;

export function readProductForm(formData: FormData) {
  const raw: Record<string, unknown> = {};
  for (const key of stringFields) {
    const value = formData.get(key);
    raw[key] = typeof value === "string" ? value : "";
  }
  raw.specs_confirmed = formData.get("specs_confirmed") === "on";
  raw.is_featured = formData.get("is_featured") === "on";
  raw.is_new = formData.get("is_new") === "on";
  raw.spaces = formData.getAll("spaces").filter((value) => typeof value === "string");
  return productFormSchema.safeParse(raw);
}

export function toPayload(form: ProductForm, specs: ReturnType<typeof parseSpecs>) {
  const notes = [form.notes_top_ar, form.notes_top_en, form.notes_heart_ar, form.notes_heart_en, form.notes_base_ar, form.notes_base_en];
  return {
    id: form.id || undefined,
    slug: form.slug,
    type: form.type,
    name_ar: form.name_ar,
    name_en: form.name_en,
    short_description_ar: form.short_description_ar,
    short_description_en: form.short_description_en,
    description_ar: form.description_ar,
    description_en: form.description_en,
    notes: notes.some(Boolean)
      ? {
          top: { ar: form.notes_top_ar, en: form.notes_top_en },
          heart: { ar: form.notes_heart_ar, en: form.notes_heart_en },
          base: { ar: form.notes_base_ar, en: form.notes_base_en },
        }
      : null,
    specs: specs ?? [],
    specs_confirmed: form.specs_confirmed,
    spaces: form.spaces,
    is_featured: form.is_featured,
    is_new: form.is_new,
    position: form.position,
    category_id: form.category_id || null,
    seo_title_ar: form.seo_title_ar,
    seo_title_en: form.seo_title_en,
    seo_description_ar: form.seo_description_ar,
    seo_description_en: form.seo_description_en,
    variants: form.variants.map((variant, index) => ({ ...variant, position: index })),
    media: form.media,
    scents: form.scents,
    compatible: form.compatible,
  };
}
