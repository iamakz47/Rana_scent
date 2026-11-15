import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CRON_SECRET } from "../playwright.admin.config";

// The live (Supabase) catalog on the LOCAL stack: visibility, prices and
// availability always come from the database.

let service: SupabaseClient;

test.beforeAll(() => {
  const raw = execFileSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const env = JSON.parse(raw.slice(raw.indexOf("{"))) as Record<string, string>;
  service = createClient(env.API_URL, env.SECRET_KEY, { auth: { persistSession: false } });
});

async function makeProduct(price: number, stock: number) {
  const slug = `e2e-cat-${Math.random().toString(36).slice(2, 8)}`;
  const { data: product, error } = await service
    .from("products")
    .insert({ slug, type: "refill", name_ar: "عطر اختبار", name_en: `Catalog ${slug}`, status: "draft" })
    .select("id")
    .single();
  if (error) throw error;
  const { data: variant } = await service
    .from("product_variants")
    .insert({ product_id: product.id, sku: `RS-${slug.toUpperCase()}`, label_ar: "قياسي", label_en: "Standard", price_fils: price })
    .select("id")
    .single();
  await service.from("inventory").update({ on_hand: stock }).eq("variant_id", variant!.id);
  return { slug, productId: product.id as string, variantId: variant!.id as string };
}

// Direct database changes bypass the admin, so refresh the storefront cache
// the same way an operator would after a bulk import.
async function refresh(request: import("@playwright/test").APIRequestContext) {
  const res = await request.post("/api/revalidate", { headers: { Authorization: `Bearer ${CRON_SECRET}` } });
  expect(res.status()).toBe(200);
}

async function addToCart(page: import("@playwright/test").Page, slug: string) {
  await page.goto(`/en/products/${slug}`);
  // Retry until the page has hydrated (a click before hydration is a no-op).
  await expect(async () => {
    await page.getByRole("button", { name: /add to cart/i }).first().click();
    await expect(page.locator("dialog[open]")).toBeVisible({ timeout: 1_000 });
  }).toPass();
}

async function publish(id: string, status: "published" | "draft" | "archived") {
  await service.from("products").update({ status }).eq("id", id);
}

test("draft and archived products stay hidden", async ({ page, request }) => {
  const p = await makeProduct(12000, 10);
  const res = await page.goto(`/en/products/${p.slug}`);
  expect(res?.status()).toBe(404);
  await publish(p.productId, "published");
  await refresh(request);
  await page.goto(`/en/products/${p.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(p.slug);
  await publish(p.productId, "archived");
  await refresh(request);
  expect((await page.goto(`/en/products/${p.slug}`))?.status()).toBe(404);
  await page.goto("/en/shop");
  await expect(page.getByText(`Catalog ${p.slug}`)).toHaveCount(0);
});

test("a price change reaches the cart and checkout", async ({ page, request }) => {
  const p = await makeProduct(12000, 10);
  await publish(p.productId, "published");
  await refresh(request);
  await addToCart(page, p.slug);
  await expect(page.locator("dialog[open]")).toContainText("KWD 12.000");

  await service.from("product_variants").update({ price_fils: 15500 }).eq("id", p.variantId);
  await page.goto("/en/cart");
  await expect(page.locator("main")).toContainText("KWD 15.500");
  await expect(page.locator("main")).not.toContainText("KWD 12.000");
});

test("sold-out and unpublished items can't be checked out", async ({ page, request }) => {
  const p = await makeProduct(9000, 1);
  await publish(p.productId, "published");
  await refresh(request);
  await addToCart(page, p.slug);

  // Sold out after it was added.
  await service.from("inventory").update({ on_hand: 0 }).eq("variant_id", p.variantId);
  await page.goto("/en/checkout");
  await page.locator("#governorate").selectOption("hawalli");
  await page.locator("#area").fill("Salmiya");
  await expect(page.getByRole("button", { name: /Continue to payment|Place order/ })).toBeDisabled();

  // Unpublished after it was added.
  await service.from("inventory").update({ on_hand: 5 }).eq("variant_id", p.variantId);
  await publish(p.productId, "draft");
  await page.reload();
  await page.locator("#governorate").selectOption("hawalli");
  await page.locator("#area").fill("Salmiya");
  await expect(page.getByRole("button", { name: /Continue to payment|Place order/ })).toBeDisabled();
});

test("the cache refresh endpoint needs the secret", async ({ request }) => {
  expect((await request.post("/api/revalidate")).status()).toBe(401);
  expect((await request.post("/api/revalidate", { headers: { Authorization: "Bearer wrong" } })).status()).toBe(401);
  expect((await request.get("/api/cron/reconcile")).status()).toBe(401);
});

test("a nav collection without a category falls back to the shop filter", async ({ page }) => {
  await page.goto("/en/collections/bundles");
  await expect(page).toHaveURL(/\/en\/shop\?type=bundle/);
});
