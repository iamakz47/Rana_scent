import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anonClient, createStaff, serviceClient } from "./env";

// Phase 6: colour variants (swatches, photos per colour, stock per colour)
// against the LOCAL stack under production-style privileges.

type Actor = { id: string; email: string; client: SupabaseClient };

let anon: SupabaseClient;
let service: SupabaseClient;
let manager: Actor;
let support: Actor;
let photos: string[];

const uid = () => crypto.randomUUID();
const tag = () => crypto.randomUUID().slice(0, 6).toUpperCase();
const address = { governorate: "hawalli", area: "Salmiya", block: "10", street: "Salem Al Mubarak", building: "12" };
const phone = () => `9${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
const order = (items: unknown[]) =>
  anon.rpc("place_order", {
    p_payload: { idempotency_key: uid(), customer_name: "Colour Test", phone: phone(), email: "", locale: "ar", payment_method: "cod", address, items },
  });
const stock = async (variant: string) =>
  (await service.from("inventory").select("on_hand").eq("variant_id", variant).single()).data!.on_hand as number;

beforeAll(async () => {
  anon = anonClient();
  service = serviceClient();
  manager = await createStaff("p6-manager", "manager");
  support = await createStaff("p6-support", "support");
  await service.from("shipping_zones").update({ is_active: true }).eq("name_en", "All of Kuwait");
  await service.from("shipping_rates").update({ is_active: true, price_fils: 2000, free_over_fils: 50000 }).eq("name_en", "Standard delivery");
  await service.from("store_settings").update({ cod_enabled: true }).eq("id", 1);
  const { data } = await service.from("media_assets").select("id").eq("bucket", "static").limit(3);
  photos = data!.map((m) => m.id as string);
});

async function saveTwoColours() {
  const black = `RS-P6B-${tag()}`;
  const red = `RS-P6R-${tag()}`;
  const { data: id, error } = await manager.client.rpc("save_product", {
    payload: {
      slug: `p6-${uid().slice(0, 8)}`, type: "diffuser", name_ar: "فواح ملون", name_en: "Colour diffuser",
      free_fragrances: "0",
      variants: [
        { sku: black, label_ar: "أسود", label_en: "Black", price_fils: 25000, color_hex: "#111111", position: 0 },
        { sku: red, label_ar: "أحمر", label_en: "Red", price_fils: 27000, color_hex: "#b3261e", position: 1 },
      ],
      // One shared photo, one black photo, one red photo.
      media: photos,
      media_variants: [
        { media_id: photos[1], variant_sku: black },
        { media_id: photos[2], variant_sku: red.toLowerCase() },
      ],
    },
  });
  expect(error).toBeNull();
  const { data: variants } = await service.from("product_variants").select("id, sku, color_hex").eq("product_id", id).order("position");
  return { id: id as string, black: variants![0], red: variants![1] };
}

describe("colour variants", () => {
  it("save_product stores swatches and links each photo to its colour by SKU", async () => {
    const { id, black, red } = await saveTwoColours();
    expect([black.color_hex, red.color_hex]).toEqual(["#111111", "#b3261e"]);
    const { data: media } = await service.from("product_media").select("media_id, variant_id, position").eq("product_id", id).order("position");
    expect(media).toEqual([
      { media_id: photos[0], variant_id: null, position: 0 },
      { media_id: photos[1], variant_id: black.id, position: 1 },
      { media_id: photos[2], variant_id: red.id, position: 2 },
    ]);
    // "0" free fragrances means none.
    expect((await service.from("products").select("free_fragrances").eq("id", id).single()).data!.free_fragrances).toBeNull();
  });

  it("re-saving keeps the colours, and a photo can move to another colour", async () => {
    const { id, black, red } = await saveTwoColours();
    const { error } = await manager.client.rpc("save_product", {
      payload: {
        id, slug: `p6-${uid().slice(0, 8)}`, type: "diffuser", name_ar: "فواح ملون", name_en: "Colour diffuser",
        variants: [
          { id: red.id, sku: red.sku, label_ar: "أحمر", label_en: "Red", price_fils: 27000, color_hex: "#B3261E", position: 0 },
          { id: black.id, sku: black.sku, label_ar: "أسود", label_en: "Black", price_fils: 25000, color_hex: "#111111", position: 1 },
        ],
        media: [photos[2], photos[1]],
        media_variants: [
          { media_id: photos[2], variant_sku: black.sku },
          { media_id: photos[1], variant_sku: black.sku },
        ],
      },
    });
    expect(error).toBeNull();
    const { data: media } = await service.from("product_media").select("media_id, variant_id").eq("product_id", id).order("position");
    expect(media).toEqual([
      { media_id: photos[2], variant_id: black.id },
      { media_id: photos[1], variant_id: black.id },
    ]);
    const { data: first } = await service.from("product_variants").select("id").eq("product_id", id).order("position").limit(1).single();
    expect(first!.id).toBe(red.id);
  });

  it("rejects an invalid swatch and ignores photos linked to an unknown SKU", async () => {
    const bad = await manager.client.rpc("save_product", {
      payload: {
        slug: `p6-${uid().slice(0, 8)}`, type: "diffuser", name_ar: "x", name_en: "x",
        variants: [{ sku: `RS-P6X-${tag()}`, label_ar: "أسود", label_en: "Black", price_fils: 1000, color_hex: "black" }],
      },
    });
    expect(bad.error?.code).toBe("23514");

    const { data: id } = await manager.client.rpc("save_product", {
      payload: {
        slug: `p6-${uid().slice(0, 8)}`, type: "diffuser", name_ar: "x", name_en: "x",
        variants: [{ sku: `RS-P6Y-${tag()}`, label_ar: "أسود", label_en: "Black", price_fils: 1000, color_hex: "#111111" }],
        media: [photos[0]],
        media_variants: [{ media_id: photos[0], variant_sku: "SOMEONE-ELSES" }],
      },
    });
    expect((await service.from("product_media").select("variant_id").eq("product_id", id).single()).data!.variant_id).toBeNull();
  });

  it("only catalogue staff can save colours; visitors read them only on published products", async () => {
    const denied = await support.client.rpc("save_product", {
      payload: { slug: `p6-${uid().slice(0, 8)}`, type: "diffuser", name_ar: "x", name_en: "x", variants: [{ sku: `RS-P6Z-${tag()}`, label_ar: "a", label_en: "a", price_fils: 1000, color_hex: "#111111" }] },
    });
    expect(denied.error).not.toBeNull();

    const { id, red } = await saveTwoColours();
    expect((await anon.from("product_variants").select("color_hex").eq("id", red.id)).data).toEqual([]);
    await service.from("inventory").update({ on_hand: 3 }).eq("variant_id", red.id);
    await service.from("products").update({ status: "published" }).eq("id", id);
    expect((await anon.from("product_variants").select("color_hex").eq("id", red.id)).data).toEqual([{ color_hex: "#b3261e" }]);
    expect((await anon.from("product_media").select("variant_id").eq("product_id", id)).data!.length).toBe(3);

    const tamper = await anon.from("product_variants").update({ color_hex: "#000000" }).eq("id", red.id).select();
    expect(tamper.data ?? []).toEqual([]);
  });

  it("orders use the server price and stock of the chosen colour; cancelling gives that colour's stock back", async () => {
    const { id, black, red } = await saveTwoColours();
    await service.from("inventory").update({ on_hand: 3 }).eq("variant_id", red.id);
    await service.from("inventory").update({ on_hand: 0 }).eq("variant_id", black.id);
    await service.from("products").update({ status: "published" }).eq("id", id);

    expect((await order([{ variant_id: black.id, quantity: 1 }])).error?.message).toBe("out_of_stock");

    // A price sent by the browser is ignored: the server charges 27.000 per red device.
    const placed = await order([{ variant_id: red.id, quantity: 2, unit_price_fils: 1 }]);
    expect(placed.error).toBeNull();
    expect(await stock(red.id)).toBe(1);
    expect(await stock(black.id)).toBe(0);
    const { data: item } = await service
      .from("order_items")
      .select("variant_id, variant_label_ar, variant_label_en, unit_price_fils, line_total_fils")
      .eq("order_id", placed.data.order_id)
      .single();
    expect(item).toEqual({ variant_id: red.id, variant_label_ar: "أحمر", variant_label_en: "Red", unit_price_fils: 27000, line_total_fils: 54000 });

    await service.from("orders").update({ status: "cancelled" }).eq("id", placed.data.order_id);
    expect(await stock(red.id)).toBe(3);
  });
});
