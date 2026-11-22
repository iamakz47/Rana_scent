import { describe, expect, it } from "vitest";
import { parseRichText } from "@/components/ui/rich-text";
import { readProductDetails } from "@/features/admin/products/details-schema";
import { productFormSchema, slugFromName } from "@/features/admin/products/schema";
import { toCartLine } from "@/features/cart/to-cart-line";
import en from "@/i18n/dictionaries/en.json";
import ar from "@/i18n/dictionaries/ar.json";
import { parseDeviceSpecs, parseInfoSections, specRows } from "./product-details";
import { defaultVariant, hasColorChoice, variantImages, type Product } from "./types";

const labels = (dict: typeof en) => ({ ...dict.product.specLabels, units: dict.product.specUnits, upTo: dict.product.specUpTo });

describe("the six device specifications", () => {
  it("shows only the six, in order, with the owner's Arabic labels", () => {
    const specs = parseDeviceSpecs({
      device_type: { ar: "فواح للمساحات الكبيرة", en: "" },
      coverage: { ar: "حتى 500 م²", en: "Up to 500 m²" },
      screen: { ar: "شاشة LCD ومؤقت قابل للبرمجة" },
      capacity: { ar: "500 مل", en: "500 ml" },
      installation: { ar: "قائم أو معلّق على الجدار", en: "" },
      color: { ar: "زجاج أسود", en: "Black glass" },
      dimensions: { width: 20, height: 15, depth: 8, unit: "cm" },
      bogus: "ignored",
    });
    const rows = specRows(specs, "ar", labels(ar as typeof en));
    expect(rows.map((r) => r.label)).toEqual(["النوع", "التغطية", "الشاشة", "سعة العبوة", "التركيب", "اللون"]);
    expect(rows[1].value).toBe("حتى 500 م²");
  });

  it("falls back to Arabic when no English was entered, never inventing a translation", () => {
    const specs = parseDeviceSpecs({ screen: { ar: "شاشة LCD" }, capacity: { ar: "500 مل", en: "500 ml" } });
    const rows = specRows(specs, "en", labels(en));
    expect(rows).toEqual([
      { key: "screen", label: "Display", value: "شاشة LCD" },
      { key: "capacity", label: "Bottle capacity", value: "500 ml" },
    ]);
  });

  it("keeps showing values entered before (coverage in m², capacity in ml, colours)", () => {
    const specs = parseDeviceSpecs({ coverage_m2: 1000, capacity_ml: 500, colors: { ar: "أسود", en: "Black" } });
    expect(specRows(specs, "en", labels(en)).map((r) => r.value)).toEqual(["Up to 1,000 m²", "500 ml", "Black"]);
    expect(specRows(parseDeviceSpecs(null), "en", labels(en))).toEqual([]);
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

  it("accepts 0, 1 or 2 free fragrances for diffusers only", () => {
    expect(readProductDetails(form({}), "diffuser").free_fragrances).toBe("");
    expect(readProductDetails(form({ free_fragrances: "0" }), "diffuser").errors).toEqual({});
    expect(readProductDetails(form({ free_fragrances: "2" }), "diffuser").free_fragrances).toBe("2");
    expect(readProductDetails(form({ free_fragrances: "3" }), "diffuser").errors.free_fragrances).toBe("freeCount");
    expect(readProductDetails(form({ free_fragrances: "2" }), "refill").free_fragrances).toBe("");
  });

  it("needs only Arabic, and keeps specifications the editor doesn't show", () => {
    const r = readProductDetails(
      form({
        spec_coverage_ar: "حتى 500 م²",
        spec_screen_ar: "شاشة LCD",
        spec_screen_en: "LCD display",
        device_specs_keep: JSON.stringify({ dimensions: { width: 20, height: 15, depth: 8, unit: "cm" }, coverage_m2: 900, warranty: { ar: "سنة", en: "1 year" } }),
      }),
      "diffuser",
    );
    expect(r.errors).toEqual({});
    expect(r.device_specs.coverage).toEqual({ ar: "حتى 500 م²", en: "" });
    expect(r.device_specs.screen).toEqual({ ar: "شاشة LCD", en: "LCD display" });
    expect(r.device_specs.dimensions).toEqual({ width: 20, height: 15, depth: 8, unit: "cm" });
    expect(r.device_specs.warranty).toEqual({ ar: "سنة", en: "1 year" });
    // The old number is replaced by the text the owner now sees and edits.
    expect(r.device_specs.coverage_m2).toBeUndefined();
  });

  it("validates colour swatches and stock, and makes the English names optional", () => {
    const base = {
      slug: "",
      type: "diffuser",
      name_ar: "فواح",
      name_en: "",
      short_description_ar: "", short_description_en: "", description_ar: "", description_en: "",
      notes_top_ar: "", notes_top_en: "", notes_heart_ar: "", notes_heart_en: "", notes_base_ar: "", notes_base_en: "",
      specs_ar: "", specs_en: "", specs_confirmed: false, spaces: [], is_featured: false, is_new: false, position: "0",
      category_id: "", seo_title_ar: "", seo_title_en: "", seo_description_ar: "", seo_description_en: "",
      media: "[]", media_variants: "[]", scents: "[]", compatible: "[]",
    };
    const variant = { sku: "rs-black", label_ar: "أسود", label_en: "", price: "25", color_hex: "#111111", stock: "4" };
    const ok = productFormSchema.safeParse({ ...base, variants: JSON.stringify([variant]) });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.variants[0]).toMatchObject({ sku: "RS-BLACK", label_en: "أسود", price_fils: 25000, color_hex: "#111111", stock: 4 });
    expect(productFormSchema.safeParse({ ...base, variants: JSON.stringify([{ ...variant, color_hex: "red" }]) }).success).toBe(false);
    expect(productFormSchema.safeParse({ ...base, variants: JSON.stringify([{ ...variant, stock: "-1" }]) }).success).toBe(false);
  });

  it("builds a page address from the English name, or a safe one for Arabic-only names", () => {
    expect(slugFromName("Rana Diffuser Pro")).toBe("rana-diffuser-pro");
    expect(slugFromName("")).toMatch(/^product-[a-z0-9]+$/);
  });
});

describe("colour variants", () => {
  const img = (src: string) => ({ src, alt: { ar: src, en: src } });
  const product = {
    id: "p", slug: "tower", type: "diffuser", name: { ar: "برج", en: "Tower" }, tagline: { ar: "", en: "" }, description: { ar: "", en: "" },
    compatibleWith: [], spaces: [], isSample: false,
    images: [img("/images/shared.jpg")],
    variants: [
      { id: "b", sku: "T-BLACK", label: { ar: "أسود", en: "Black" }, priceFils: 25000, stock: 0, colorHex: "#111111", images: [img("/images/black.jpg")] },
      { id: "r", sku: "T-RED", label: { ar: "أحمر", en: "Red" }, priceFils: 27000, stock: 3, colorHex: "#b3261e", images: [img("/images/red-1.jpg"), img("/images/red-2.jpg")] },
      { id: "w", sku: "T-WHITE", label: { ar: "أبيض", en: "White" }, priceFils: 25000, stock: 2, colorHex: "#f5f5f0" },
    ],
  } as Product;

  it("offers a colour choice only with two or more colours", () => {
    expect(hasColorChoice(product)).toBe(true);
    expect(hasColorChoice({ ...product, variants: [product.variants[0]] })).toBe(false);
  });

  it("shows each colour's own photos, falling back to the shared photos", () => {
    expect(variantImages(product, product.variants[1]).map((i) => i.src)).toEqual(["/images/red-1.jpg", "/images/red-2.jpg"]);
    expect(variantImages(product, product.variants[2]).map((i) => i.src)).toEqual(["/images/shared.jpg"]);
  });

  it("starts on the first colour in stock", () => {
    expect(defaultVariant(product).id).toBe("r");
  });

  it("puts the chosen colour's photo, price and swatch in the cart line", () => {
    const line = toCartLine(product, product.variants[1]);
    expect(line).toMatchObject({ variantId: "r", image: "/images/red-1.jpg", unitPriceFils: 27000, colorHex: "#b3261e", variantLabel: { ar: "أحمر", en: "Red" } });
  });
});

describe("rich text", () => {
  it("parses headings (including 'Title:' lines), lists and paragraphs, keeps line breaks and never HTML", () => {
    const blocks = parseRichText("## Title\nLine one\nline two\n\nالمميزات:\n1. تشغيل من الهاتف.\n2. بلوتوث.\n- a\n<script>x</script>");
    expect(blocks).toEqual([
      { kind: "heading", text: "Title" },
      { kind: "p", text: "Line one\nline two" },
      { kind: "heading", text: "المميزات:" },
      { kind: "ol", items: ["تشغيل من الهاتف.", "بلوتوث."] },
      { kind: "ul", items: ["a"] },
      { kind: "p", text: "<script>x</script>" },
    ]);
  });
});
