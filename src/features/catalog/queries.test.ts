import { describe, expect, it } from "vitest";
import { filterProducts, parseCatalogFilter, type CatalogFilter } from "./queries";
import { products } from "./sample-data";
import { lowestPrice } from "./types";

describe("parseCatalogFilter", () => {
  it("keeps valid values and drops unknown ones", () => {
    const filter = parseCatalogFilter({ type: "refill,bogus", family: "oud", sort: "price-asc", inStock: "1" });
    expect(filter.type).toEqual(["refill"]);
    expect(filter.family).toEqual(["oud"]);
    expect(filter.sort).toBe("price-asc");
    expect(filter.inStock).toBe(true);
  });

  it("never throws on hostile input", () => {
    const filter = parseCatalogFilter({ q: "x".repeat(500), sort: "drop table", type: ["a", "b"] });
    expect(filter.q).toBeUndefined();
    expect(filter.sort).toBeUndefined();
    expect(filter.type).toEqual([]);
  });
});

describe("filterProducts", () => {
  const base: CatalogFilter = { type: [], family: [], inStock: false };

  it("filters by type and family", () => {
    const result = filterProducts(products, { ...base, type: ["refill"], family: ["floral"] });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((p) => p.type === "refill" && p.scentFamily === "floral")).toBe(true);
  });

  it("searches English and Arabic names", () => {
    expect(filterProducts(products, { ...base, q: "oud" }).map((p) => p.slug)).toContain("oud-royale");
    expect(filterProducts(products, { ...base, q: "عود" }).map((p) => p.slug)).toContain("oud-royale");
  });

  it("sorts by price ascending", () => {
    const prices = filterProducts(products, { ...base, sort: "price-asc" }).map(lowestPrice);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it("hides sold-out products when in-stock only is set", () => {
    const result = filterProducts(products, { ...base, inStock: true });
    expect(result.every((p) => p.variants.some((v) => v.stock > 0))).toBe(true);
  });
});
