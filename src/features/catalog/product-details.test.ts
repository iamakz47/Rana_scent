import { describe, expect, it } from "vitest";
import { parseRichText } from "@/components/ui/rich-text";
import { readProductDetails } from "@/features/admin/products/details-schema";
import en from "@/i18n/dictionaries/en.json";
import ar from "@/i18n/dictionaries/ar.json";
import { parseDeviceSpecs, parseInfoSections, specRows } from "./product-details";

const labels = (dict: typeof en) => ({ ...dict.product.specLabels, units: dict.product.specUnits, upTo: dict.product.specUpTo });

describe("device specifications", () => {
  const specs = parseDeviceSpecs({
    coverage_m2: 1000,
    capacity_ml: 500,
    dimensions: { width: 20, height: 15, depth: 8, unit: "cm" },
    weight: { value: 1.2, unit: "kg" },
    control_type: { ar: "زر لمس", en: "Touch button" },
    material: { ar: "", en: "" },
    bogus: "ignored",
    noise_db: -3,
  });

  it("formats dimensions in a fixed W × H × D order with the unit, in both languages", () => {
    const enRows = specRows(specs, "en", labels(en));
    const arRows = specRows(specs, "ar", labels(ar as typeof en));
    expect(enRows.find((r) => r.key === "dimensions")).toEqual({ key: "dimensions", label: "Dimensions (W × H × D)", value: "20 × 15 × 8 cm" });
    expect(arRows.find((r) => r.key === "dimensions")?.value).toBe("20 × 15 × 8 سم");
    expect(arRows.find((r) => r.key === "dimensions")?.label).toBe("الأبعاد (العرض × الارتفاع × العمق)");
    expect(enRows.find((r) => r.key === "coverage_m2")?.value).toBe("Up to 1,000 m²");
    expect(arRows.find((r) => r.key === "capacity_ml")?.value).toBe("500 مل");
    expect(enRows.find((r) => r.key === "weight")?.value).toBe("1.2 kg");
  });

  it("drops invalid, empty and unknown values instead of guessing", () => {
    const keys = specRows(specs, "en", labels(en)).map((r) => r.key);
    expect(keys).toEqual(["coverage_m2", "capacity_ml", "dimensions", "weight", "control_type"]);
    expect(specRows(parseDeviceSpecs(null), "en", labels(en))).toEqual([]);
    expect(parseDeviceSpecs({ dimensions: { width: 20, height: 15, unit: "cm" } })).toEqual({});
  });

  it("keeps only information sections with text", () => {
    expect(parseInfoSections({ operation: { ar: "اضغط", en: "Press" }, overview: { ar: "", en: "" }, other: { ar: "x", en: "x" } })).toEqual({
      operation: { ar: "اضغط", en: "Press" },
    });
  });
});

describe("admin product details form", () => {
  const form = (entries: Record<string, string>) => {
    const data = new FormData();
    for (const [k, v] of Object.entries(entries)) data.set(k, v);
    return data;
  };

  it("requires 1 or 2 free fragrances for diffusers only", () => {
    expect(readProductDetails(form({}), "diffuser").errors.free_fragrances).toBe("freeRequired");
    expect(readProductDetails(form({ free_fragrances: "2" }), "diffuser").free_fragrances).toBe("2");
    expect(readProductDetails(form({ free_fragrances: "3" }), "diffuser").errors.free_fragrances).toBe("freeRequired");
    const refill = readProductDetails(form({ free_fragrances: "2" }), "refill");
    expect(refill.free_fragrances).toBe("");
    expect(refill.errors).toEqual({});
  });

  it("validates numbers, dimensions and both languages", () => {
    const r = readProductDetails(
      form({
        free_fragrances: "1",
        spec_coverage_m2: "abc",
        spec_capacity_ml: "٥٠٠",
        spec_dim_width: "20",
        spec_dim_height: "15",
        spec_dim_unit: "cm",
        spec_material_en: "Aluminium",
        info_operation_ar: "اضغط",
        info_operation_en: "Press",
      }),
      "diffuser",
    );
    expect(r.errors).toEqual({ spec_coverage_m2: "number", spec_dimensions: "dimensions", spec_material: "pair" });
    expect(r.device_specs.capacity_ml).toBe(500);
    expect(r.info_sections.operation).toEqual({ ar: "اضغط", en: "Press" });

    const ok = readProductDetails(
      form({ free_fragrances: "2", spec_dim_width: "20", spec_dim_height: "15", spec_dim_depth: "8", spec_dim_unit: "mm" }),
      "diffuser",
    );
    expect(ok.errors).toEqual({});
    expect(ok.device_specs.dimensions).toEqual({ width: 20, height: 15, depth: 8, unit: "mm" });
  });
});

describe("rich text", () => {
  it("parses headings, lists and paragraphs and never HTML", () => {
    const blocks = parseRichText("## Title\nLine one\nline two\n\n- a\n- b\n1. first\n2. second\n<script>x</script>");
    expect(blocks).toEqual([
      { kind: "heading", text: "Title" },
      { kind: "p", text: "Line one line two" },
      { kind: "ul", items: ["a", "b"] },
      { kind: "ol", items: ["first", "second"] },
      { kind: "p", text: "<script>x</script>" },
    ]);
  });
});
