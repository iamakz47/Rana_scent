"use client";

import { z } from "zod";
import { useSyncExternalStore } from "react";
import { createPersistentStore } from "@/lib/persistent-store";
import { multiplyFils, sumFils, type Fils } from "@/lib/money";

const localized = z.object({ ar: z.string(), en: z.string() });

// A cart line keeps a display snapshot so the drawer renders instantly.
// The snapshot price is for display only: checkout recomputes every price
// on the server from the catalog and never trusts these values.
const cartLineSchema = z.object({
  variantId: z.string().min(1),
  productSlug: z.string().min(1),
  name: localized,
  variantLabel: localized,
  unitPriceFils: z.number().int().nonnegative(),
  // Product photo path for thumbnails; must be a same-site path.
  image: z.string().regex(/^\/images\//).optional(),
  scentFamily: z.string().optional(),
  quantity: z.number().int().min(1).max(20),
});

export type CartLine = z.infer<typeof cartLineSchema>;

export const MAX_LINE_QUANTITY = 20;

const cart = createPersistentStore("rana-cart-v1", z.array(cartLineSchema).max(50), []);

export const useCartLines = cart.useStore;

export function addToCart(line: Omit<CartLine, "quantity">, quantity = 1) {
  cart.set((lines) => {
    const existing = lines.find((item) => item.variantId === line.variantId);
    if (existing) {
      return lines.map((item) =>
        item.variantId === line.variantId
          ? { ...item, quantity: Math.min(MAX_LINE_QUANTITY, item.quantity + quantity) }
          : item,
      );
    }
    return [...lines, { ...line, quantity: Math.min(MAX_LINE_QUANTITY, quantity) }];
  });
}

export function setLineQuantity(variantId: string, quantity: number) {
  cart.set((lines) =>
    quantity <= 0
      ? lines.filter((item) => item.variantId !== variantId)
      : lines.map((item) =>
          item.variantId === variantId
            ? { ...item, quantity: Math.min(MAX_LINE_QUANTITY, quantity) }
            : item,
        ),
  );
}

export function removeLine(variantId: string) {
  setLineQuantity(variantId, 0);
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
