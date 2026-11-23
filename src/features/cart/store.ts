"use client";

import { z } from "zod";
import { useSyncExternalStore } from "react";
import { createPersistentStore } from "@/lib/persistent-store";
import { multiplyFils, sumFils, type Fils } from "@/lib/money";

const localized = z.object({ ar: z.string(), en: z.string() });

// A cart line keeps a display snapshot so the drawer renders instantly.
// The snapshot price is for display only: checkout recomputes every price
// on the server from the catalog and never trusts these values.
const mediaPrefix = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/media/`
  : null;

function isAllowedImage(value: string): boolean {
  if (/^\/images\/[A-Za-z0-9/_.-]+$/.test(value) && !value.includes("..")) return true;
  if (!mediaPrefix || !value.startsWith(mediaPrefix)) return false;
  return /^[a-z]+\/[0-9a-f-]{36}\.(jpg|png|webp|avif)$/.test(value.slice(mediaPrefix.length));
}

const fragranceChoices = z.array(z.object({ id: z.string().min(1).max(64), name: localized })).max(2);

// An offer added to cart as one bundle: the line's own variantId/price are
// the owner's flat offer price; this carries the real included products so
// the drawer/cart/checkout can show and submit the full breakdown. Checkout
// re-validates every one of these on the server.
const bundleComponentSchema = z.object({
  itemProductId: z.string().min(1),
  variantId: z.string().min(1),
  name: localized,
  variantLabel: localized,
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  fragrances: fragranceChoices.optional(),
});

const cartLineSchema = z.object({
  variantId: z.string().min(1),
  productSlug: z.string().min(1),
  name: localized,
  variantLabel: localized,
  unitPriceFils: z.number().int().nonnegative(),
  // Product photo for thumbnails: a site photo, or an upload in this
  // project's public media bucket. Nothing else is accepted from storage.
  image: z.string().refine(isAllowedImage).optional(),
  scentFamily: z.string().optional(),
  // Colour variants: the swatch shown next to the colour name.
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  // Free fragrance choices for EACH device on this line (a preference the
  // courier confirms). Names are a display snapshot; the server re-checks ids.
  fragrances: fragranceChoices.optional(),
  quantity: z.number().int().min(1).max(20),
  bundle: z
    .object({
      offerId: z.string().min(1),
      components: z.array(bundleComponentSchema).min(1).max(20),
    })
    .optional(),
});

export type CartLine = z.infer<typeof cartLineSchema>;
export type BundleComponentLine = z.infer<typeof bundleComponentSchema>;

export const MAX_LINE_QUANTITY = 20;

// A line is one variant with one set of free-fragrance choices: the same
// device with different choices stays a separate line. For an offer, the
// chosen colour/fragrances of every included product are part of the key
// too, so two bundles of the same offer with different colours never merge.
export function lineKey(line: Pick<CartLine, "variantId" | "fragrances" | "bundle">): string {
  const base = `${line.variantId}|${(line.fragrances ?? []).map((f) => f.id).join(",")}`;
  if (!line.bundle) return base;
  const parts = line.bundle.components
    .map((c) => `${c.variantId}:${(c.fragrances ?? []).map((f) => f.id).join(",")}`)
    .join("|");
  return `${base}#${parts}`;
}

const cart = createPersistentStore("rana-cart-v1", z.array(cartLineSchema).max(50), []);

export const useCartLines = cart.useStore;

export function addToCart(line: Omit<CartLine, "quantity">, quantity = 1) {
  const key = lineKey(line);
  cart.set((lines) => {
    const existing = lines.find((item) => lineKey(item) === key);
    if (existing) {
      return lines.map((item) =>
        lineKey(item) === key ? { ...item, quantity: Math.min(MAX_LINE_QUANTITY, item.quantity + quantity) } : item,
      );
    }
    return [...lines, { ...line, quantity: Math.min(MAX_LINE_QUANTITY, quantity) }];
  });
}

