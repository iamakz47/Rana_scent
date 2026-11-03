import { expect, test, type Page } from "@playwright/test";

// Language-neutral: aria-roledescription itself is localised.
const activeSlide = (page: Page) => page.locator('.hero-slide[data-active="true"]');

test.describe("hero slider", () => {
  test("autoplays every 4 seconds and loops", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator(".hero-slide")).toHaveCount(3);
    await expect(activeSlide(page)).toHaveAttribute("aria-label", "1 of 3");
    // Keep the pointer away from the carousel so hover doesn't pause it.
    await page.mouse.move(5, 5);
    await expect(activeSlide(page)).toHaveAttribute("aria-label", "2 of 3", { timeout: 6_000 });
    await expect(activeSlide(page)).toHaveAttribute("aria-label", "3 of 3", { timeout: 6_000 });
    await expect(activeSlide(page)).toHaveAttribute("aria-label", "1 of 3", { timeout: 6_000 });
  });

  test("manual navigation: next, previous, dots and keyboard", async ({ page }) => {
    await page.goto("/en");
    const next = page.getByRole("button", { name: "Next slide" });
    const prev = page.getByRole("button", { name: "Previous slide" });
    await next.click();
    await expect(activeSlide(page)).toHaveAttribute("aria-label", "2 of 3");
    await prev.click();
    await prev.click();
    await expect(activeSlide(page)).toHaveAttribute("aria-label", "3 of 3");
    await page.getByRole("button", { name: /Go to slide 1/ }).click();
    await expect(activeSlide(page)).toHaveAttribute("aria-label", "1 of 3");
    await next.focus();
    await page.keyboard.press("ArrowRight");
    await expect(activeSlide(page)).toHaveAttribute("aria-label", "2 of 3");
  });

  test("RTL: next follows reading order and arrow keys mirror", async ({ page }) => {
    await page.goto("/ar");
    await page.getByRole("button", { name: "الشريحة التالية" }).click();
    await expect(activeSlide(page)).toHaveAttribute("aria-label", "2 من 3");
    await page.keyboard.press("ArrowLeft");
    await expect(activeSlide(page)).toHaveAttribute("aria-label", "3 من 3");
  });

  test("pauses on hover and with the pause button", async ({ page }) => {
    await page.goto("/en");
    await page.locator('[aria-roledescription="carousel"]').hover();
    await page.waitForTimeout(5_000);
    await expect(activeSlide(page)).toHaveAttribute("aria-label", "1 of 3");

    await page.getByRole("button", { name: "Pause slideshow" }).click();
    await page.mouse.move(5, 5);
    await page.waitForTimeout(5_000);
    await expect(activeSlide(page)).toHaveAttribute("aria-label", "1 of 3");
    await page.getByRole("button", { name: "Play slideshow" }).click();
    await page.mouse.move(5, 5);
    await expect(activeSlide(page)).toHaveAttribute("aria-label", "2 of 3", { timeout: 6_000 });
  });

  test("does not autoplay with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/en");
    await page.mouse.move(5, 5);
    await page.waitForTimeout(5_000);
    await expect(activeSlide(page)).toHaveAttribute("aria-label", "1 of 3");
    await expect(page.getByRole("button", { name: "Pause slideshow" })).toHaveCount(0);
    await page.getByRole("button", { name: "Next slide" }).click();
    await expect(activeSlide(page)).toHaveAttribute("aria-label", "2 of 3");
  });

  test("hidden slides are inert and not announced", async ({ page }) => {
    await page.goto("/en");
    const hidden = page.locator('.hero-slide[data-active="false"]').first();
    await expect(hidden).toHaveAttribute("aria-hidden", "true");
    await expect(hidden).toHaveAttribute("inert", "");
  });
});

test.describe("homepage order", () => {
  test("categories are the first section after the hero", async ({ page }) => {
    await page.goto("/en");
    const order = await page.evaluate(() =>
      [...document.querySelectorAll("#main > section")].slice(0, 2).map((el) => el.getAttribute("aria-roledescription") ?? el.getAttribute("aria-labelledby")),
    );
    expect(order).toEqual(["carousel", "categories-title"]);
  });

  test("category cards link to their collections", async ({ page }) => {
    for (const [lang, name, heading] of [
      ["en", "Electronic Diffusers", "Electronic Diffusers"],
      ["ar", "عبوات العطر", "عبوات العطر"],
      ["en", "Diffuser Accessories", "Diffuser Accessories"],
    ] as const) {
      await page.goto(`/${lang}`);
      await page.locator("#categories-title").scrollIntoViewIfNeeded();
      await page.getByRole("link", { name: new RegExp(name) }).first().click();
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    }
  });
});

test.describe("header", () => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    test(`stays visible while scrolling @${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/en");
      const header = page.locator("header.site-header");
      for (let step = 0; step < 30; step++) {
        await page.mouse.wheel(0, step < 20 ? 400 : -300);
        await page.waitForTimeout(60);
        const box = await header.boundingBox();
        expect(box, `step ${step}`).not.toBeNull();
        // Sticky at the top of the viewport once the announcement bar scrolls away.
        expect(box!.y, `step ${step}`).toBeGreaterThanOrEqual(0);
        expect(box!.y, `step ${step}`).toBeLessThan(60);
        await expect(header).toBeVisible();
      }
      await expect(page.getByRole("link", { name: "العربية" })).toBeVisible();
      await expect(page.getByRole("button", { name: /^Cart/ })).toBeVisible();
    });
  }

  test("is not part of the page cross-fade on navigation", async ({ page }) => {
    await page.goto("/en");
    const name = await page.locator("header.site-header").evaluate((el) => getComputedStyle(el).viewTransitionName);
    expect(name).toBe("site-header");
  });
});
