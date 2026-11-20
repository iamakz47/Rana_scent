import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CRON_SECRET } from "../playwright.admin.config";
import { accounts, PASSWORD } from "./accounts";

// Device specifications, free fragrance selection through to the order, and
// policies, against the LOCAL stack (test payments, cash on delivery).

let service: SupabaseClient;
const unique = () => Math.random().toString(36).slice(2, 8);
const AR_CAUTION = "يتم اختيار العطور مع نوعد المندوب";
const EN_CAUTION = "Fragrance selection will be confirmed with our delivery representative.";

type Fixture = { slug: string; id: string; variant: string };
let two: Fixture;
let one: Fixture;
let musk: Fixture;
let oud: Fixture;

async function makeProduct(type: "diffuser" | "refill", nameEn: string, nameAr: string, price: number, extra: Record<string, unknown> = {}) {
  const slug = `e2e-p5-${type}-${unique()}`;
  const { data: product, error } = await service
    .from("products")
    .insert({ slug, type, name_ar: nameAr, name_en: nameEn, status: "draft", ...extra })
    .select("id")
    .single();
  if (error) throw error;
  const { data: variant } = await service
    .from("product_variants")
    .insert({ product_id: product.id, sku: `RS-${slug.toUpperCase()}`, label_ar: "قياسي", label_en: "Standard", price_fils: price })
    .select("id")
    .single();
  await service.from("inventory").update({ on_hand: 200 }).eq("variant_id", variant!.id);
  await service.from("products").update({ status: "published" }).eq("id", product.id);
  return { slug, id: product.id as string, variant: variant!.id as string };
}

async function refresh(page: Page) {
  const res = await page.request.post("/api/revalidate", { headers: { Authorization: `Bearer ${CRON_SECRET}` } });
  expect(res.status()).toBe(200);
}

