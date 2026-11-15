import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { accounts, PASSWORD } from "./accounts";

// Pages that only exist with the live catalogue and accounts (local stack):
// no serious or critical WCAG 2.1 AA violations, in both languages.

for (const lang of ["ar", "en"] as const) {
  test(`${lang}: account, checkout and order pages have no serious violations`, async ({ page }) => {
    const scan = async (label: string) => {
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${v.id}: ${v.nodes[0]?.target}`), label).toEqual([]);
    };
    for (const path of ["/account/login", "/account/register", "/account/forgot-password"]) {
      await page.goto(`/${lang}${path}`);
      await scan(path);
    }
    await page.goto(`/${lang}/account/login`);
    await page.locator("#email").fill(accounts.customer);
    await page.locator("#password").fill(PASSWORD);
    await page.locator("form button[type=submit]").click();
    await page.waitForURL(new RegExp(`/${lang}/account$`));
    for (const path of ["/account", "/account/orders", "/account/addresses"]) {
      await page.goto(`/${lang}${path}`);
      await scan(path);
    }
    await page.goto(`/${lang}/products/fixture-aura`);
    await expect(async () => {
      await page.locator("main button").filter({ hasText: lang === "en" ? /add to cart/i : /أضف إلى السلة/ }).first().click();
      await expect(page.locator("dialog[open]")).toBeVisible({ timeout: 1_000 });
    }).toPass();
    await page.goto(`/${lang}/checkout`);
    await scan("/checkout");
  });
}
