import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
const required = (max: number) => z.string().trim().min(1).max(max);
const uuid = z.uuid();
const optionalDate = z.union([z.literal(""), z.iso.datetime({ local: true })]);

export const offerItemSchema = z.object({
  item_product_id: uuid,
  quantity: z.coerce.number().int().min(1).max(50),
  locked_variant_id: z.union([uuid, z.literal("")]).optional(),
});

function jsonList<T extends z.ZodType>(item: T, { min = 0, max = 50 } = {}) {
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
    .pipe(z.array(item).min(min).max(max));
}

export const offerFormSchema = z.object({
  id: z.union([uuid, z.literal("")]).optional(),
  name_ar: required(120),
  // Optional: the Arabic name is used when no English name is given.
  name_en: text(120),
  description_ar: text(5000),
  description_en: text(5000),
  // KWD text input ("55.000"); validated and converted in toPayload, exactly
  // like the product editor's own variant prices.
  price: z.string().trim().min(1),
  allow_discount_stacking: z.boolean(),
  starts_at: optionalDate,
  ends_at: optionalDate,
  // 0 or 1 media_asset id: the promotional image.
  media: jsonList(uuid, { max: 1 }),
  items: jsonList(offerItemSchema, { min: 1, max: 20 }),
});

export type OfferForm = z.infer<typeof offerFormSchema>;

const stringFields = ["name_ar", "name_en", "description_ar", "description_en", "price", "starts_at", "ends_at", "media", "items"] as const;

export function readOfferForm(formData: FormData) {
  const raw: Record<string, unknown> = {};
  // Posted as entity_id: an input named "id" would shadow form.id in the DOM.
  raw.id = typeof formData.get("entity_id") === "string" ? formData.get("entity_id") : "";
  for (const key of stringFields) {
    const value = formData.get(key);
    raw[key] = typeof value === "string" ? value : "";
  }
  raw.allow_discount_stacking = formData.get("allow_discount_stacking") === "on";
  return offerFormSchema.safeParse(raw);
}

// datetime-local values are Kuwait time (UTC+3, no DST), same convention as
// the discount code editor.
function toUtc(local: string): string | null {
  return local ? new Date(`${local}:00+03:00`).toISOString() : null;
}

// Rejects a repeated product: each item must point at a distinct product.
export function duplicateItemIds(items: OfferForm["items"]): boolean {
  const ids = new Set(items.map((item) => item.item_product_id));
  return ids.size !== items.length;
}

export function toPayload(form: OfferForm, priceFils: number) {
  return {
    id: form.id || undefined,
    name_ar: form.name_ar,
    name_en: form.name_en || form.name_ar,
    description_ar: form.description_ar,
    description_en: form.description_en,
    price_fils: priceFils,
    allow_discount_stacking: form.allow_discount_stacking,
    starts_at: toUtc(form.starts_at),
    ends_at: toUtc(form.ends_at),
    media: form.media,
    items: form.items.map((item) => ({
      item_product_id: item.item_product_id,
      quantity: item.quantity,
      locked_variant_id: item.locked_variant_id || null,
    })),
  };
}
