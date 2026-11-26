import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anonClient, createStaff, serviceClient } from "./env";

// Offers & Bundles against the LOCAL stack under production-style
// privileges: save_offer, the publish guard, checkout pricing/stock/
// fragrances for a bundle line, cancellation, and discount stacking.

type Actor = { id: string; email: string; client: SupabaseClient };

let anon: SupabaseClient;
let service: SupabaseClient;
let manager: Actor;
let support: Actor;

const uid = () => crypto.randomUUID();
const tag = () => crypto.randomUUID().slice(0, 6).toUpperCase();
const address = { governorate: "hawalli", area: "Salmiya", block: "10", street: "Salem Al Mubarak", building: "12" };
const phone = () => `9${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;

function payload(items: unknown[], extra: Record<string, unknown> = {}) {
  return {
    idempotency_key: uid(), customer_name: "Offer Test", phone: phone(), email: "", locale: "en",
    payment_method: "cod", address, items, ...extra,
  };
}
const order = (items: unknown[], extra: Record<string, unknown> = {}) => anon.rpc("place_order", { p_payload: payload(items, extra) });
const stock = async (variant: string) =>
  (await service.from("inventory").select("on_hand").eq("variant_id", variant).single()).data!.on_hand as number;

async function makeProduct(type: "diffuser" | "refill" | "accessory", price: number, onHand: number, extra: Record<string, unknown> = {}) {
  const { data: product, error } = await service
    .from("products")
    .insert({ slug: `offer-${uid().slice(0, 8)}`, type, name_ar: `اختبار ${tag()}`, name_en: `Offer test ${tag()}`, status: "draft", ...extra })
    .select("id")
    .single();
  if (error) throw error;
  const { data: variant } = await service
    .from("product_variants")
    .insert({ product_id: product.id, sku: `RS-OF-${tag()}`, label_ar: "قياسي", label_en: "Standard", price_fils: price })
    .select("id")
    .single();
  await service.from("inventory").update({ on_hand: onHand }).eq("variant_id", variant!.id);
  await service.from("products").update({ status: "published" }).eq("id", product.id);
  return { product: product.id as string, variant: variant!.id as string };
}

// A product with two colours, each its own stock.
async function makeColorProduct(priceA: number, stockA: number, priceB: number, stockB: number) {
  const { data: product } = await service
    .from("products")
    .insert({ slug: `offer-${uid().slice(0, 8)}`, type: "diffuser", name_ar: `ملون ${tag()}`, name_en: `Colour ${tag()}`, status: "draft" })
    .select("id")
    .single();
  const { data: a } = await service
    .from("product_variants")
    .insert({ product_id: product!.id, sku: `RS-OFA-${tag()}`, label_ar: "أسود", label_en: "Black", price_fils: priceA, color_hex: "#111111" })
    .select("id")
    .single();
  const { data: b } = await service
    .from("product_variants")
    .insert({ product_id: product!.id, sku: `RS-OFB-${tag()}`, label_ar: "أحمر", label_en: "Red", price_fils: priceB, color_hex: "#b3261e" })
    .select("id")
    .single();
  await service.from("inventory").update({ on_hand: stockA }).eq("variant_id", a!.id);
  await service.from("inventory").update({ on_hand: stockB }).eq("variant_id", b!.id);
  await service.from("products").update({ status: "published" }).eq("id", product!.id);
  return { product: product!.id as string, a: a!.id as string, b: b!.id as string };
}

async function saveOffer(staff: Actor, items: unknown[], price: number, extra: Record<string, unknown> = {}) {
  return staff.client.rpc("save_offer", {
    payload: {
      name_ar: `عرض ${tag()}`, name_en: `Offer ${tag()}`,
      price_fils: price,
      items,
      ...extra,
    },
  });
}

async function bundleVariant(bundleId: string) {
  const { data } = await service.from("product_variants").select("id").eq("product_id", bundleId).single();
  return data!.id as string;
}

beforeAll(async () => {
  anon = anonClient();
  service = serviceClient();
  manager = await createStaff("offers-manager", "manager");
  support = await createStaff("offers-support", "support");
  await service.from("shipping_zones").update({ is_active: true }).eq("name_en", "All of Kuwait");
  await service.from("shipping_rates").update({ is_active: true, price_fils: 2000, free_over_fils: 50000 }).eq("name_en", "Standard delivery");
  await service.from("store_settings").update({ cod_enabled: true, free_fragrance_allow_duplicates: true }).eq("id", 1);
});

describe("save_offer", () => {
  it("creates a draft bundle with one priced variant and its included products", async () => {
    const a = await makeProduct("diffuser", 25000, 10);
    const b = await makeProduct("refill", 5000, 10);
    const { data: id, error } = await saveOffer(manager, [
      { item_product_id: a.product, quantity: 1 },
      { item_product_id: b.product, quantity: 2 },
    ], 30000);
    expect(error).toBeNull();
    const { data: product } = await service.from("products").select("type, status").eq("id", id).single();
    expect(product).toEqual({ type: "bundle", status: "draft" });
    const { data: items } = await service.from("bundle_items").select("item_product_id, quantity, locked_variant_id").eq("bundle_id", id).order("position");
    expect(items).toEqual([
      { item_product_id: a.product, quantity: 1, locked_variant_id: null },
      { item_product_id: b.product, quantity: 2, locked_variant_id: null },
    ]);
    const { data: variant } = await service.from("product_variants").select("price_fils, is_active").eq("product_id", id).single();
    expect(variant).toEqual({ price_fils: 30000, is_active: true });
  });

  it("rejects a price at or above the original total, and a non-positive price", async () => {
    const a = await makeProduct("diffuser", 25000, 10);
    const b = await makeProduct("refill", 5000, 10);
    const items = [{ item_product_id: a.product, quantity: 1 }, { item_product_id: b.product, quantity: 1 }];
    const tooHigh = await saveOffer(manager, items, 30000); // original total is exactly 30000
    expect(tooHigh.error?.message).toBe("offer_price_too_high");
    const zero = await saveOffer(manager, items, 0);
    expect(zero.error?.message).toBe("offer_price_invalid");
  });

  it("rejects an empty item list and a repeated product", async () => {
    const empty = await saveOffer(manager, [], 1000);
    expect(empty.error?.message).toBe("offer_items_invalid");
    const a = await makeProduct("diffuser", 25000, 10);
    const repeated = await saveOffer(manager, [
      { item_product_id: a.product, quantity: 1 },
      { item_product_id: a.product, quantity: 2 },
    ], 1000);
    expect(repeated.error?.message).toBe("offer_items_invalid");
  });

  it("the locked colour must belong to the included product", async () => {
    const colours = await makeColorProduct(25000, 10, 27000, 10);
    const other = await makeProduct("diffuser", 20000, 10);
    const bad = await saveOffer(manager, [
      { item_product_id: colours.product, quantity: 1, locked_variant_id: (await makeColorProduct(1000, 1, 1000, 1)).a },
    ], 1000);
    expect(bad.error).not.toBeNull();
    // Locking to a colour that really does belong to the product works and
    // prices the original total from that colour.
    const good = await saveOffer(manager, [{ item_product_id: colours.product, quantity: 1, locked_variant_id: colours.b }], 26000);
    expect(good.error).toBeNull();
    void other;
  });

  it("only catalogue staff can save an offer", async () => {
    const a = await makeProduct("diffuser", 25000, 10);
    const denied = await saveOffer(support, [{ item_product_id: a.product, quantity: 1 }], 1000);
    expect(denied.error).not.toBeNull();
  });

  it("cannot include another offer, and a draft offer cannot be published", async () => {
    const a = await makeProduct("diffuser", 25000, 10);
    const { data: offerId } = await saveOffer(manager, [{ item_product_id: a.product, quantity: 1 }], 20000);
    const nested = await saveOffer(manager, [{ item_product_id: offerId, quantity: 1 }], 1000);
    expect(nested.error).not.toBeNull();

    const draftComponent = await makeProduct("refill", 5000, 10);
    await service.from("products").update({ status: "draft" }).eq("id", draftComponent.product);
    const { data: offer2 } = await saveOffer(manager, [{ item_product_id: draftComponent.product, quantity: 1 }], 1000);
    const blocked = await manager.client.from("products").update({ status: "published" }).eq("id", offer2);
    expect(blocked.error).not.toBeNull();
    await service.from("products").update({ status: "published" }).eq("id", draftComponent.product);
    const allowed = await manager.client.from("products").update({ status: "published" }).eq("id", offer2);
    expect(allowed.error).toBeNull();
  });
});

describe("checkout with an offer in the cart", () => {
  it("bills the offer's own price, reserves stock from the real components, and records the breakdown", async () => {
    const a = await makeProduct("diffuser", 25000, 5);
    const b = await makeProduct("refill", 5000, 5);
    const { data: offerId } = await saveOffer(manager, [
      { item_product_id: a.product, quantity: 1 },
      { item_product_id: b.product, quantity: 2 },
    ], 30000);
    await manager.client.from("products").update({ status: "published" }).eq("id", offerId);
    const variantId = await bundleVariant(offerId);

    const placed = await order([{
      variant_id: variantId, quantity: 2,
      bundle: { components: [{ item_product_id: a.product, variant_id: a.variant }, { item_product_id: b.product, variant_id: b.variant }] },
    }]);
    expect(placed.error).toBeNull();

    const { data: item } = await service.from("order_items").select("id, product_id, variant_id, unit_price_fils, quantity, line_total_fils")
      .eq("order_id", placed.data.order_id).single();
    expect(item).toEqual({ id: item!.id, product_id: offerId, variant_id: variantId, unit_price_fils: 30000, quantity: 2, line_total_fils: 60000 });

    const { data: components } = await service.from("order_item_components").select("item_product_id, variant_id, quantity, unit_price_fils")
      .eq("order_item_id", item!.id).order("item_product_id");
    const expected = [
      { item_product_id: a.product, variant_id: a.variant, quantity: 2, unit_price_fils: 25000 },
      { item_product_id: b.product, variant_id: b.variant, quantity: 4, unit_price_fils: 5000 },
    ].sort((x, y) => x.item_product_id.localeCompare(y.item_product_id));
    expect(components).toEqual(expected);

    // Two devices of `a` and four of `b` were reserved (quantity 2 bundles).
    expect(await stock(a.variant)).toBe(3);
    expect(await stock(b.variant)).toBe(1);
    // The bundle's own placeholder variant is never itself stock-tracked.
    expect(await stock(variantId)).toBe(0);

    await service.from("orders").update({ status: "cancelled" }).eq("id", placed.data.order_id);
    expect(await stock(a.variant)).toBe(5);
    expect(await stock(b.variant)).toBe(5);
    expect(await stock(variantId)).toBe(0);
  });

  it("rejects checkout when a component is out of stock, and changes nothing", async () => {
    const a = await makeProduct("diffuser", 25000, 1);
    const { data: offerId } = await saveOffer(manager, [{ item_product_id: a.product, quantity: 2 }], 20000);
    await manager.client.from("products").update({ status: "published" }).eq("id", offerId);
    const variantId = await bundleVariant(offerId);

    const placed = await order([{
      variant_id: variantId, quantity: 1,
      bundle: { components: [{ item_product_id: a.product, variant_id: a.variant }] },
    }]);
    expect(placed.error?.message).toBe("out_of_stock");
    expect(await stock(a.variant)).toBe(1);
  });

  it("ignores a tampered colour choice on a locked item, pricing and reserving the owner's locked colour", async () => {
    const colours = await makeColorProduct(25000, 5, 27000, 5);
    const { data: offerId } = await saveOffer(manager, [
      { item_product_id: colours.product, quantity: 1, locked_variant_id: colours.b },
    ], 20000);
    await manager.client.from("products").update({ status: "published" }).eq("id", offerId);
    const variantId = await bundleVariant(offerId);

    // The browser claims the black (a) colour; the server must still use red (b).
    const placed = await order([{
      variant_id: variantId, quantity: 1,
      bundle: { components: [{ item_product_id: colours.product, variant_id: colours.a }] },
    }]);
    expect(placed.error).toBeNull();
    expect(await stock(colours.a)).toBe(5);
    expect(await stock(colours.b)).toBe(4);
  });

  it("rejects when the submitted components don't match the offer's real contents", async () => {
    const a = await makeProduct("diffuser", 25000, 5);
    const b = await makeProduct("refill", 5000, 5);
    const { data: offerId } = await saveOffer(manager, [
      { item_product_id: a.product, quantity: 1 },
      { item_product_id: b.product, quantity: 1 },
    ], 25000);
    await manager.client.from("products").update({ status: "published" }).eq("id", offerId);
    const variantId = await bundleVariant(offerId);

    const missing = await order([{
      variant_id: variantId, quantity: 1,
      bundle: { components: [{ item_product_id: a.product, variant_id: a.variant }] },
    }]);
    expect(missing.error?.message).toBe("item_unavailable");
    expect(await stock(a.variant)).toBe(5);
  });

  it("validates free-fragrance choices of an included diffuser", async () => {
    const diffuser = await makeProduct("diffuser", 25000, 5, { free_fragrances: 1 });
    const musk = await makeProduct("refill", 4000, 10);
    const { data: offerId } = await saveOffer(manager, [{ item_product_id: diffuser.product, quantity: 1 }], 20000);
    await manager.client.from("products").update({ status: "published" }).eq("id", offerId);
    const variantId = await bundleVariant(offerId);

    const missing = await order([{
      variant_id: variantId, quantity: 1,
      bundle: { components: [{ item_product_id: diffuser.product, variant_id: diffuser.variant }] },
    }]);
    expect(missing.error?.message).toBe("fragrance_selection_required");

    const placed = await order([{
      variant_id: variantId, quantity: 1,
      bundle: { components: [{ item_product_id: diffuser.product, variant_id: diffuser.variant, fragrances: [musk.product] }] },
    }]);
    expect(placed.error).toBeNull();
    const { data: comp } = await service.from("order_item_components").select("id").eq("item_product_id", diffuser.product)
      .order("id", { ascending: false }).limit(1).single();
    const { data: choice } = await service.from("order_item_component_fragrances").select("device_no, slot, fragrance_product_id")
      .eq("order_item_component_id", comp!.id).single();
    expect(choice).toEqual({ device_no: 1, slot: 1, fragrance_product_id: musk.product });
  });

  it("two lines of the same offer with different colours are kept separate, not merged", async () => {
    const colours = await makeColorProduct(25000, 5, 27000, 5);
    const { data: offerId } = await saveOffer(manager, [{ item_product_id: colours.product, quantity: 1 }], 20000);
    await manager.client.from("products").update({ status: "published" }).eq("id", offerId);
    const variantId = await bundleVariant(offerId);

    const placed = await order([
      { variant_id: variantId, quantity: 1, bundle: { components: [{ item_product_id: colours.product, variant_id: colours.a }] } },
      { variant_id: variantId, quantity: 1, bundle: { components: [{ item_product_id: colours.product, variant_id: colours.b }] } },
    ]);
    expect(placed.error).toBeNull();
    const { data: items } = await service.from("order_items").select("id").eq("order_id", placed.data.order_id);
    expect(items).toHaveLength(2);
    expect(await stock(colours.a)).toBe(4);
    expect(await stock(colours.b)).toBe(4);
  });

  it("blocks a discount code by default, and allows it once the owner opts in", async () => {
    const a = await makeProduct("diffuser", 25000, 5);
    const { data: offerId } = await saveOffer(manager, [{ item_product_id: a.product, quantity: 1 }], 20000);
    await manager.client.from("products").update({ status: "published" }).eq("id", offerId);
    const variantId = await bundleVariant(offerId);
    const code = `OFF${tag()}`;
    await service.from("discount_codes").insert({ code, kind: "fixed", value: 1000, is_active: true });

    const items = [{ variant_id: variantId, quantity: 1, bundle: { components: [{ item_product_id: a.product, variant_id: a.variant }] } }];
    const blocked = await order(items, { discount_code: code });
    expect(blocked.error?.message).toBe("discount_blocked_by_offer");

    await manager.client.from("products").update({ allow_discount_stacking: true }).eq("id", offerId);
    const allowed = await order(items, { discount_code: code });
    expect(allowed.error).toBeNull();
  });
});

describe("visibility", () => {
  it("visitors see a published offer's included products, never a draft one's", async () => {
    const a = await makeProduct("diffuser", 25000, 5);
    const { data: offerId } = await saveOffer(manager, [{ item_product_id: a.product, quantity: 1 }], 20000);
    expect((await anon.from("bundle_items").select("item_product_id").eq("bundle_id", offerId)).data).toEqual([]);
    await manager.client.from("products").update({ status: "published" }).eq("id", offerId);
    expect((await anon.from("bundle_items").select("item_product_id").eq("bundle_id", offerId)).data).toEqual([{ item_product_id: a.product }]);
  });
});
