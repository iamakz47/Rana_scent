import { expect, test, type Page } from "@playwright/test";
import { accounts, PASSWORD } from "./accounts";

async function signIn(page: Page, email: string, locale: "en" | "ar" = "en", { expectSuccess = true } = {}) {
  await page.goto(`/${locale}/admin/login`);
  await page.getByLabel(locale === "en" ? "Email" : "البريد الإلكتروني").fill(email);
  await page.getByLabel(locale === "en" ? "Password" : "كلمة المرور").fill(PASSWORD);
  await page.getByRole("button", { name: locale === "en" ? "Sign in" : "تسجيل الدخول" }).click();
  if (expectSuccess) await page.waitForURL(new RegExp(`/${locale}/admin$`));
}

const unique = () => Math.random().toString(36).slice(2, 8);

test.describe("access control", () => {
  test("signed-out visitors are sent to the login page", async ({ page }) => {
    for (const path of ["/en/admin", "/en/admin/products", "/ar/admin/staff"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/login\?next=/);
    }
  });

  test("there is no public sign-up", async ({ page }) => {
    await page.goto("/en/admin/login");
    await expect(page.getByRole("link", { name: /sign up|register|create account/i })).toHaveCount(0);
    // Any other admin URL just leads back to sign-in; there is no sign-up form.
    await page.goto("/en/admin/signup");
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.locator("input[name=password]")).toHaveCount(1);
    await expect(page.locator("input[name=confirm]")).toHaveCount(0);
  });

  test("wrong passwords and non-staff accounts get the same refusal", async ({ page }) => {
    await page.goto("/en/admin/login");
    await page.getByLabel("Email").fill(accounts.owner);
    await page.getByLabel("Password").fill("Wrong-Password-1");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText(/incorrect, or this account has no admin access/)).toBeVisible();

    await signIn(page, accounts.customer, "en", { expectSuccess: false });
    await expect(page.getByText(/incorrect, or this account has no admin access/)).toBeVisible();
    await page.goto("/en/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("editors don't see or reach owner-only sections", async ({ page }) => {
    await signIn(page, accounts.editor);
    await expect(page).toHaveURL(/\/en\/admin$/);
    const nav = page.getByRole("navigation", { name: "Admin navigation" }).first();
    await expect(nav.getByRole("link", { name: "Products" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Staff" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Settings" })).toHaveCount(0);
    await page.goto("/en/admin/staff");
    await expect(page).toHaveURL(/\/en\/admin\?denied=1/);
    await expect(page.getByText("Your role doesn't include that section.")).toBeVisible();
  });

  test("sign out ends the session", async ({ page }) => {
    await signIn(page, accounts.owner);
    await page.getByRole("button", { name: "Sign out" }).first().click();
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.goto("/en/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});

test.describe("catalog management", () => {
  test("an editor creates a draft that only a publisher can publish; then it appears in the store", async ({ page, browser }) => {
    const slug = `e2e-${unique()}`;
    await signIn(page, accounts.editor);
    await page.goto("/en/admin/products/new");
    await page.getByLabel("Name (Arabic)", { exact: true }).fill("فواح تجريبي");
    await page.getByLabel("Name (English)", { exact: true }).fill("E2E Diffuser");
    await page.getByLabel("URL slug").fill(slug);
    await page.getByLabel("SKU").fill(`RS-E2E-${unique().toUpperCase()}`);
    await page.getByLabel("Option label (Arabic)").fill("أسود");
    await page.getByLabel("Option label (English)").fill("Black");
    await page.getByLabel("Price (KWD)", { exact: true }).fill("24.750");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText("Product created as a draft.")).toBeVisible();
    await expect(page.getByText("Publishing needs a Manager, Admin or Owner.")).toBeVisible();
    const editUrl = page.url();

    // Drafts are invisible to shoppers.
    const shopper = await browser.newPage();
    expect((await shopper.goto(`/en/products/${slug}`))?.status()).toBe(404);

    const manager = await browser.newPage();
    await signIn(manager, accounts.manager);
    await manager.goto(editUrl);
    await manager.getByRole("button", { name: "Publish" }).click();
    await expect(manager.getByText("Product published.")).toBeVisible();

    await shopper.goto(`/en/products/${slug}`);
    await expect(shopper.getByRole("heading", { level: 1, name: "E2E Diffuser" })).toBeVisible();
    await expect(shopper.getByText("24.750").first()).toBeVisible();
    await shopper.goto(`/ar/products/${slug}`);
    await expect(shopper.getByRole("heading", { level: 1, name: "فواح تجريبي" })).toBeVisible();
    await expect(shopper.locator("html")).toHaveAttribute("dir", "rtl");
  });

  test("prices must be valid KWD amounts", async ({ page }) => {
    await signIn(page, accounts.editor);
    await page.goto("/en/admin/products/new");
    await page.getByLabel("Name (Arabic)", { exact: true }).fill("اختبار");
    await page.getByLabel("Name (English)", { exact: true }).fill("Bad price");
    await page.getByLabel("URL slug").fill(`e2e-bad-${unique()}`);
    await page.getByLabel("SKU").fill(`RS-BAD-${unique().toUpperCase()}`);
    await page.getByLabel("Option label (Arabic)").fill("قياسي");
    await page.getByLabel("Option label (English)").fill("Standard");
    await page.getByLabel("Price (KWD)", { exact: true }).fill("12.3456");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Nothing was changed" })).toBeVisible();
  });

  test("categories can be created and edited", async ({ page }) => {
    const id = unique();
    const slug = `e2e-cat-${id}`;
    await signIn(page, accounts.editor);
    await page.goto("/en/admin/categories/new");
    await expect(page.getByRole("heading", { level: 1, name: "New category" })).toBeVisible();
    await page.getByLabel("Name (Arabic)", { exact: true }).fill("فئة تجريبية");
    await page.getByLabel("Name (English)", { exact: true }).fill(`E2E Category ${id}`);
    await page.getByLabel("URL slug").fill(slug);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page).toHaveURL(/\/en\/admin\/categories$/);
    await page.getByRole("link", { name: new RegExp(`E2E Category ${id}`) }).click();
    await expect(page.getByRole("heading", { level: 1, name: `E2E Category ${id}` })).toBeVisible();
    await page.getByRole("textbox", { name: "Name (English)", exact: true }).fill(`E2E Category ${id} renamed`);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Category saved.")).toBeVisible();
  });
});

test.describe("homepage and media", () => {
  test("the slider interval is validated and saved", async ({ page }) => {
    await signIn(page, accounts.editor);
    await page.goto("/en/admin/homepage");
    const interval = page.getByLabel("Seconds per slide");
    await expect(interval).toHaveValue("4");
    // Bypass the browser's own min/max to prove the server rejects it too.
    await interval.evaluate((el: HTMLInputElement) => {
      el.removeAttribute("min");
      el.removeAttribute("max");
    });
    await interval.fill("1");
    await page.getByRole("button", { name: "Save", exact: true }).first().click();
    await expect(page.getByRole("alert").filter({ hasText: "Between 2 and 30 seconds" })).toBeVisible();

    await interval.fill("6");
    await page.getByRole("button", { name: "Save", exact: true }).first().click();
    await expect(page.getByText("Slider settings saved.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Seconds per slide")).toHaveValue("6");
  });

  test("a new draft slide stays off the storefront until published", async ({ page, browser }) => {
    const title = `E2E slide ${unique()}`;
    await signIn(page, accounts.editor);
    await page.goto("/en/admin/homepage/slides/new");
    await page.getByLabel("Title (Arabic)", { exact: true }).fill("شريحة تجريبية");
    await page.getByLabel("Title (English)", { exact: true }).fill(title);
    await page.getByLabel("Label (Arabic)", { exact: true }).first().fill("تسوّق");
    await page.getByLabel("Label (English)", { exact: true }).first().fill("Shop");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText("Slide saved.")).toBeVisible();
    await expect(page.getByText(title).first()).toBeVisible();

    const shopper = await browser.newPage();
    await shopper.goto("/en");
    await expect(shopper.getByText(title)).toHaveCount(0);
  });

  test("images upload to the media library", async ({ page }) => {
    await signIn(page, accounts.editor);
    await page.goto("/en/admin/media");
    const before = await page.locator("main ul > li img").count();
    await page.locator("#media-upload").setInputFiles("public/images/products/rana-mini.jpg");
    await expect(page.getByText(/rana-mini\.jpg: Uploaded\./)).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("main ul > li img")).toHaveCount(before + 1);
  });
});

