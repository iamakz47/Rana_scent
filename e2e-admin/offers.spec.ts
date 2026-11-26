import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { accounts, PASSWORD } from "./accounts";

// Offers & bundles: the admin side only. An offer is a bundle product
// (type='bundle') with one price-carrying variant and its included
// products in `bundle_items`. The owner never types a SKU or slug.

let service: SupabaseClient;
const tag = Math.random().toString(36).slice(2, 7);
let offerId = "";
let duplicateId = "";

async function staffSignIn(page: Page, email: string) {
  await page.goto("/en/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/en\/admin$/);
}

// A simple, already-published product for an offer to include.
async function makeProduct(name: string, priceFils: number, stock: number) {
  const slug = `e2e-offer-item-${tag}-${Math.random().toString(36).slice(2, 7)}`;
  const { data: product, error } = await service
    .from("products")
    .insert({ slug, type: "refill", name_ar: name, name_en: name, status: "draft" })
    .select("id")
    .single();
  if (error) throw error;
  const { data: variant } = await service
    .from("product_variants")
    .insert({ product_id: product.id, sku: `RS-${slug.toUpperCase()}`, label_ar: "قياسي", label_en: "Standard", price_fils: priceFils })
    .select("id")
    .single();
  await service.from("inventory").update({ on_hand: stock }).eq("variant_id", variant!.id);
  await service.from("products").update({ status: "published" }).eq("id", product.id);
  return { slug, name, productId: product.id as string };
}

test.beforeAll(async () => {
  const raw = execFileSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const env = JSON.parse(raw.slice(raw.indexOf("{"))) as Record<string, string>;
  service = createClient(env.API_URL, env.SECRET_KEY, { auth: { persistSession: false } });
});

test.describe.serial("offers & bundles (admin)", () => {
  const nameA = `Offer Item A ${tag}`;
  const nameB = `Offer Item B ${tag}`;
  const offerNameEn = `Bundle Deal ${tag}`;

  test("the owner bundles two existing products at one price, under 60 seconds of typing", async ({ page }) => {
    const a = await makeProduct(nameA, 40000, 10); // 40.000 KWD
    const b = await makeProduct(nameB, 20000, 10); // 20.000 KWD

    await staffSignIn(page, accounts.owner);
    await page.goto("/en/admin/offers");
    await page.getByRole("link", { name: "+ Create offer" }).click();
    await page.waitForURL(/\/en\/admin\/offers\/new$/);

    await page.getByLabel("Offer name (Arabic)").fill("عرض الحزمة");
    await page.getByLabel("Offer name (English)").fill(offerNameEn);

    const search = page.getByLabel("Search products by name");
    await search.fill(a.name);
    await page.getByRole("checkbox", { name: a.name }).click();
    await search.fill(b.name);
    await page.getByRole("checkbox", { name: b.name }).click();

    const rowA = page.getByTestId("offer-item-row").filter({ hasText: a.name });
    const rowB = page.getByTestId("offer-item-row").filter({ hasText: b.name });
    await expect(rowA).toBeVisible();
    await expect(rowB).toBeVisible();
    // B × 2: original total becomes 40.000 + (20.000 × 2) = 80.000.
    await rowB.getByLabel("Qty").fill("2");

    await page.getByLabel("Offer price (KWD)").fill("60.000");
    const preview = page.getByTestId("offer-savings-preview");
    await expect(preview).toContainText("80.000");
    await expect(preview).toContainText("60.000");
    await expect(preview).toContainText("20.000");
    await expect(preview).toContainText("25%");

    await page.getByRole("button", { name: "Save as draft" }).click();
    await page.waitForURL(/\/en\/admin\/offers\/[0-9a-f-]{36}\?created=1/);
    await expect(page.getByText("Offer saved.")).toBeVisible();
    offerId = page.url().match(/offers\/([0-9a-f-]{36})/)![1];

    // One bundle product, one price-carrying variant, two bundle_items rows.
    const { data: bundleRow } = await service.from("products").select("type, status").eq("id", offerId).single();
    expect(bundleRow).toEqual({ type: "bundle", status: "draft" });
    const { data: variants } = await service.from("product_variants").select("label_en, price_fils").eq("product_id", offerId);
    expect(variants).toEqual([{ label_en: "Bundle", price_fils: 60000 }]);
    const { data: items } = await service
      .from("bundle_items")
      .select("item_product_id, quantity")
      .eq("bundle_id", offerId)
      .order("position");
    expect(items).toEqual([
      { item_product_id: a.productId, quantity: 1 },
      { item_product_id: b.productId, quantity: 2 },
    ]);
  });

  test("publishing shows it in the list with the right item count and price", async ({ page }) => {
    await staffSignIn(page, accounts.owner);
    await page.goto(`/en/admin/offers/${offerId}`);
    await page.getByTestId("offer-publish-button").getByRole("button").click();
    await expect(page.getByText("Published.")).toBeVisible();

    await page.goto("/en/admin/offers");
    const row = page.locator("li").filter({ hasText: offerNameEn });
    await expect(row).toContainText("2 items");
    await expect(row).toContainText("60.000");
    await expect(row.getByText("Published", { exact: true })).toBeVisible();
  });

  test("editing recomputes the savings preview and keeps the offer published", async ({ page }) => {
    await staffSignIn(page, accounts.owner);
    await page.goto(`/en/admin/offers/${offerId}`);
    await expect(page.getByLabel("Offer price (KWD)")).toHaveValue("60.000");

    await page.getByLabel("Offer price (KWD)").fill("65.000");
    const preview = page.getByTestId("offer-savings-preview");
    await expect(preview).toContainText("65.000");
    await expect(preview).toContainText("15.000");

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Offer saved.")).toBeVisible();

    const { data: variant } = await service.from("product_variants").select("price_fils").eq("product_id", offerId).single();
    expect(variant!.price_fils).toBe(65000);
    const { data: row } = await service.from("products").select("status").eq("id", offerId).single();
    expect(row!.status).toBe("published");
  });

  test("duplicating makes a fresh draft with the same products, quantities and price", async ({ page }) => {
    await staffSignIn(page, accounts.owner);
    await page.goto(`/en/admin/offers/${offerId}`);
    await page.getByRole("button", { name: "Duplicate offer" }).click();
    await page.waitForURL(/\/en\/admin\/offers\/[0-9a-f-]{36}\?duplicated=1/);
    await expect(page.getByText("Copy created as a draft.", { exact: false })).toBeVisible();
    duplicateId = page.url().match(/offers\/([0-9a-f-]{36})/)![1];
    expect(duplicateId).not.toBe(offerId);

    const { data: copy } = await service.from("products").select("status, offer_starts_at, offer_ends_at").eq("id", duplicateId).single();
    expect(copy).toEqual({ status: "draft", offer_starts_at: null, offer_ends_at: null });
    const { data: variant } = await service.from("product_variants").select("price_fils").eq("product_id", duplicateId).single();
    expect(variant!.price_fils).toBe(65000);
    const { data: items } = await service.from("bundle_items").select("item_product_id, quantity").eq("bundle_id", duplicateId).order("position");
    expect(items).toHaveLength(2);
  });

  test("deleting the duplicate draft removes it", async ({ page }) => {
    await staffSignIn(page, accounts.owner);
    await page.goto(`/en/admin/offers/${duplicateId}`);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.waitForURL(/\/en\/admin\/offers$/);

    const { data } = await service.from("products").select("id").eq("id", duplicateId).maybeSingle();
    expect(data).toBeNull();
    // The original offer (and its included products) are untouched.
    const { data: original } = await service.from("products").select("id").eq("id", offerId).maybeSingle();
    expect(original).not.toBeNull();
  });

  test("an offer price at or above the original total is rejected", async ({ page }) => {
    const c = await makeProduct(`Offer Item C ${tag}`, 40000, 5);

    await staffSignIn(page, accounts.owner);
    await page.goto("/en/admin/offers/new");
    await page.getByLabel("Offer name (Arabic)").fill("عرض مرفوض");
    await page.getByLabel("Offer name (English)").fill(`Rejected Offer ${tag}`);

    await page.getByLabel("Search products by name").fill(c.name);
    await page.getByRole("checkbox", { name: c.name }).click();
    await expect(page.getByTestId("offer-item-row").filter({ hasText: c.name })).toBeVisible();

    // The single item costs 40.000; 45.000 is not a saving at all.
    await page.getByLabel("Offer price (KWD)").fill("45.000");
    await page.getByRole("button", { name: "Save as draft" }).click();

    await expect(page.getByText("The offer price must be lower than the original total of the included products.")).toBeVisible();
    // No navigation happened: still on the "new offer" form.
    expect(page.url()).toContain("/admin/offers/new");
  });
});
