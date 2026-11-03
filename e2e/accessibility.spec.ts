import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const pages = ["", "/shop", "/products/oud-royale", "/cart", "/faq", "/contact"];

for (const lang of ["ar", "en"]) {
  for (const width of [390, 1440]) {
    test(`${lang} @${width}px has no serious accessibility violations`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      for (const path of pages) {
        await page.goto(`/${lang}${path}`);
        await page.waitForLoadState("networkidle");
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
        const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        expect(
          serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`),
          `${lang}${path}`,
        ).toEqual([]);
      }
    });
  }
}
