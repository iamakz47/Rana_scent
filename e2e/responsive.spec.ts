import { expect, test } from "@playwright/test";

// Every key page, at every supported width, in both directions: no
// horizontal overflow, correct lang/dir, and a visible page heading.
const widths = [360, 390, 430, 768, 1024, 1440, 2560];
const locales = [
  { lang: "ar", dir: "rtl" },
  { lang: "en", dir: "ltr" },
] as const;
const pages = [
  "",
  "/shop",
  "/collections/refills",
  "/products/oud-royale",
  "/products/majlis-signature-set",
  "/cart",
  "/wishlist",
  "/about",
  "/faq",
  "/contact",
];

for (const { lang, dir } of locales) {
  for (const width of widths) {
    test(`${lang} @${width}px has no overflow on any page`, async ({ page }) => {
      // Ten full page loads per test; ultrawide WebGL is slow on CI runners.
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
      for (const path of pages) {
        await page.goto(`/${lang}${path}`);
        await expect(page.locator("html")).toHaveAttribute("dir", dir);
        await expect(page.locator("html")).toHaveAttribute("lang", lang);
        await expect(page.locator("h1").first()).toBeVisible();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${path || "/"} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
      }
    });
  }
}
