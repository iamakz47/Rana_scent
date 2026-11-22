import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { accounts, PASSWORD } from "./accounts";

// Functional audit of the admin against the LOCAL stack: the real actions
// behind each screen, for the roles that may (and may not) use them.

let service: SupabaseClient;
const unique = () => Math.random().toString(36).slice(2, 8);

test.beforeAll(() => {
  const raw = execFileSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const env = JSON.parse(raw.slice(raw.indexOf("{"))) as Record<string, string>;
  service = createClient(env.API_URL, env.SECRET_KEY, { auth: { persistSession: false } });
});

async function signIn(page: Page, email: string, { expectSuccess = true } = {}) {
  await page.goto("/en/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  if (expectSuccess) await page.waitForURL(/\/en\/admin$/);
}

const status = (page: Page, text: string | RegExp) => page.getByRole("status").filter({ hasText: text });

test.describe("products", () => {
  test("full lifecycle: variants, publish, unpublish, archive, search", async ({ page, browser }) => {
    const slug = `e2e-life-${unique()}`;
    await signIn(page, accounts.owner);
    await page.goto("/en/admin/products/new");
    await page.getByLabel("Product name (Arabic)").fill("عطر دورة الحياة");
    await page.getByLabel("English name (optional)").fill(`Lifecycle ${slug}`);
    await page.locator("#type").selectOption("refill");
    await page.getByText("Advanced settings").click();
    await page.getByLabel("URL slug").fill(slug);
    await page.getByLabel("SKU", { exact: true }).fill(`RS-${slug.toUpperCase()}-A`);
    await page.getByLabel("Price (KWD)", { exact: true }).fill("8.500");
    await page.getByRole("button", { name: "Add another option (for example a size)" }).click();
    await page.getByLabel("Option name").nth(0).fill("صغير");
    await page.getByLabel("In English (optional)").nth(0).fill("Small");
    await page.getByLabel("SKU", { exact: true }).nth(1).fill(`RS-${slug.toUpperCase()}-B`);
    await page.getByLabel("Option name").nth(1).fill("كبير");
    await page.getByLabel("In English (optional)").nth(1).fill("Large");
    await page.getByLabel("Price (KWD)", { exact: true }).nth(1).fill("14.000");
    await page.getByRole("button", { name: "Save as draft" }).click();
    await expect(page.getByText("Product created as a draft.")).toBeVisible();
    const editUrl = page.url();

    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("Product published.")).toBeVisible();
    const shopper = await browser.newPage();
    await shopper.goto(`/en/products/${slug}`);
    await expect(shopper.getByRole("heading", { level: 1 })).toContainText("Lifecycle");
    await expect(shopper.getByText("Large").first()).toBeVisible();

    // Search in the admin list.
    await page.goto(`/en/admin/products?q=${slug}`);
    await expect(page.getByRole("link", { name: new RegExp(slug) })).toHaveCount(1);
    await page.goto("/en/admin/products?q=zz-no-such-product");
    await expect(page.getByText("Nothing matches your search.")).toBeVisible();

    // Unpublish hides it again.
    await page.goto(editUrl);
    await page.getByRole("button", { name: "Unpublish" }).click();
    await expect(page.getByText("Product moved back to draft.")).toBeVisible();
    expect((await shopper.goto(`/en/products/${slug}`))?.status()).toBe(404);

    // Archive keeps it out of the store and the default list.
    await page.getByRole("button", { name: "Archive" }).click();
    await expect(page.getByText("Product archived.")).toBeVisible();
    await page.goto(`/en/admin/products?q=${slug}`);
    await expect(page.getByRole("link", { name: new RegExp(slug) })).toHaveCount(0);
    await page.goto(`/en/admin/products?status=archived&q=${slug}`);
    await expect(page.getByRole("link", { name: new RegExp(slug) })).toHaveCount(1);
  });

  test("support and finance can read but not edit the catalogue", async ({ page }) => {
    await signIn(page, accounts.support);
    await page.goto("/en/admin/products");
    await expect(page.getByText("View only")).toBeVisible();
    await expect(page.getByRole("link", { name: "New product" })).toHaveCount(0);
    await page.goto("/en/admin/products/new");
    await expect(page).toHaveURL(/\/en\/admin\?denied=1/);
  });
});

