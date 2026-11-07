import { z } from "zod";
import {
  availabilityOf,
  lowestPrice,
  productStock,
  productTypes,
  scentFamilies,
  type Product,
} from "./types";

// Pure catalog filtering and URL parsing, safe for Client Components.

export const sortOptions = ["featured", "newest", "price-asc", "price-desc"] as const;
export type SortOption = (typeof sortOptions)[number];

const csv = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .optional()
    .transform((raw) =>
      (raw ?? "")
        .split(",")
        .filter((value): value is T[number] => (values as readonly string[]).includes(value)),
    );

// Parses untrusted URL search params; invalid values are dropped, not thrown.
export const catalogFilterSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  type: csv(productTypes).catch([]),
  family: csv(scentFamilies).catch([]),
  sort: z.enum(sortOptions).optional().catch(undefined),
  inStock: z
    .enum(["1"])
    .optional()
    .transform((value) => value === "1")
    .catch(false),
});

export type CatalogFilter = z.infer<typeof catalogFilterSchema>;

export function parseCatalogFilter(
  params: Record<string, string | string[] | undefined>,
): CatalogFilter {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  return catalogFilterSchema.parse({
    q: first(params.q),
    type: first(params.type),
    family: first(params.family),
    sort: first(params.sort),
    inStock: first(params.inStock),
  });
}

function normalize(text: string): string {
  // Fold case and strip Arabic diacritics/tatweel so search is forgiving.
  return text
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[̀-ͯ]/g, "");
}

function matchesQuery(product: Product, query: string): boolean {
  const needle = normalize(query);
  const haystack = [
    product.name.ar,
    product.name.en,
    product.tagline.ar,
    product.tagline.en,
    product.notes?.top.en,
    product.notes?.heart.en,
    product.notes?.base.en,
    product.notes?.top.ar,
    product.notes?.heart.ar,
    product.notes?.base.ar,
  ]
    .filter(Boolean)
    .map((value) => normalize(value as string))
    .join(" ");
  return haystack.includes(needle);
}

export function filterProducts(all: readonly Product[], filter: CatalogFilter): Product[] {
  const result = all.filter((product) => {
    if (filter.q && !matchesQuery(product, filter.q)) return false;
    if (filter.type.length && !filter.type.includes(product.type)) return false;
    if (filter.family.length) {
      if (!product.scentFamily || !filter.family.includes(product.scentFamily)) return false;
    }
    if (filter.inStock && availabilityOf(productStock(product)) === "out_of_stock") return false;
    return true;
  });

  const order = all.map((product) => product.id);
  switch (filter.sort) {
    case "price-asc":
      return result.sort((a, b) => lowestPrice(a) - lowestPrice(b));
    case "price-desc":
      return result.sort((a, b) => lowestPrice(b) - lowestPrice(a));
    case "newest":
      return result.sort((a, b) => Number(Boolean(b.isNew)) - Number(Boolean(a.isNew)));
    default:
      return result.sort(
        (a, b) =>
          Number(Boolean(b.featured)) - Number(Boolean(a.featured)) ||
          order.indexOf(a.id) - order.indexOf(b.id),
      );
  }
}