test.describe("inventory", () => {
  test("managers adjust stock with a reason; stock never goes negative", async ({ page }) => {
    await signIn(page, accounts.manager);
    await page.goto("/en/admin/inventory");
    const sku = (await page.locator("main ul > li").first().locator("[dir=ltr]").first().innerText()).trim();
    const row = page.locator("main ul > li", { hasText: sku });
    await row.getByRole("button", { name: "Adjust" }).click();
    await row.getByLabel("Change").fill("5");
    await row.getByLabel("Reason").selectOption("restock");
    await row.getByLabel("Note").fill("E2E delivery");
    await row.getByRole("button", { name: "Save" }).first().click();
    await expect(page.getByRole("status").filter({ hasText: "Stock updated." })).toBeVisible();

    await row.getByLabel("Change").fill("-100000");
    await row.getByRole("button", { name: "Save" }).first().click();
    await expect(page.getByRole("alert").filter({ hasText: "Stock cannot go below zero." })).toBeVisible();
    await page.reload();
    await expect(page.getByText("E2E delivery").first()).toBeVisible();
  });
});

test.describe("languages and layout", () => {
  test("the Arabic admin is right-to-left", async ({ page }) => {
    await signIn(page, accounts.owner, "ar");
    await expect(page).toHaveURL(/\/ar\/admin$/);
    await expect(page.locator("[dir=rtl]").first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "المنتجات" }).first()).toBeVisible();
  });

  test("phones get a menu drawer and no horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, accounts.owner);
    await page.getByRole("button", { name: "Open admin menu" }).click();
    const drawer = page.locator("#admin-mobile-nav");
    await expect(drawer).toBeVisible();
    await drawer.getByRole("link", { name: "Inventory" }).click();
    await expect(page).toHaveURL(/\/en\/admin\/inventory/);
    for (const path of ["/en/admin", "/en/admin/products", "/en/admin/homepage", "/en/admin/staff"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(1);
    }
  });
});
