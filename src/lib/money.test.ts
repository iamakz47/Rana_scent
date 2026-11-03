import { describe, expect, it } from "vitest";
import { assertFils, formatKWD, multiplyFils, sumFils } from "./money";

describe("money", () => {
  it("formats KWD with three decimals in both locales", () => {
    expect(formatKWD(14500, "en")).toMatch(/14\.500/);
    expect(formatKWD(14500, "en")).toMatch(/KWD/);
    expect(formatKWD(14500, "ar")).toMatch(/14[.٫]500/);
    expect(formatKWD(5, "en")).toMatch(/0\.005/);
  });

  it("keeps arithmetic in integer fils", () => {
    expect(sumFils([100, 250, 1])).toBe(351);
    expect(multiplyFils(14500, 3)).toBe(43500);
  });

  it("rejects fractional or negative amounts", () => {
    expect(() => assertFils(1.5)).toThrow(RangeError);
    expect(() => assertFils(-1)).toThrow(RangeError);
    expect(() => multiplyFils(100, 1.5)).toThrow(RangeError);
  });
});