export function setLineQuantity(key: string, quantity: number) {
  cart.set((lines) =>
    quantity <= 0
      ? lines.filter((item) => lineKey(item) !== key)
      : lines.map((item) => (lineKey(item) === key ? { ...item, quantity: Math.min(MAX_LINE_QUANTITY, quantity) } : item)),
  );
}

// Changes the free-fragrance choices of a line, merging it into an identical
// line if one exists.
export function setLineFragrances(key: string, fragrances: NonNullable<CartLine["fragrances"]>) {
  cart.set((lines) => {
    const line = lines.find((item) => lineKey(item) === key);
    if (!line) return lines;
    const updated = { ...line, fragrances };
    const newKey = lineKey(updated);
    if (newKey === key) return lines.map((item) => (lineKey(item) === key ? updated : item));
    const twin = lines.find((item) => lineKey(item) === newKey);
    if (twin) {
      return lines
        .filter((item) => lineKey(item) !== key)
        .map((item) =>
          lineKey(item) === newKey ? { ...item, quantity: Math.min(MAX_LINE_QUANTITY, item.quantity + line.quantity) } : item,
        );
    }
    return lines.map((item) => (lineKey(item) === key ? updated : item));
  });
}

// Changes the free-fragrance choices of one included product of an offer
// line, merging it into an identical bundle line if one exists.
export function setBundleComponentFragrances(
  key: string,
  itemProductId: string,
  fragrances: NonNullable<CartLine["fragrances"]>,
) {
  cart.set((lines) => {
    const line = lines.find((item) => lineKey(item) === key);
    if (!line?.bundle) return lines;
    const updated: CartLine = {
      ...line,
      bundle: {
        ...line.bundle,
        components: line.bundle.components.map((c) => (c.itemProductId === itemProductId ? { ...c, fragrances } : c)),
      },
    };
    const newKey = lineKey(updated);
    if (newKey === key) return lines.map((item) => (lineKey(item) === key ? updated : item));
    const twin = lines.find((item) => lineKey(item) === newKey);
    if (twin) {
      return lines
        .filter((item) => lineKey(item) !== key)
        .map((item) =>
          lineKey(item) === newKey ? { ...item, quantity: Math.min(MAX_LINE_QUANTITY, item.quantity + line.quantity) } : item,
        );
    }
    return lines.map((item) => (lineKey(item) === key ? updated : item));
  });
}

// Replaces display snapshots with the server's current prices (from a
// quote), so the drawer and cart page never show an outdated price.
export function syncCartPrices(prices: ReadonlyArray<{ variant_id: string; unit_price_fils: number }>) {
  const byVariant = new Map(prices.map((p) => [p.variant_id, p.unit_price_fils]));
  cart.set((lines) => {
    const changed = lines.some((line) => byVariant.has(line.variantId) && byVariant.get(line.variantId) !== line.unitPriceFils);
    if (!changed) return lines;
    return lines.map((line) => {
      const price = byVariant.get(line.variantId);
      return price !== undefined && Number.isSafeInteger(price) && price >= 0 ? { ...line, unitPriceFils: price } : line;
    });
  });
}

export function clearCart() {
  cart.set(() => []);
}

export function removeLine(key: string) {
  setLineQuantity(key, 0);
}

export function cartTotals(lines: readonly CartLine[]): { count: number; subtotalFils: Fils } {
  return {
    count: lines.reduce((total, line) => total + line.quantity, 0),
    subtotalFils: sumFils(lines.map((line) => multiplyFils(line.unitPriceFils, line.quantity))),
  };
}

// Drawer open state, shared by the header button and add-to-cart actions.
let drawerOpen = false;
const drawerListeners = new Set<() => void>();

export function setCartDrawerOpen(open: boolean) {
  drawerOpen = open;
  drawerListeners.forEach((listener) => listener());
}

export function useCartDrawerOpen(): boolean {
  return useSyncExternalStore(
    (listener) => {
      drawerListeners.add(listener);
      return () => drawerListeners.delete(listener);
    },
    () => drawerOpen,
    () => false,
  );
}
