import { expect, test } from "@playwright/test";

test.describe("routing", () => {
  test("redirects to Arabic by default and English for English browsers", async ({ browser }) => {
    const arabic = await browser.newContext({ locale: "ar-KW" });
    const ar = await arabic.newPage();
    await ar.goto("/");
    await expect(ar).toHaveURL(/\/ar$/);
    await arabic.close();

    const english = await browser.newContext({ locale: "en-US" });
    const en = await english.newPage();
    await en.goto("/shop");
    await expect(en).toHaveURL(/\/en\/shop$/);
    await english.close();
  });

  test("language switcher keeps the current page", async ({ page }) => {
    await page.goto("/en/products/oud-royale");
    await page.getByRole("link", { name: "العربية" }).first().click();
    await expect(page).toHaveURL(/\/ar\/products\/oud-royale$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });

  test("unknown pages render the branded 404", async ({ page }) => {
    const response = await page.goto("/en/does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "This page drifted away" })).toBeVisible();
  });

  test("sends security headers", async ({ request }) => {
    const response = await request.get("/en");
    const headers = response.headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("keeps search engines out until launch", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(await robots.text()).toContain("Disallow: /");
  });
});

test.describe("cart", () => {
  test("adds a variant, updates quantity and persists across reloads", async ({ page }) => {
    await page.goto("/en/products/oud-royale");
    await page.getByText("Twin pack").click();
    await page.getByRole("button", { name: "Add to cart", exact: true }).click();

    const drawer = page.getByRole("dialog", { name: /Your cart/ });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("Oud Royale")).toBeVisible();
    await expect(drawer.getByText("Twin pack")).toBeVisible();
    await expect(drawer.getByText("KWD 27.500").first()).toBeVisible();

    await drawer.getByRole("button", { name: "Increase quantity" }).click();
    await expect(drawer.getByText("KWD 55.000").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();

    await page.goto("/en/cart");
    await expect(page.getByText("KWD 55.000").first()).toBeVisible();
    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.locator("#main").getByText("Your cart is empty")).toBeVisible();
  });

  test("sold-out variants cannot be added", async ({ page }) => {
    await page.goto("/en/products/rana-drive");
    await page.getByText("Gold").click();
    await expect(page.getByRole("button", { name: "Out of stock" })).toBeDisabled();
  });
});

test.describe("catalog", () => {
  test("filters and search update the URL and results", async ({ page }) => {
    await page.goto("/en/shop");
    await page.getByRole("button", { name: "Floral" }).click();
    await expect(page).toHaveURL(/family=floral/);
    await expect(page.getByRole("heading", { name: "White Jasmine" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Oud Royale" })).toHaveCount(0);

    await page.getByRole("searchbox").fill("zzzz-no-match");
    await expect(page.getByText("No products match these filters")).toBeVisible();
  });

  test("wishlist keeps saved products", async ({ page }) => {
    await page.goto("/en/products/cedar-smoke");
    await page.getByRole("button", { name: "Add to wishlist" }).first().click();
    await page.goto("/en/wishlist");
    await expect(page.getByRole("heading", { name: "Cedar Smoke" })).toBeVisible();
  });
});

test.describe("mobile navigation", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("opens, navigates and closes with Escape", async ({ page }) => {
    await page.goto("/ar");
    await page.getByRole("button", { name: "فتح القائمة" }).click();
    const menu = page.getByRole("dialog");
    await expect(menu.getByRole("link", { name: "الأسئلة الشائعة" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();

    await page.getByRole("button", { name: "فتح القائمة" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "قصتنا" }).click();
    await expect(page).toHaveURL(/\/ar\/about$/);
    await expect(page.getByRole("dialog")).toBeHidden();
  });
});
