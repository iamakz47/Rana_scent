import { describe, expect, it } from "vitest";
import ar from "./dictionaries/ar.json";
import en from "./dictionaries/en.json";

// Every storefront string exists in both languages, with the same
// placeholders, and no Arabic value is left in English by mistake.
function flatten(value: unknown, prefix = ""): Record<string, string> {
  if (typeof value === "string") return { [prefix]: value };
  if (Array.isArray(value)) return Object.assign({}, ...value.map((v, i) => flatten(v, `${prefix}[${i}]`)));
  if (value && typeof value === "object") {
    return Object.assign({}, ...Object.entries(value).map(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k)));
  }
  return { [prefix]: String(value) };
}

const enFlat = flatten(en);
const arFlat = flatten(ar);
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("storefront dictionaries", () => {
  it("have the same keys", () => {
    expect(Object.keys(arFlat).filter((k) => !(k in enFlat))).toEqual([]);
    expect(Object.keys(enFlat).filter((k) => !(k in arFlat))).toEqual([]);
  });

  it("use the same placeholders", () => {
    const mismatched = Object.keys(enFlat).filter(
      (k) => k in arFlat && placeholders(enFlat[k]).join() !== placeholders(arFlat[k]).join(),
    );
    expect(mismatched).toEqual([]);
  });

  it("have no empty strings", () => {
    expect(Object.entries(arFlat).filter(([, v]) => v.trim() === "").map(([k]) => k)).toEqual([]);
    expect(Object.entries(enFlat).filter(([, v]) => v.trim() === "").map(([k]) => k)).toEqual([]);
  });

  it("Arabic values contain Arabic text (or are names, numbers or codes)", () => {
    const allowedLatin = /^(?:[A-Z0-9 .,:/+()–-]+|Rana Scent|KNET|Visa|Mastercard|Apple Pay|Instagram|WhatsApp|English|Tap|[\w.+-]+@[\w.-]+|https?:.*)$/;
    const suspicious = Object.entries(arFlat)
      .filter(([, v]) => !/[؀-ۿ]/.test(v) && !allowedLatin.test(v.trim()) && placeholders(v).length === 0)
      .map(([k, v]) => `${k}=${v}`);
    expect(suspicious).toEqual([]);
  });
});
