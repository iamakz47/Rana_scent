import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

// Offers (bundles) only ever come from the live Supabase catalogue
// (features/offers/data.ts returns [] against the Phase 1 sample catalog),
// so this suite needs CATALOG_SOURCE=supabase against the LOCAL Supabase
// stack, the same requirement e2e-admin's global-setup.ts enforces. When
// that stack isn't reachable (e.g. the plain `npm run test:e2e` run against
// the sample-data build) the whole file skips cleanly instead of failing.
let supabase: SupabaseClient | null = null;
try {
  const raw = execFileSync("npx", ["supabase", "status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const env = JSON.parse(raw.slice(raw.indexOf("{"))) as Record<string, string>;
  if (/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(env.API_URL ?? "")) {
    supabase = createClient(env.API_URL, env.SECRET_KEY, { auth: { persistSession: false } });
  }
} catch {
  // No local Supabase stack running; tests below are skipped.
}

const BUNDLE_SLUG = "e2e-offer-bundle";
const DIFFUSER_SLUG = "e2e-offer-diffuser";
const ACCESSORY_SLUG = "e2e-offer-accessory";
const REFILL_SLUG = "e2e-offer-fragrance";

type Seeded = { bundleId: string; diffuserId: string; accessoryId: string; refillId: string };

async function seedOffer(db: SupabaseClient): Promise<Seeded> {
  // Clean up a previous run's leftovers first (bundle before its items: the
  // items are referenced with ON DELETE RESTRICT).
  await removeOffer(db);

  // A refill, published and eligible, so the diffuser's free-fragrance
  // picker has something to choose from.
  const { data: refill, error: refillError } = await db
    .from("products")
    .insert({
      slug: REFILL_SLUG,
      type: "refill",
      status: "draft",
      name_ar: "عطر اختبار العروض",
      name_en: "E2E Offer Fragrance",
    })
    .select("id")
    .single();
  if (refillError) throw refillError;
  const { data: refillVariant, error: refillVariantError } = await db
    .from("product_variants")
    .insert({ product_id: refill.id, sku: "RS-E2E-OFFER-REFILL", label_ar: "علبة", label_en: "Bottle", price_fils: 6000 })
    .select("id")
    .single();
  if (refillVariantError) throw refillVariantError;
  await db.from("inventory").update({ on_hand: 50 }).eq("variant_id", refillVariant.id);
  await db.from("products").update({ status: "published" }).eq("id", refill.id);

  // A diffuser with two colour choices and one free fragrance cartridge:
  // the offer's choosable, free-fragrance item.
  const { data: diffuser, error: diffuserError } = await db
    .from("products")
    .insert({
      slug: DIFFUSER_SLUG,
      type: "diffuser",
      status: "draft",
      name_ar: "فواح اختبار العروض",
      name_en: "E2E Offer Diffuser",
      free_fragrances: 1,
    })
    .select("id")
    .single();
  if (diffuserError) throw diffuserError;
  const { data: diffuserVariants, error: diffuserVariantsError } = await db
    .from("product_variants")
    .insert([
      { product_id: diffuser.id, sku: "RS-E2E-OFFER-GOLD", label_ar: "ذهبي", label_en: "Gold", price_fils: 29000, color_hex: "#c9a24b" },
      { product_id: diffuser.id, sku: "RS-E2E-OFFER-SILVER", label_ar: "فضي", label_en: "Silver", price_fils: 29000, color_hex: "#9aa0a6" },
    ])
    .select("id, sku");
  if (diffuserVariantsError) throw diffuserVariantsError;
  for (const variant of diffuserVariants) {
    await db.from("inventory").update({ on_hand: 20 }).eq("variant_id", variant.id);
  }
  await db.from("products").update({ status: "published" }).eq("id", diffuser.id);

  // A simple accessory, locked to one colour in the bundle (no choice shown).
  const { data: accessory, error: accessoryError } = await db
    .from("products")
    .insert({
      slug: ACCESSORY_SLUG,
      type: "accessory",
      status: "draft",
      name_ar: "إكسسوار اختبار العروض",
      name_en: "E2E Offer Accessory",
    })
    .select("id")
    .single();
  if (accessoryError) throw accessoryError;
  const { data: accessoryVariant, error: accessoryVariantError } = await db
    .from("product_variants")
    .insert({
      product_id: accessory.id,
      sku: "RS-E2E-OFFER-CHARCOAL",
      label_ar: "فحمي",
      label_en: "Charcoal",
      price_fils: 5000,
      color_hex: "#1c1c1c",
    })
    .select("id")
    .single();
  if (accessoryVariantError) throw accessoryVariantError;
  await db.from("inventory").update({ on_hand: 30 }).eq("variant_id", accessoryVariant.id);
  await db.from("products").update({ status: "published" }).eq("id", accessory.id);

  // The offer itself: one flat-priced variant, well below the sum of its
  // components (29000 + 2x5000 = 39000), plus the two bundle_items rows.
  const { data: bundle, error: bundleError } = await db
    .from("products")
    .insert({
      slug: BUNDLE_SLUG,
      type: "bundle",
      status: "draft",
      name_ar: "عرض اختبار نهاية إلى نهاية",
      name_en: "E2E Offer Bundle",
      short_description_en: "A diffuser and two accessories, bundled.",
      short_description_ar: "فواح مع إكسسوارين، في حزمة واحدة.",
    })
    .select("id")
    .single();
  if (bundleError) throw bundleError;
  const { data: bundleVariant, error: bundleVariantError } = await db
    .from("product_variants")
    .insert({ product_id: bundle.id, sku: "RS-E2E-OFFER-BUNDLE", label_ar: "الحزمة", label_en: "Bundle", price_fils: 31000 })
    .select("id")
    .single();
  if (bundleVariantError) throw bundleVariantError;
  await db.from("inventory").update({ on_hand: 999, track_inventory: false }).eq("variant_id", bundleVariant.id);
  const { error: itemsError } = await db.from("bundle_items").insert([
    { bundle_id: bundle.id, item_product_id: diffuser.id, quantity: 1, position: 0, locked_variant_id: null },
    { bundle_id: bundle.id, item_product_id: accessory.id, quantity: 2, position: 1, locked_variant_id: accessoryVariant.id },
  ]);
  if (itemsError) throw itemsError;
  await db.from("products").update({ status: "published" }).eq("id", bundle.id);

  return { bundleId: bundle.id, diffuserId: diffuser.id, accessoryId: accessory.id, refillId: refill.id };
}

// Clicks a colour pill (the visible label; the radio itself is visually
// hidden) until the page has hydrated and the selection shows it.
async function chooseColour(page: Page, label: string) {
  const control = page.getByTestId(`offer-item-color-${DIFFUSER_SLUG}`);
  await expect(async () => {
    await control.getByText(label, { exact: true }).click();
    await expect(control.locator("legend")).toContainText(label, { timeout: 1_000 });
  }).toPass();
}

async function removeOffer(db: SupabaseClient) {
  const { data: bundle } = await db.from("products").select("id").eq("slug", BUNDLE_SLUG).maybeSingle();
  if (bundle) await db.from("products").delete().eq("id", bundle.id);
  await db.from("products").delete().in("slug", [DIFFUSER_SLUG, ACCESSORY_SLUG, REFILL_SLUG]);
}

test.describe("offers", () => {
  test.skip(!supabase, "needs CATALOG_SOURCE=supabase against the local Supabase stack (see e2e-admin/global-setup.ts)");

  test.beforeAll(async () => {
    await seedOffer(supabase!);
  });

  test.afterAll(async () => {
    await removeOffer(supabase!);
  });

  test("listing shows the active offer with its savings percentage", async ({ page }) => {
    await page.goto("/en/offers");
    const card = page.getByTestId("offer-card").filter({ hasText: "E2E Offer Bundle" });
    await expect(card).toBeVisible();
    await expect(card.getByTestId("offer-savings-badge")).toContainText("% off");
    await expect(card.getByTestId("offer-includes-count")).toContainText("2 products");
  });

  test("detail page shows every included item", async ({ page }) => {
    await page.goto(`/en/offers/${BUNDLE_SLUG}`);
    await expect(page.getByRole("heading", { name: "E2E Offer Bundle" })).toBeVisible();
    await expect(page.getByText("E2E Offer Diffuser")).toBeVisible();
    await expect(page.getByText("E2E Offer Accessory")).toBeVisible();
    // The accessory is locked to one colour: no choice control for it.
    await expect(page.getByTestId(`offer-item-color-${ACCESSORY_SLUG}`)).toContainText("Charcoal");
    await expect(page.getByTestId(`offer-item-color-${ACCESSORY_SLUG}`).locator("input")).toHaveCount(0);
  });

  test("choosing a non-default colour updates the preview", async ({ page }) => {
    await page.goto(`/en/offers/${BUNDLE_SLUG}`);
    const colorControl = page.getByTestId(`offer-item-color-${DIFFUSER_SLUG}`);
    await expect(colorControl).toContainText("Gold");
    await chooseColour(page, "Silver");
    await expect(colorControl.locator("legend")).toContainText("Silver");
  });

  test("add-to-cart is blocked until the required fragrance is chosen", async ({ page }) => {
    await page.goto(`/en/offers/${BUNDLE_SLUG}`);
    const addButton = page.getByTestId("offer-add-to-cart");
    const reminder = page.getByRole("alert").filter({ hasText: "Complete your colour and fragrance choices" });
    await expect(async () => {
      await addButton.click();
      await expect(reminder).toBeVisible({ timeout: 1_000 });
    }).toPass();
    await expect(page.getByRole("dialog", { name: /Your cart/ })).toBeHidden();

    await page.getByTestId(`offer-item-fragrances-${DIFFUSER_SLUG}`).getByRole("combobox").selectOption({ label: "E2E Offer Fragrance" });
    await addButton.click();

    const drawer = page.getByRole("dialog", { name: /Your cart/ });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByTestId("line-bundle")).toContainText("E2E Offer Bundle");
    await expect(drawer.getByTestId("line-bundle")).toContainText("E2E Offer Diffuser");
    await expect(drawer.getByTestId("line-bundle")).toContainText("E2E Offer Accessory");
    await expect(drawer.getByTestId("line-bundle")).toContainText("× 2");
    await page.keyboard.press("Escape");
  });

  test("two different colour choices of the same offer become two separate lines, and quantity/remove work", async ({ page }) => {
    await page.goto(`/en/offers/${BUNDLE_SLUG}`);
    await page.getByTestId(`offer-item-fragrances-${DIFFUSER_SLUG}`).getByRole("combobox").selectOption({ label: "E2E Offer Fragrance" });
    await page.getByTestId("offer-add-to-cart").click();
    await expect(page.getByRole("dialog", { name: /Your cart/ })).toBeVisible();
    await page.keyboard.press("Escape");

    // Same offer again, this time with the Silver diffuser: a second, distinct line.
    await page.goto(`/en/offers/${BUNDLE_SLUG}`);
    await chooseColour(page, "Silver");
    await page.getByTestId(`offer-item-fragrances-${DIFFUSER_SLUG}`).getByRole("combobox").selectOption({ label: "E2E Offer Fragrance" });
    await page.getByTestId("offer-add-to-cart").click();

    await page.goto("/en/cart");
    // The cart page itself (the closed drawer repeats the same lines).
    const lines = page.locator("main").getByTestId("line-bundle");
    await expect(lines).toHaveCount(2);
    await expect(lines.filter({ hasText: "Gold" })).toHaveCount(1);
    await expect(lines.filter({ hasText: "Silver" })).toHaveCount(1);

    // Adjust quantity on one line, then remove it.
    const firstLine = page.locator("main li").filter({ has: page.getByTestId("line-bundle") }).first();
    await firstLine.getByRole("button", { name: "Increase quantity" }).click();
    await firstLine.getByRole("button", { name: "Remove" }).click();
    await expect(lines).toHaveCount(1);
  });
});