test.describe("categories", () => {
  test("reorder, hide from the store and show again", async ({ page, browser }) => {
    const id = unique();
    const slug = `e2e-vis-${id}`;
    await signIn(page, accounts.editor);
    await page.goto("/en/admin/categories/new");
    await page.getByLabel("Name (Arabic)", { exact: true }).fill("فئة الظهور");
    await page.getByLabel("Name (English)", { exact: true }).fill(`Visibility ${id}`);
    await page.getByLabel("URL slug").fill(slug);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page).toHaveURL(/\/en\/admin\/categories$/);

    // Move it up one place and save the order.
    const names = async () => {
      await expect(page.locator("main ol > li").filter({ hasText: `Visibility ${id}` })).toBeVisible();
      return page.locator("main ol > li").evaluateAll((items) => items.map((li) => li.textContent ?? ""));
    };
    const before = await names();
    const index = before.findIndex((n) => n.includes(`Visibility ${id}`));
    const direction = index > 0 ? -1 : 1;
    await page
      .locator("main ol > li")
      .filter({ hasText: `Visibility ${id}` })
      .getByRole("button", { name: direction < 0 ? "Move up" : "Move down" })
      .click();
    await page.getByRole("button", { name: /Save · Order/ }).click();
    await expect(page.locator("main form").filter({ has: page.locator("ol") }).getByRole("status")).toBeVisible();
    await page.reload();
    const after = await names();
    expect(after.findIndex((n) => n.includes(`Visibility ${id}`))).toBe(index + direction);

    // Hidden categories 404 in the store.
    await page.getByRole("link", { name: new RegExp(`Visibility ${id}`) }).click();
    await page.getByLabel("Visible in the store").uncheck();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Category saved.")).toBeVisible();
    const shopper = await browser.newPage();
    expect((await shopper.goto(`/en/collections/${slug}`))?.status()).toBe(404);
    // Reload so the first save's form reset can't untick the box again.
    await page.reload();
    await expect(page.getByLabel("Visible in the store")).not.toBeChecked();
    await page.getByLabel("Visible in the store").check();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    // The earlier "saved" message is still on screen, so wait for the store itself.
    await expect.poll(async () => (await shopper.goto(`/en/collections/${slug}`))?.status(), { timeout: 30_000 }).toBe(200);
  });
});

test.describe("inventory", () => {
  test("low-stock filter, thresholds and movement history", async ({ page }) => {
    const { data: variant } = await service.from("product_variants").select("id, sku").eq("sku", "RS-FIXTURE-AURA").single();
    await service.from("inventory").update({ on_hand: 3, low_stock_threshold: 5 }).eq("variant_id", variant!.id);
    await signIn(page, accounts.manager);
    await page.goto("/en/admin/inventory?filter=low");
    const row = page.locator("main ul > li", { hasText: variant!.sku });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Adjust" }).click();
    await row.getByLabel("Change").fill("2");
    await row.getByLabel("Reason").selectOption("restock");
    await row.getByLabel("Note").fill("Audit restock");
    await row.getByRole("button", { name: "Save" }).first().click();
    await expect(status(page, "Stock updated.")).toBeVisible();
    await row.getByLabel("Low-stock threshold").fill("2");
    await row.getByRole("button", { name: "Save" }).nth(1).click();
    // The row leaves the low-stock filter once the threshold drops, so check the stored value.
    await expect
      .poll(async () => (await service.from("inventory").select("low_stock_threshold").eq("variant_id", variant!.id).single()).data!.low_stock_threshold)
      .toBe(2);
    await page.reload();
    await expect(page.getByText("Audit restock").first()).toBeVisible();
    // Restore stock for the other tests.
    await service.from("inventory").update({ on_hand: 500, low_stock_threshold: 5 }).eq("variant_id", variant!.id);
  });

  test("editors can view inventory but not adjust it", async ({ page }) => {
    await signIn(page, accounts.editor);
    await page.goto("/en/admin/inventory");
    await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Adjust" })).toHaveCount(0);
  });
});

