import { execFileSync } from "node:child_process";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CRON_SECRET } from "../playwright.admin.config";
import { accounts, PASSWORD } from "./accounts";

// Phase 6: the simplified product editor and colour variants, from the
// owner's editor through the storefront, cart, checkout, order and admin,
// against the LOCAL stack (cash on delivery, no real payments).

let service: SupabaseClient;
const tag = Math.random().toString(36).slice(2, 7);
const slug = `e2e-colour-${tag}`;
const nameEn = `Colour Tower ${tag}`;
let productId = "";

async function staffSignIn(page: Page, email: string) {
  await page.goto("/en/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/en\/admin$/);
}

async function refresh(page: Page) {
  const res = await page.request.post("/api/revalidate", { headers: { Authorization: `Bearer ${CRON_SECRET}` } });
  expect(res.status()).toBe(200);
}

// The storage path of the photo an element shows (raw or via next/image).
async function photoPath(img: Locator) {
  const src = (await img.getAttribute("data-src")) ?? decodeURIComponent((await img.getAttribute("src")) ?? "");
  return src.match(/products\/[0-9a-f-]{36}\.\w+/)?.[0] ?? "";
}

async function hydrated(page: Page) {
  await page.waitForLoadState("networkidle");
  await expect(async () => {
    await page.getByTestId("color-choice").locator("input").first().focus();
    await expect(page.getByTestId("color-choice").locator("input").first()).toBeFocused({ timeout: 1_000 });
  }).toPass();
}

test.beforeAll(async () => {
  const raw = execFileSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const env = JSON.parse(raw.slice(raw.indexOf("{"))) as Record<string, string>;
  service = createClient(env.API_URL, env.SECRET_KEY, { auth: { persistSession: false } });
  await service.from("store_settings").update({ cod_enabled: true }).eq("id", 1);
  await service.from("shipping_zones").update({ is_active: true }).eq("name_en", "All of Kuwait");
});

test.describe.serial("colour variants", () => {
  test("the owner creates a two-colour diffuser with photos and stock per colour in one form", async ({ page }) => {
    await staffSignIn(page, accounts.owner);
    await page.goto("/en/admin/products/new");
    await page.waitForLoadState("networkidle");
    // Six numbered sections; everything technical is folded away.
    for (const heading of ["1. Basic information", "2. Price & stock", "3. Photos & colours", "4. Specifications & description", "5. Free fragrances", "6. Publishing"]) {
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
    await expect(page.getByLabel("URL slug")).toBeHidden();

    await page.getByLabel("Product name (Arabic)").fill("فواح الألوان");
    await page.getByLabel("English name (optional)").fill(nameEn);
    await page.getByLabel("Price (KWD)", { exact: true }).fill("25.000");

    await page.getByRole("button", { name: "+ Add colour" }).click();
    const cards = page.getByTestId("color-card");
    await expect(cards).toHaveCount(1);
    await cards.nth(0).getByLabel("Colour name").fill("أسود");
    await cards.nth(0).getByLabel("In English (optional)").fill("Black");
    await cards.nth(0).getByLabel("Quantity in stock").fill("4");
    await cards.nth(0).locator("input[type=file]").setInputFiles("public/images/products/rana-tower.jpg");
    await expect(cards.nth(0).getByTestId("color-photos").locator("img")).toHaveCount(1, { timeout: 20_000 });

    await page.getByRole("button", { name: "+ Add colour" }).click();
    await expect(cards).toHaveCount(2);
    await cards.nth(1).getByLabel("Colour name").fill("أحمر");
    await cards.nth(1).getByLabel("In English (optional)").fill("Red");
    await cards.nth(1).getByRole("button", { name: "#b3261e" }).click();
    await cards.nth(1).getByLabel("Quantity in stock").fill("3");
    await cards.nth(1).getByLabel("Different price for this colour (optional)").fill("27.000");
    await cards.nth(1).locator("input[type=file]").setInputFiles("public/images/products/rana-majlis.jpg");
    await expect(cards.nth(1).getByTestId("color-photos").locator("img")).toHaveCount(1, { timeout: 20_000 });

    await page.locator("#spec_device_type_ar").fill("فواح للمساحات الكبيرة");
    await page.locator("#spec_coverage_ar").fill("حتى 500 م²");
    // The colour specification follows the selected colour, so it isn't typed.
    await expect(page.locator("#spec_color_ar")).toHaveCount(0);
    await page.locator("#description_ar").fill("المميزات:\n1. تشغيل من الهاتف.\n2. مناسب للمساحات الكبيرة.");
    await page.getByText("Advanced settings").click();
    await page.getByLabel("URL slug").fill(slug);

    await page.getByRole("button", { name: "Save and publish" }).click();
    await expect(page.getByText("Product published.")).toBeVisible();
    productId = page.url().match(/products\/([0-9a-f-]{36})/)![1];

    // One product, two colour variants with their own stock and swatch.
    const { data: variants } = await service
      .from("product_variants")
      .select("label_en, color_hex, price_fils, position, inventory(on_hand)")
      .eq("product_id", productId)
      .order("position");
    expect(variants).toEqual([
      { label_en: "Black", color_hex: "#111111", price_fils: 25000, position: 0, inventory: { on_hand: 4 } },
      { label_en: "Red", color_hex: "#b3261e", price_fils: 27000, position: 1, inventory: { on_hand: 3 } },
    ]);
    const { count } = await service.from("product_media").select("media_id", { count: "exact", head: true }).eq("product_id", productId).not("variant_id", "is", null);
    expect(count).toBe(2);

    // Re-opening shows the same cards, with stock.
    await page.reload();
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(1).getByLabel("Quantity in stock")).toHaveValue("3");
  });

  test("choosing a colour switches the photo, price, stock and colour specification instantly", async ({ page }) => {
    await page.goto(`/en/products/${slug}`);
    await hydrated(page);
    const main = page.getByTestId("gallery-main");
    const choice = page.getByTestId("color-choice");
    await expect(choice.locator("label")).toHaveCount(2);
    await expect(choice).toContainText("Available colours: Black");
    const black = await photoPath(main);
    expect(black).not.toBe("");
    await expect(page.getByTestId("spec-color")).toHaveText("Black");
    await expect(page.locator("main").getByText("KWD 25.000").first()).toBeVisible();

    for (let round = 0; round < 3; round++) {
      await choice.getByText("Red").click();
      await expect(page.getByTestId("spec-color")).toHaveText("Red");
      await expect(main).not.toHaveAttribute("data-src", new RegExp(black));
      await expect(page.locator("main").getByText("KWD 27.000").first()).toBeVisible();
      await choice.getByText("Black").click();
      await expect(page.getByTestId("spec-color")).toHaveText("Black");
      await expect(main).toHaveAttribute("data-src", new RegExp(black));
    }
    // A full page navigation never happened.
    expect(page.url()).toContain(`/en/products/${slug}`);
  });

  test("the chosen colour goes through cart, checkout, order and the admin; stock moves for that colour only", async ({ page, browser }) => {
    await page.goto(`/en/products/${slug}`);
    await hydrated(page);
    await page.getByTestId("color-choice").getByText("Red").click();
    const red = await photoPath(page.getByTestId("gallery-main"));
    await page.getByRole("button", { name: "Add to cart", exact: true }).click();

    await page.goto("/en/cart");
    const line = page.locator("main").getByTestId("line-color");
    await expect(line).toHaveText("Colour: Red");
    expect(await photoPath(page.locator("main li img").first())).toBe(red);

    await page.goto("/en/checkout");
    await expect(page.locator("#checkout-summary").locator("..")).toContainText("Colour: Red");
    await page.locator("#customer_name").fill("Colour Buyer");
    await page.locator("#phone").fill("6612 3456");
    await page.locator("#governorate").selectOption("hawalli");
    await page.locator("#area").fill("Salmiya");
    await page.locator("#block").fill("10");
    await page.locator("#street").fill("Salem Al Mubarak");
    await page.locator("#building").fill("12");
    await page.getByRole("radio", { name: /cash on delivery/i }).click();
    await page.getByRole("button", { name: "Place order" }).click();
    await page.waitForURL(/\/en\/order\?/);
    await expect(page.locator("main")).toContainText("Red");
    const number = (await page.getByRole("heading", { level: 1 }).innerText()).match(/\d+/)![0];

    const { data: stock } = await service.from("product_variants").select("label_en, inventory(on_hand)").eq("product_id", productId).order("position");
    expect(stock).toEqual([
      { label_en: "Black", inventory: { on_hand: 4 } },
      { label_en: "Red", inventory: { on_hand: 2 } },
    ]);

    const staff = await browser.newPage();
    await staffSignIn(staff, accounts.support);
    await staff.goto(`/en/admin/orders?q=${number}`);
    await staff.getByRole("link", { name: new RegExp(`#${number}`) }).click();
    await expect(staff.locator("main")).toContainText("Red");
  });

  test("product cards show swatches; the chosen colour carries into the product page", async ({ page }) => {
    await refresh(page);
    await page.goto(`/en/products/${slug}`);
    await page.goto("/en/shop");
    await page.waitForLoadState("networkidle");
    const card = page.locator("article").filter({ hasText: nameEn });
    const swatches = card.getByTestId("card-swatches");
    await expect(swatches.getByRole("radio")).toHaveCount(2);
    const before = await photoPath(card.locator("img").first());
    await expect(async () => {
      await swatches.getByRole("radio", { name: "Red" }).click();
      await expect(swatches.getByRole("radio", { name: "Red" })).toHaveAttribute("aria-checked", "true", { timeout: 1_000 });
    }).toPass();
    await expect.poll(() => photoPath(card.locator("img").first())).not.toBe(before);
    await card.getByRole("link", { name: nameEn }).click();
    await page.waitForURL(/color=/);
    await expect(page.getByTestId("spec-color")).toHaveText("Red");
  });

  test("Arabic phone layout shows the colour names and fits the screen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/ar/products/${slug}`);
    await hydrated(page);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByTestId("color-choice")).toContainText("الألوان المتوفرة");
    await page.getByTestId("color-choice").getByText("أحمر").click();
    await expect(page.getByTestId("spec-color")).toHaveText("أحمر");
    await expect(page.locator("[data-spec=device_type]")).toContainText("فواح للمساحات الكبيرة");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });

  test("duplicating makes an unpublished draft with the same colours, new SKUs and no stock", async ({ page }) => {
    await staffSignIn(page, accounts.owner);
    await page.goto(`/en/admin/products/${productId}`);
    await page.getByRole("button", { name: "Duplicate product" }).click();
    await page.waitForURL(/duplicated=1/);
    await expect(page.getByText("Copy created as a draft.")).toBeVisible();
    const copyId = page.url().match(/products\/([0-9a-f-]{36})/)![1];
    expect(copyId).not.toBe(productId);

    const { data: copy } = await service.from("products").select("status, name_en").eq("id", copyId).single();
    expect(copy).toEqual({ status: "draft", name_en: `${nameEn} (copy)` });
    const { data: variants } = await service.from("product_variants").select("sku, label_en, color_hex, inventory(on_hand)").eq("product_id", copyId).order("position");
    const { data: originals } = await service.from("product_variants").select("sku").eq("product_id", productId);
    expect(variants!.map((v) => [v.label_en, v.color_hex, v.inventory])).toEqual([
      ["Black", "#111111", { on_hand: 0 }],
      ["Red", "#b3261e", { on_hand: 0 }],
    ]);
    expect(variants!.some((v) => originals!.some((o) => o.sku === v.sku))).toBe(false);
    // The previous product's page stays mounted (hidden) for back navigation.
    await expect(page.locator("[data-testid=color-card]:visible")).toHaveCount(2);
    await expect(page.locator("[data-testid=color-photos]:visible").first().locator("img")).toHaveCount(1);
  });

  test("a product without colours shows no colour controls", async ({ page }) => {
    await page.goto("/en/products/fixture-aura");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByTestId("color-choice")).toHaveCount(0);
  });
});
