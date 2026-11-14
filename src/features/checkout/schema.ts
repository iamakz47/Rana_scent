import { z } from "zod";

// Shared by the checkout form (instant feedback) and the server action.
// The database repeats every check in place_order(); prices are never sent.

export const governorates = ["capital", "hawalli", "farwaniya", "ahmadi", "jahra", "mubarak_al_kabeer"] as const;
export type Governorate = (typeof governorates)[number];

const arabicDigits = "٠١٢٣٤٥٦٧٨٩";

// Accepts 8-digit Kuwaiti numbers with or without +965 / 00965, spaces or
// Arabic-Indic digits. Returns "+965XXXXXXXX" or null.
export function normalizeKuwaitPhone(input: string): string | null {
  let digits = input.replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d))).replace(/[^\d+]/g, "");
  if (digits.startsWith("+965")) digits = digits.slice(4);
  else if (digits.startsWith("00965")) digits = digits.slice(5);
  else if (/^965\d{8}$/.test(digits)) digits = digits.slice(3);
  return /^[2569]\d{7}$/.test(digits) ? `+965${digits}` : null;
}

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

export const cartItemsSchema = z
  .array(z.object({ variant_id: z.uuid(), quantity: z.number().int().min(1).max(20) }))
  .min(1)
  .max(30);

export const checkoutSchema = z.object({
  idempotency_key: z.uuid(),
  locale: z.enum(["ar", "en"]),
  customer_name: text(2, 120),
  phone: z.string().transform((value, ctx) => {
    const phone = normalizeKuwaitPhone(value);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "phone_invalid" });
      return z.NEVER;
    }
    return phone;
  }),
  email: z.union([z.literal(""), z.email().max(254)]),
  governorate: z.enum(governorates),
  area: text(1, 80),
  block: text(1, 20),
  street: text(1, 80),
  avenue: text(0, 40),
  building: text(1, 40),
  floor: text(0, 10),
  apartment: text(0, 20),
  delivery_instructions: text(0, 300),
  customer_note: text(0, 500),
  discount_code: z.string().trim().toUpperCase().max(24),
  payment_method: z.enum(["tap", "cod"]),
  items: cartItemsSchema,
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

// Maps a validation issue to the error keys the dictionary knows.
export function issueToErrorKey(path: PropertyKey | undefined): string {
  switch (path) {
    case "customer_name":
      return "name_invalid";
    case "phone":
      return "phone_invalid";
    case "email":
      return "email_invalid";
    case "items":
      return "cart_invalid";
    case "delivery_instructions":
    case "customer_note":
      return "note_too_long";
    case "payment_method":
      return "payment_method_unavailable";
    default:
      return "address_invalid";
  }
}

// Errors the database raises on purpose (stable codes we can translate).
export const knownCheckoutErrors = new Set([
  "name_invalid", "phone_invalid", "email_invalid", "address_invalid", "note_too_long",
  "payment_method_unavailable", "too_many_orders", "cart_empty", "cart_invalid", "item_unavailable",
  "out_of_stock", "quantity_invalid", "discount_invalid", "discount_used_up", "discount_minimum",
  "delivery_unavailable",
]);