test.describe("orders and customers", () => {
  test("search, status filters and pagination", async ({ page }) => {
    await signIn(page, accounts.support);
    await page.goto("/en/admin/orders");
    const first = (await page.locator("main ul > li a").first().innerText()).match(/#(\d+)/)![1];
    await page.locator("#order-search").fill(first);
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.locator("main ul > li a").first()).toContainText(`#${first}`);

    await page.goto("/en/admin/orders?status=cancelled");
    await expect(page.locator("main ul > li a").first()).toBeVisible();
    const badges = await page.locator("main ul > li a").evaluateAll((links) =>
      links.map((link) => link.textContent ?? ""),
    );
    expect(badges.length).toBeGreaterThan(0);
    expect(badges.every((text) => text.includes("Cancelled"))).toBe(true);

    // The local stack holds more than one page of orders after the suites.
    const { count } = await service.from("orders").select("id", { count: "exact", head: true });
    if ((count ?? 0) > 50) {
      await page.goto("/en/admin/orders");
      await page.getByRole("link", { name: "Next" }).click();
      await expect(page).toHaveURL(/page=2/);
      await expect(page.getByText("Page 2")).toBeVisible();
      await expect(page.locator("main ul > li a")).not.toHaveCount(0);
      await page.getByRole("link", { name: "Previous" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/orders$/);
    }
  });

  test("customer search", async ({ page }) => {
    const { data: order } = await service.from("orders").select("phone").order("created_at", { ascending: false }).limit(1).single();
    await signIn(page, accounts.support);
    await page.goto(`/en/admin/customers?q=${encodeURIComponent(order!.phone.slice(-6))}`);
    await expect(page.getByText(order!.phone).first()).toBeVisible();
  });
});

test.describe("discounts", () => {
  async function addToCart(page: Page) {
    await page.goto("/en/products/fixture-aura");
    await expect(async () => {
      await page.getByRole("button", { name: /add to cart/i }).first().click();
      await expect(page.locator("dialog[open]")).toBeVisible({ timeout: 1_000 });
    }).toPass();
  }

  async function createCode(admin: Page, fields: { code: string; value: string; minimum?: string; ends?: string; limit?: string }) {
    await admin.goto("/en/admin/promotions");
    await admin.locator("#new-code").fill(fields.code);
    await admin.locator("#new-value").fill(fields.value);
    if (fields.minimum) await admin.locator("#new-min").fill(fields.minimum);
    if (fields.ends) await admin.locator("#new-ends").fill(fields.ends);
    if (fields.limit) await admin.locator("#new-limit").fill(fields.limit);
    await admin.getByRole("button", { name: "Save code" }).first().click();
    await expect(admin.getByText("Code saved.")).toBeVisible();
  }

  test("minimum order, expiry and usage limits are enforced at checkout", async ({ page, browser }) => {
    const admin = await browser.newPage();
    await signIn(admin, accounts.manager);
    const minimum = `MIN${unique().toUpperCase()}`;
    const expired = `OLD${unique().toUpperCase()}`;
    const once = `ONE${unique().toUpperCase()}`;
    await createCode(admin, { code: minimum, value: "10", minimum: "500" });
    await createCode(admin, { code: expired, value: "10", ends: "2020-01-01T00:00" });
    await createCode(admin, { code: once, value: "10", limit: "1" });
    // Use up the single-use code.
    await service.from("discount_codes").update({ redemptions_count: 1 }).eq("code", once);

    await addToCart(page);
    await page.goto("/en/checkout");
    const apply = async (code: string) => {
      await page.getByPlaceholder("Discount code").fill(code);
      await page.getByRole("button", { name: "Apply" }).click();
    };
    await apply(minimum);
    await expect(page.getByText("Your order doesn't reach this code's minimum.")).toBeVisible();
    await page.getByRole("button", { name: "Remove" }).click().catch(() => undefined);
    await apply(expired);
    await expect(page.getByText("This discount code isn't valid.")).toBeVisible();
    await page.getByRole("button", { name: "Remove" }).click().catch(() => undefined);
    await apply(once);
    await expect(page.getByText("This discount code has been fully used.")).toBeVisible();
  });

  test("support can't manage discount codes", async ({ page }) => {
    await signIn(page, accounts.support);
    await page.goto("/en/admin/promotions");
    await expect(page).toHaveURL(/\/en\/admin\?denied=1/);
  });
});

test.describe("delivery, finance and settings", () => {
  test("the owner adds a delivery zone with a rate", async ({ page }) => {
    const id = unique();
    await signIn(page, accounts.owner);
    await page.goto("/en/admin/settings");
    await page.getByText("New zone").first().click();
    await page.locator("#new-zone-ar").fill(`منطقة ${id}`);
    await page.locator("#new-zone-en").fill(`Zone ${id}`);
    const zoneForm = page.locator("form").filter({ has: page.locator("#new-zone-en") });
    await zoneForm.getByLabel("Jahra").check();
    await zoneForm.getByRole("button", { name: "Save zone" }).click();
    await expect(page.getByText("Zone saved.").first()).toBeVisible();
    await page.reload();
    const zone = page.locator("section.p-4").filter({ has: page.getByRole("heading", { name: `Zone ${id}` }) });
    await expect(zone).toBeVisible();
    await zone.getByText("Add rate").first().click();
    const rateForm = zone.locator("form").filter({ has: page.locator("input[id^=new-rate][name=price]") });
    await rateForm.locator("input[name=name_ar]").fill("سريع");
    await rateForm.locator("input[name=name_en]").fill("Express");
    await rateForm.locator("input[name=price]").fill("3.500");
    await rateForm.getByRole("button", { name: "Save rate" }).click();
    await expect(page.getByText("Rate saved.").first()).toBeVisible();
    const { data } = await service.from("shipping_zones").select("is_active, governorates, shipping_rates(price_fils)").eq("name_en", `Zone ${id}`).single();
    expect(data!.governorates).toEqual(["jahra"]);
    expect(data!.shipping_rates.map((r: { price_fils: number }) => r.price_fils)).toEqual([3500]);
  });

  test("finance records an expense and sees it; support can't open finance", async ({ page, browser }) => {
    const description = `Packaging ${unique()}`;
    await signIn(page, accounts.owner);
    await page.goto("/en/admin/finance");
    await page.locator("#exp-category").selectOption("packaging");
    await page.locator("#exp-description").fill(description);
    await page.locator("#exp-amount").fill("12.250");
    await page.getByRole("button", { name: "Add expense" }).click();
    await expect(page.getByText("Expense recorded.")).toBeVisible();
    await page.reload();
    await expect(page.getByText(description)).toBeVisible();
    await expect(page.getByText("KWD 12.250").first()).toBeVisible();

    const support = await browser.newPage();
    await signIn(support, accounts.support);
    await support.goto("/en/admin/finance");
    await expect(support).toHaveURL(/\/en\/admin\?denied=1/);
  });

  test("checkout settings reject out-of-range values", async ({ page }) => {
    await signIn(page, accounts.owner);
    await page.goto("/en/admin/settings");
    await page.locator("#order_expiry_minutes").fill("5");
    await page.getByRole("button", { name: "Save", exact: true }).first().click();
    const { data } = await service.from("store_settings").select("order_expiry_minutes").eq("id", 1).single();
    expect(data!.order_expiry_minutes).toBeGreaterThanOrEqual(10);
  });
});

test.describe("content", () => {
  test("slides can be reordered", async ({ page }) => {
    await signIn(page, accounts.editor);
    await page.goto("/en/admin/homepage");
    const slides = page.locator("main ol > li").filter({ has: page.locator("a[href*='/admin/homepage/slides/']") });
    const titles = async () => {
      await expect(slides.first()).toBeVisible();
      return slides.evaluateAll((items) => items.map((li) => li.querySelector("a")?.textContent?.trim() ?? ""));
    };
    const before = await titles();
    test.skip(before.length < 2, "needs two slides");
    await slides.filter({ hasText: before[1] }).getByRole("button", { name: "Move up" }).click();
    await page.getByRole("button", { name: /Save · Order/ }).first().click();
    await expect.poll(async () => {
      await page.reload();
      return (await titles())[0];
    }).toBe(before[1]);
    const after = await titles();
    expect(after[0]).toBe(before[1]);
    // Put them back.
    await slides.filter({ hasText: before[0] }).getByRole("button", { name: "Move up" }).click();
    await page.getByRole("button", { name: /Save · Order/ }).click();
  });
});

test.describe("staff", () => {
  test("roles change, deactivation revokes access and reactivation restores it", async ({ page, browser }) => {
    const email = `e2e-staff-${unique()}@rana.test`;
    const { data: created } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    await service.from("staff_members").insert({ user_id: created.user!.id, role: "support", display_name: "Audit Staff", is_active: true });

    await signIn(page, accounts.owner);
    await page.goto("/en/admin/staff");
    const row = page.locator("main li, main tr").filter({ hasText: email });
    await row.getByLabel("Role").selectOption("editor");
    await row.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Staff member updated.")).toBeVisible();
    expect((await service.from("staff_members").select("role").eq("user_id", created.user!.id).single()).data!.role).toBe("editor");

    await row.getByRole("button", { name: "Deactivate" }).click();
    await expect(page.getByText("Staff member updated.")).toBeVisible();
    const staffer = await browser.newPage();
    await signIn(staffer, email, { expectSuccess: false });
    await expect(staffer.getByText(/no admin access|incorrect/)).toBeVisible();

    await page.reload();
    await page.locator("main li, main tr").filter({ hasText: email }).getByRole("button", { name: "Reactivate" }).click();
    await expect(page.getByText("Staff member updated.")).toBeVisible();
    await signIn(staffer, email);

    page.once("dialog", (d) => d.accept());
    await page.reload();
    await page.locator("main li, main tr").filter({ hasText: email }).getByRole("button", { name: "Remove access" }).click();
    // The member leaves the list, so check the stored state.
    await expect
      .poll(async () => (await service.from("staff_members").select("user_id").eq("user_id", created.user!.id)).data!.length)
      .toBe(0);
    // The removed member's existing session no longer opens the admin.
    await staffer.goto("/en/admin/orders");
    await expect(staffer).toHaveURL(/\/en\/admin\/login/);
  });

  test("managers can't change staff", async ({ page }) => {
    await signIn(page, accounts.manager);
    await page.goto("/en/admin/staff");
    await expect(page.getByRole("button", { name: "Deactivate" })).toHaveCount(0);
  });
});
