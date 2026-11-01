import { describe, expect, it } from "vitest";
import { cartTotals, type CartLine } from "./store";

const line = (variantId: string, unitPriceFils: number, quantity: number): CartLine => ({
  variantId,
  productSlug: variantId,
  name: { ar: variantId, en: variantId },
  variantLabel: { ar: "", en: "" },
  unitPriceFils,
  art: "cartridge",
  quantity,
});

describe("cartTotals", () => {
  it("sums quantities and integer fils subtotals", () => {
    expect(cartTotals([line("a", 14500, 2), line("b", 9500, 1)])).toEqual({ count: 3, subtotalFils: 38500 });
  });

  it("handles an empty cart", () => {
    expect(cartTotals([])).toEqual({ count: 0, subtotalFils: 0 });
  });
});