async function staffSignIn(page: Page, email: string) {
  await page.goto("/en/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/en\/admin$/);
}

async function openProduct(page: Page, slug: string, lang: "en" | "ar" = "en") {
  await page.goto(`/${lang}/products/${slug}`);
  // Wait for hydration before interacting.
  await expect(async () => {
    await page.locator("main select").first().focus();
    await expect(page.locator("main select").first()).toBeFocused({ timeout: 1_000 });
  }).toPass();
}

async function choose(page: Page, labels: string[]) {
  const selects = page.locator("main section[aria-label] select");
  for (const [index, label] of labels.entries()) await selects.nth(index).selectOption({ label });
}

test.beforeAll(async ({ request }) => {
  const raw = execFileSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const env = JSON.parse(raw.slice(raw.indexOf("{"))) as Record<string, string>;
  service = createClient(env.API_URL, env.SECRET_KEY, { auth: { persistSession: false } });
  await service.from("store_settings").update({ cod_enabled: true, free_fragrance_allow_duplicates: true }).eq("id", 1);
  const tag = unique();
  musk = await makeProduct("refill", `White Musk ${tag}`, `مسك أبيض ${tag}`, 4000);
  oud = await makeProduct("refill", `Royal Oud ${tag}`, `عود ملكي ${tag}`, 4000);
  two = await makeProduct("diffuser", `Plug Two ${tag}`, `بلج تو ${tag}`, 25000, {
    free_fragrances: 2,
    specs_confirmed: true,
    device_specs: {
      coverage_m2: 1000,
      capacity_ml: 500,
      dimensions: { width: 20, height: 15, depth: 8, unit: "cm" },
      control_type: { ar: "زر لمس", en: "Touch button" },
    },
    info_sections: { operation: { ar: "اضغط زر التشغيل مرة واحدة.", en: "Press the power button once." } },
  });
  one = await makeProduct("diffuser", `Plug One ${tag}`, `بلج ون ${tag}`, 18000, { free_fragrances: 1 });
  const res = await request.post("/api/revalidate", { headers: { Authorization: `Bearer ${CRON_SECRET}` } });
  expect(res.status()).toBe(200);
});

test.describe("product information", () => {
  test("structured specifications with dimensions; missing values aren't shown", async ({ page }) => {
    await page.goto(`/en/products/${two.slug}`);
    const specs = page.locator("dl").first();
    await expect(specs.locator("[data-spec=dimensions]")).toContainText("Dimensions (W × H × D)");
    await expect(specs.locator("[data-spec=dimensions]")).toContainText("20 × 15 × 8 cm");
    await expect(specs.locator("[data-spec=coverage_m2]")).toContainText("Up to 1,000 m²");
    await expect(specs.locator("[data-spec=control_type]")).toContainText("Touch button");
    await expect(specs.locator("[data-spec=weight]")).toHaveCount(0);
    await expect(specs.locator("[data-spec=noise_db]")).toHaveCount(0);
    await expect(page.getByText("Provisional specifications")).toHaveCount(0);
    // Information sections expand.
    await expect(page.getByText("How to operate")).toBeVisible();
    await expect(page.getByText("Press the power button once.")).toBeVisible();

    await page.goto(`/ar/products/${two.slug}`);
    await expect(page.locator("[data-spec=dimensions]")).toContainText("20 × 15 × 8 سم");
    await expect(page.locator("[data-spec=dimensions]")).toContainText("الأبعاد");

    // A device without specifications says they're pending.
    await page.goto(`/en/products/${one.slug}`);
    await expect(page.getByText("Technical specifications will be published once confirmed")).toBeVisible();
  });
});

test.describe("free fragrance selection", () => {
  test("two free fragrances: caution, required choices, cart, edit, checkout, order and admin", async ({ page, browser }) => {
    await openProduct(page, two.slug);
    await expect(page.getByText(EN_CAUTION)).toBeVisible();
    await expect(page.getByText("Includes 2 free fragrances")).toBeVisible();
    await expect(page.getByLabel("Your First Free Fragrance")).toBeVisible();
    await expect(page.getByLabel("Your Second Free Fragrance")).toBeVisible();
    // The caution sits above the dropdowns.
    const cautionBox = await page.getByText(EN_CAUTION).boundingBox();
    const selectBox = await page.getByLabel("Your First Free Fragrance").boundingBox();
    expect(cautionBox!.y).toBeLessThan(selectBox!.y);
    // Fragrances come from the live catalogue: no device or unrelated product.
    const options = await page.getByLabel("Your First Free Fragrance").locator("option").allInnerTexts();
    expect(options).toEqual(expect.arrayContaining([expect.stringContaining("White Musk"), expect.stringContaining("Royal Oud")]));
    expect(options.some((o) => o.includes("Plug"))).toBe(false);

    // Both choices are required.
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByText("Choose your free fragrances to continue.")).toBeVisible();
    await expect(page.locator("dialog[open]")).toHaveCount(0);

    await page.getByLabel("Your First Free Fragrance").selectOption({ label: options.find((o) => o.includes("White Musk"))! });
    await page.getByLabel("Your Second Free Fragrance").selectOption({ label: options.find((o) => o.includes("Royal Oud"))! });
    await page.getByRole("button", { name: "Increase quantity" }).first().click();
    await page.getByRole("button", { name: "Add to cart" }).click();
    const drawer = page.locator("dialog[open]");
    await expect(drawer).toContainText("Free fragrances");
    await expect(drawer).toContainText("White Musk");
    await expect(drawer).toContainText("Royal Oud");

    // Same device with a different choice is a separate line (quantity stays 2).
    await page.keyboard.press("Escape");
    await page.getByLabel("Your Second Free Fragrance").selectOption({ label: options.find((o) => o.includes("White Musk"))! });
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.locator("dialog[open]").getByTestId("line-fragrances")).toHaveCount(2);

    // Survives a refresh; editable in the cart.
    await page.goto("/en/cart");
    await page.reload();
    await expect(page.locator("main").getByTestId("line-fragrances")).toHaveCount(2);
    const second = page.locator("main li").filter({ has: page.getByTestId("line-fragrances") }).nth(1);
    await second.getByRole("button", { name: "Change" }).click();
    // The line being edited shows the only dropdowns on the cart page.
    await page.locator("main select").nth(1).selectOption({ label: options.find((o) => o.includes("Royal Oud"))! });
    await page.locator("main").getByRole("button", { name: "Save" }).click();
    // Now identical to the first line: merged into one line of 3 devices.
    await expect(page.locator("main").getByTestId("line-fragrances")).toHaveCount(1);

    // Checkout shows the choices and charges nothing for them.
    await page.goto("/en/checkout");
    await expect(page.getByTestId("summary-fragrances")).toContainText("White Musk");
    await page.locator("#customer_name").fill("Fragrance Buyer");
    await page.locator("#phone").fill("6612 3456");
    await page.locator("#governorate").selectOption("hawalli");
    await page.locator("#area").fill("Salmiya");
    await page.locator("#block").fill("10");
    await page.locator("#street").fill("Salem Al Mubarak");
    await page.locator("#building").fill("12");
    await page.getByRole("radio", { name: /cash on delivery/i }).click();
    // 4 devices × 25.000; the 8 free cartridges add nothing.
    await expect(page.locator("#checkout-summary").locator("..")).toContainText("KWD 100.000");
    await page.getByRole("button", { name: "Place order" }).click();
    await page.waitForURL(/\/en\/order\?/);

    // Confirmation lists each device's choices.
    const fragrances = page.getByTestId("order-fragrances");
    await expect(fragrances).toContainText("Device 1:");
    await expect(fragrances).toContainText("Device 4:");
    await expect(fragrances).toContainText("White Musk");
    const number = (await page.getByRole("heading", { level: 1 }).innerText()).match(/\d+/)![0];

    // Staff see them as preferences to confirm.
    const staff = await browser.newPage();
    await staffSignIn(staff, accounts.support);
    await staff.goto(`/en/admin/orders?q=${number}`);
    await staff.getByRole("link", { name: new RegExp(`#${number}`) }).click();
    await expect(staff.getByTestId("admin-fragrances")).toContainText("confirm on delivery");
    await expect(staff.getByTestId("admin-fragrances")).toContainText("Device 2:");
  });

  test("one free fragrance shows one dropdown; quick add sends you to choose", async ({ page }) => {
    await page.goto(`/en/shop?q=${encodeURIComponent(one.slug.split("-").pop()!)}`);
    await openProduct(page, one.slug);
    await expect(page.getByLabel("Your First Free Fragrance")).toBeVisible();
    await expect(page.getByLabel("Your Second Free Fragrance")).toHaveCount(0);
    await expect(page.getByText("Includes 1 free fragrance")).toBeVisible();
  });

  test("a fragrance that becomes unavailable blocks checkout until changed", async ({ page }) => {
    const tag = unique();
    const temp = await makeProduct("refill", `Temp Amber ${tag}`, `عنبر ${tag}`, 4000);
    await refresh(page);
    await openProduct(page, one.slug);
    await page.getByLabel("Your First Free Fragrance").selectOption({ label: `Temp Amber ${tag}` });
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.locator("dialog[open]")).toContainText(`Temp Amber ${tag}`);

    await service.from("products").update({ status: "draft" }).eq("id", temp.id);
    await refresh(page);
    await page.goto("/en/cart");
    await expect(page.getByText("no longer available").first()).toBeVisible();
    await page.goto("/en/checkout");
    await page.locator("#governorate").selectOption("hawalli");
    await page.locator("#area").fill("Salmiya");
    await expect(page.getByRole("alert").filter({ hasText: "no longer available" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Place order|Continue to payment/ })).toBeDisabled();
  });

  test("Arabic phone layout: exact caution wording, dropdowns and no overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openProduct(page, two.slug, "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const caution = page.getByText(AR_CAUTION, { exact: true });
    await expect(caution).toBeVisible();
    await expect(page.getByLabel("عطرك المجاني الأول")).toBeVisible();
    await expect(page.getByLabel("عطرك المجاني الثاني")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });

  test("English phone layout has no overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openProduct(page, two.slug, "en");
    await expect(page.getByText(EN_CAUTION)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
});

