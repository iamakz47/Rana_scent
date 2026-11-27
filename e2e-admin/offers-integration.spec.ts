import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CRON_SECRET } from "../playwright.admin.config";
import { accounts, PASSWORD } from "./accounts";

// Offers working with the rest of the store: navigation, the homepage,
// colour photos inside offers, and offers kept out of the product editor.
// LOCAL stack, live catalogue.

let db: SupabaseClient;
const tag = Math.random().toString(36).slice(2, 7);
const OFFER = `e2e-offer-colours-${tag}`;
const DEVICE = `e2e-offer-colour-device-${tag}`;
let offerId = "";
let blackPhoto = "";
let redPhoto = "";

async function staffSignIn(page: Page, email: string) {
  await page.goto("/en/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/en\/admin$/);
}

test.beforeAll(async ({ request }) => {
  const raw = execFileSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const env = JSON.parse(raw.slice(raw.indexOf("{"))) as Record<string, string>;
  db = createClient(env.API_URL, env.SECRET_KEY, { auth: { persistSession: false } });

  // A device whose photos all belong to a colour (no shared photo).
  const { data: media } = await db.from("media_assets").select("id, path").eq("bucket", "static").in("path", ["images/products/rana-tower.jpg", "images/products/rana-majlis.jpg"]);
  const black = media!.find((m) => m.path.endsWith("rana-tower.jpg"))!;
  const red = media!.find((m) => m.path.endsWith("rana-majlis.jpg"))!;
  blackPhoto = "rana-tower";
  redPhoto = "rana-majlis";
  const { data: device } = await db.from("products").insert({ slug: DEVICE, type: "diffuser", status: "draft", name_ar: "فواح ملون للعرض", name_en: `Offer Colour Device ${tag}` }).select("id").single();
  const { data: colours } = await db
    .from("product_variants")
    .insert([
      { product_id: device!.id, sku: `RS-OC-B-${tag.toUpperCase()}`, label_ar: "أسود", label_en: "Black", price_fils: 30000, color_hex: "#111111", position: 0 },
      { product_id: device!.id, sku: `RS-OC-R-${tag.toUpperCase()}`, label_ar: "أحمر", label_en: "Red", price_fils: 30000, color_hex: "#b3261e", position: 1 },
    ])
    .select("id, label_en");
  const blackId = colours!.find((c) => c.label_en === "Black")!.id;
  const redId = colours!.find((c) => c.label_en === "Red")!.id;
  for (const c of colours!) await db.from("inventory").update({ on_hand: 10 }).eq("variant_id", c.id);
  await db.from("product_media").insert([
    { product_id: device!.id, media_id: black.id, position: 0, variant_id: blackId },
    { product_id: device!.id, media_id: red.id, position: 1, variant_id: redId },
  ]);
  await db.from("products").update({ status: "published" }).eq("id", device!.id);

  // An offer without its own photo: 2 devices for less than 60.000.
  const { data: offer } = await db.from("products").insert({ slug: OFFER, type: "bundle", status: "draft", name_ar: "عرض الألوان", name_en: `Colour Offer ${tag}` }).select("id").single();
  offerId = offer!.id;
  const { data: placeholder } = await db.from("product_variants").insert({ product_id: offerId, sku: `RS-OC-O-${tag.toUpperCase()}`, label_ar: "العرض", label_en: "Offer", price_fils: 52000 }).select("id").single();
  await db.from("inventory").update({ on_hand: 0, track_inventory: false }).eq("variant_id", placeholder!.id);
  await db.from("bundle_items").insert({ bundle_id: offerId, item_product_id: device!.id, quantity: 2, position: 0 });
  await db.from("products").update({ status: "published" }).eq("id", offerId);

  const res = await request.post("/api/revalidate", { headers: { Authorization: `Bearer ${CRON_SECRET}` } });
  expect(res.status()).toBe(200);
});

test.describe("offers across the store", () => {
  for (const lang of ["en", "ar"] as const) {
    test(`header, footer and homepage lead to the offers (${lang})`, async ({ page }) => {
      const label = lang === "en" ? "Offers" : "العروض";
      await page.goto(`/${lang}`);
      await expect(page.getByRole("navigation", { name: lang === "en" ? "Main navigation" : "القائمة الرئيسية" }).getByRole("link", { name: label, exact: true })).toHaveAttribute("href", `/${lang}/offers`);
      await expect(page.locator("footer").getByRole("link", { name: label, exact: true })).toHaveAttribute("href", `/${lang}/offers`);
      // Nothing still points at the old empty "sets" collection.
      await expect(page.locator('a[href$="/collections/bundles"]')).toHaveCount(0);
      // The homepage shows the latest offers (up to three) and links to all of them.
      const home = page.getByTestId("home-offers");
      await expect(home.getByTestId("offer-card").first()).toBeVisible();
      await expect(home.locator(`a[href^="/${lang}/offers/"]`).first()).toBeVisible();
      await page.locator("footer").getByRole("link", { name: label, exact: true }).click();
      await page.waitForURL(new RegExp(`/${lang}/offers$`));
      await expect(page.getByTestId("offers-grid")).toContainText(lang === "en" ? `Colour Offer ${tag}` : "عرض الألوان");
    });
  }

  for (const lang of ["ar", "en"] as const) {
    test(`homepage category cards end with the offers card (${lang})`, async ({ page }) => {
      await page.goto(`/${lang}`);
      const cards = page.getByTestId("home-categories").locator("li");
      // The seed's three categories plus the offers card; other specs may add
      // more homepage categories, so the count is a lower bound.
      await expect(cards.nth(3)).toBeAttached();
      await expect(page.getByTestId("home-offers-card")).toHaveCount(1);
      const offers = page.getByTestId("home-offers-card");
      await expect(offers).toContainText(lang === "ar" ? "العروض والباقات" : "Offers & Bundles");
      await expect(offers).toHaveAttribute("href", `/${lang}/offers`);
      // The whole card is the link, and it is the last card in reading order.
      await expect(cards.last().getByRole("link")).toHaveAttribute("href", `/${lang}/offers`);
      await expect(cards.first().getByRole("link")).toHaveAttribute("href", new RegExp(`^/${lang}/collections/`));
      await offers.click();
      await page.waitForURL(new RegExp(`/${lang}/offers$`));
    });
  }

  test("on a phone the category cards swipe sideways and snap, without widening the page", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const lang of ["ar", "en"] as const) {
      await page.goto(`/${lang}`);
      const list = page.getByTestId("home-categories");
      await expect(list).toBeVisible();
      expect(await list.evaluate((el) => getComputedStyle(el).scrollSnapType)).toContain("x");
      expect(await list.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      // Swiping to the end reaches the offers card.
      await list.scrollIntoViewIfNeeded();
      await list.evaluate((el) => el.scrollTo({ left: (getComputedStyle(el).direction === "rtl" ? -1 : 1) * el.scrollWidth, behavior: "instant" }));
      await expect(page.getByTestId("home-offers-card")).toBeInViewport();
    }
  });

  test("draft offers never appear on the homepage or the offers page", async ({ page, request }) => {
    await db.from("products").update({ status: "draft" }).eq("id", offerId);
    await request.post("/api/revalidate", { headers: { Authorization: `Bearer ${CRON_SECRET}` } });
    for (const path of ["/en", "/en/offers"]) {
      await page.goto(path);
      await expect(page.getByText(`Colour Offer ${tag}`)).toHaveCount(0);
    }
    expect((await page.goto(`/en/offers/${OFFER}`))?.status()).toBe(404);
    await db.from("products").update({ status: "published" }).eq("id", offerId);
    await request.post("/api/revalidate", { headers: { Authorization: `Bearer ${CRON_SECRET}` } });
  });

  test("an offer without its own photo shows its device's photo; colour photos switch instantly", async ({ page }) => {
    await page.goto("/en/offers");
    const card = page.getByTestId("offer-card").filter({ hasText: `Colour Offer ${tag}` });
    await expect(card.locator("img").first()).toHaveAttribute("src", new RegExp(blackPhoto));

    await page.goto(`/en/offers/${OFFER}`);
    await page.waitForLoadState("networkidle");
    const photo = page.getByTestId(`offer-item-photo-${DEVICE}`);
    const colours = page.getByTestId(`offer-item-color-${DEVICE}`);
    await expect(photo).toHaveAttribute("data-src", new RegExp(blackPhoto));
    for (let round = 0; round < 2; round++) {
      await expect(async () => {
        await colours.getByText("Red", { exact: true }).click();
        await expect(photo).toHaveAttribute("data-src", new RegExp(redPhoto), { timeout: 1_000 });
      }).toPass();
      await colours.getByText("Black", { exact: true }).click();
      await expect(photo).toHaveAttribute("data-src", new RegExp(blackPhoto));
    }
  });

  test("offers are managed only in Admin → Offers, never in the product editor", async ({ page }) => {
    await staffSignIn(page, accounts.owner);
    await page.goto(`/en/admin/products?q=${encodeURIComponent(`Colour Offer ${tag}`)}`);
    await expect(page.getByText("Nothing matches your search.")).toBeVisible();
    await page.goto(`/en/admin/products?q=${encodeURIComponent(`Offer Colour Device ${tag}`)}`);
    await expect(page.getByRole("link", { name: new RegExp(`Offer Colour Device ${tag}`) })).toHaveCount(1);

    // Opening an offer through the products address lands in the offer editor.
    await page.goto(`/en/admin/products/${offerId}`);
    await page.waitForURL(new RegExp(`/en/admin/offers/${offerId}`));

    // The product editor no longer offers to create a "Set".
    await page.goto("/en/admin/products/new");
    const types = await page.locator("#type option").allInnerTexts();
    expect(types).toEqual(["Diffuser", "Refill", "Accessory"]);
  });
});
