import { describe, expect, it } from "vitest";
import { filsToKwdInput, parseKwdToFils } from "./format";

describe("KWD input parsing", () => {
  it("converts KWD text to integer fils without floating point", () => {
    expect(parseKwdToFils("29")).toBe(29000);
    expect(parseKwdToFils("14.5")).toBe(14500);
    expect(parseKwdToFils("0.005")).toBe(5);
    expect(parseKwdToFils(" 119.000 ")).toBe(119000);
    expect(parseKwdToFils("٢٩٫٥")).toBe(29500);
  });

  it("rejects invalid amounts", () => {
    for (const bad of ["", "-1", "1.2345", "abc", "1e3", "1,000", null, 5]) {
      expect(parseKwdToFils(bad)).toBeNull();
    }
  });

  it("formats fils back for inputs", () => {
    expect(filsToKwdInput(14500)).toBe("14.500");
    expect(filsToKwdInput(null)).toBe("");
  });
});