test.describe("admin product details", () => {
  test("the owner edits dimensions, specs, free fragrances and information; invalid input keeps what was typed", async ({ page, browser }) => {
    await staffSignIn(page, accounts.owner);
    await page.goto(`/en/admin/products/${one.id}`);
    await page.locator("#spec_dim_width").fill("12");
    await page.locator("#spec_dim_height").fill("30");
    // Depth missing: rejected, nothing lost.
    await page.locator("#spec_material_en").fill("Aluminium");
    await page.locator("#spec_material_ar").fill("ألمنيوم");
    await page.getByRole("button", { name: "Save", exact: true }).first().click();
    await expect(page.getByText("Enter width, height and depth, or leave all three empty.")).toBeVisible();
    await expect(page.locator("#spec_material_en")).toHaveValue("Aluminium");
    await page.locator("#spec_dim_depth").fill("6.5");
    await page.locator("#spec_dim_unit").selectOption("mm");
    await page.locator("#free_fragrances").selectOption("2");
    await page.locator("#info_maintenance_en").fill("Wipe with a dry cloth.");
    await page.locator("#info_maintenance_ar").fill("امسحه بقطعة قماش جافة.");
    await page.getByRole("button", { name: "Save", exact: true }).first().click();
    await expect(page.getByText("Product saved.")).toBeVisible();

    const shopper = await browser.newPage();
    await shopper.goto(`/en/products/${one.slug}`);
    await expect(shopper.locator("[data-spec=dimensions]")).toContainText("12 × 30 × 6.5 mm");
    await expect(shopper.locator("[data-spec=material]")).toContainText("Aluminium");
    await expect(shopper.getByText("Maintenance and cleaning")).toBeVisible();
    await expect(shopper.getByLabel("Your Second Free Fragrance")).toBeVisible();

    // Put the one-fragrance device back for the other tests.
    await service.from("products").update({ free_fragrances: 1 }).eq("id", one.id);
    await refresh(page);
  });
});

test.describe("policies", () => {
  test("the owner drafts, previews and publishes; visitors see only published text", async ({ page, browser }) => {
    const marker = `Audit returns ${unique()}`;
    // Start from a draft that still has an owner-approval marker (local only).
    await service
      .from("site_policies")
      .update({ draft_body_en: "Returns within [OWNER TO CONFIRM: number of] days.", published_at: null })
      .eq("key", "returns");
    await staffSignIn(page, accounts.owner);
    await page.goto("/en/admin/policies");
    await expect(page.getByText("Returns and exchanges")).toBeVisible();
    // Returns: a seeded draft (the database tests rewrite the warranty draft).
    await page.getByRole("link", { name: /Returns and exchanges/ }).click();
    await expect(page.getByText("still contains [OWNER TO CONFIRM")).toBeVisible();
    await page.locator("#body_en").fill(`## Coverage\n- ${marker}`);
    await page.locator("#body_ar").fill(`## التغطية\n- ${marker}`);
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft saved.")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Coverage" })).toBeVisible();

    const visitor = await browser.newPage();
    await visitor.goto("/en/policies/returns");
    await expect(visitor.getByText(marker)).toHaveCount(0);
    // Not published: the built-in page shows instead.
    await expect(visitor.getByText("Draft: this page's content is a placeholder")).toBeVisible();

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("Published.")).toBeVisible();
    await expect.poll(async () => {
      await visitor.goto("/en/policies/returns");
      return visitor.getByText(marker).count();
    }).toBe(1);
    await expect(visitor.getByText(/Last updated/)).toBeVisible();
    await visitor.goto("/ar/policies/returns");
    await expect(visitor.getByRole("heading", { name: "التغطية" })).toBeVisible();

    // Take it down again so the built-in behaviour returns.
    await page.reload();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Unpublish" }).click();
    await expect(page.getByText("Unpublished.")).toBeVisible();
  });

  test("other roles can't open or change policies", async ({ page }) => {
    for (const email of [accounts.manager, accounts.editor, accounts.support]) {
      await page.context().clearCookies();
      await staffSignIn(page, email);
      await page.goto("/en/admin/policies/terms");
      await expect(page, email).toHaveURL(/\/en\/admin\?denied=1/);
    }
  });

  test("the policies hub and built-in pages work without published policies", async ({ page }) => {
    await page.goto("/en/policies");
    for (const name of ["Returns and exchanges", "Refunds", "Warranty", "Delivery", "Terms and conditions", "Privacy policy"]) {
      await expect(page.locator("main").getByRole("link", { name })).toBeVisible();
    }
    expect((await page.goto("/ar/privacy"))?.status()).toBe(200);
    expect((await page.goto("/en/shipping-returns"))?.status()).toBe(200);
  });
});
