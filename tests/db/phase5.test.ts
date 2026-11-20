import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anonClient, createStaff, createUser, serviceClient } from "./env";

// Phase 5: device details, free fragrance selection and policies, against the
// LOCAL stack under production-style privileges.

type Actor = { id: string; email: string; client: SupabaseClient };

let anon: SupabaseClient;
let service: SupabaseClient;
let customer: Actor;
let other: Actor;
let support: Actor;
let editor: Actor;
let manager: Actor;
let admin: Actor;

let twoFree: { product: string; variant: string };
let oneFree: { product: string; variant: string };
let refillVariant: string;
let musk: string;
let oud: string;
let unpublished: string;
let soldOut: string;
let notEligible: string;

const uid = () => crypto.randomUUID();
const tag = () => crypto.randomUUID().slice(0, 6).toUpperCase();
const address = { governorate: "hawalli", area: "Salmiya", block: "10", street: "Salem Al Mubarak", building: "12" };
const phone = () => `9${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;

async function makeProduct(type: "diffuser" | "refill", price: number, stock: number, extra: Record<string, unknown> = {}) {
  const { data: product, error } = await service
    .from("products")
    .insert({ slug: `p5-${uid().slice(0, 8)}`, type, name_ar: `اختبار ${tag()}`, name_en: `P5 ${type} ${tag()}`, status: "draft", ...extra })
    .select("id")
    .single();
  if (error) throw error;
  const { data: variant } = await service
    .from("product_variants")
    .insert({ product_id: product.id, sku: `RS-P5-${tag()}`, label_ar: "قياسي", label_en: "Standard", price_fils: price })
    .select("id")
    .single();
  await service.from("inventory").update({ on_hand: stock }).eq("variant_id", variant!.id);
  await service.from("products").update({ status: "published" }).eq("id", product.id);
  return { product: product.id as string, variant: variant!.id as string };
}

function payload(items: unknown[], extra: Record<string, unknown> = {}) {
  return {
    idempotency_key: uid(), customer_name: "Free Fragrance", phone: phone(), email: "", locale: "en",
    payment_method: "cod", address, items, ...extra,
  };
}

const stock = async (variant: string) =>
  (await service.from("inventory").select("on_hand").eq("variant_id", variant).single()).data!.on_hand as number;

beforeAll(async () => {
  anon = anonClient();
  service = serviceClient();
  customer = await createUser("p5-customer");
  other = await createUser("p5-other");
  support = await createStaff("p5-support", "support");
  editor = await createStaff("p5-editor", "editor");
  manager = await createStaff("p5-manager", "manager");
  admin = await createStaff("p5-admin", "admin");
  await service.from("shipping_zones").update({ is_active: true }).eq("name_en", "All of Kuwait");
  await service.from("shipping_rates").update({ is_active: true, price_fils: 2000, free_over_fils: 50000 }).eq("name_en", "Standard delivery");
  await service.from("store_settings").update({ cod_enabled: true, free_fragrance_allow_duplicates: true }).eq("id", 1);

  twoFree = await makeProduct("diffuser", 25000, 50, { free_fragrances: 2 });
  oneFree = await makeProduct("diffuser", 18000, 50, { free_fragrances: 1 });
  const refill = await makeProduct("refill", 4000, 30);
  refillVariant = refill.variant;
  musk = refill.product;
  oud = (await makeProduct("refill", 4000, 30)).product;
  const hidden = await makeProduct("refill", 4000, 30);
  await service.from("products").update({ status: "draft" }).eq("id", hidden.product);
  unpublished = hidden.product;
  soldOut = (await makeProduct("refill", 4000, 0)).product;
  notEligible = (await makeProduct("refill", 4000, 30, { free_fragrance_eligible: false })).product;
});

describe("free fragrance catalogue", () => {
  it("lists only published, eligible, in-stock fragrances", async () => {
    const { data, error } = await anon.rpc("list_free_fragrances");
    expect(error).toBeNull();
    const ids = (data as Array<{ id: string }>).map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining([musk, oud]));
    for (const id of [unpublished, soldOut, notEligible, twoFree.product]) expect(ids).not.toContain(id);
  });

  it("only diffusers can include free fragrances", async () => {
    await service.from("products").update({ free_fragrances: 1 }).eq("id", musk);
    expect((await service.from("products").select("free_fragrances").eq("id", musk).single()).data!.free_fragrances).toBeNull();
  });
});

describe("validation on the server", () => {
  const order = (items: unknown[]) => anon.rpc("place_order", { p_payload: payload(items) });

  it("requires exactly the device's number of choices", async () => {
    expect((await order([{ variant_id: twoFree.variant, quantity: 1 }])).error?.message).toBe("fragrance_selection_required");
    expect((await order([{ variant_id: twoFree.variant, quantity: 1, fragrances: [musk] }])).error?.message).toBe("fragrance_selection_required");
    expect((await order([{ variant_id: twoFree.variant, quantity: 1, fragrances: [musk, oud, musk] }])).error?.message).toBe("fragrance_selection_required");
    expect((await order([{ variant_id: oneFree.variant, quantity: 1, fragrances: [musk, oud] }])).error?.message).toBe("fragrance_selection_required");
  });

  it("rejects free choices on products without free fragrances", async () => {
    const r = await order([{ variant_id: refillVariant, quantity: 1, fragrances: [oud] }]);
    expect(r.error?.message).toBe("fragrance_invalid");
  });

  it("rejects malformed, unpublished, sold-out and ineligible fragrances", async () => {
    expect((await order([{ variant_id: oneFree.variant, quantity: 1, fragrances: ["not-a-uuid"] }])).error?.message).toBe("fragrance_invalid");
    expect((await order([{ variant_id: oneFree.variant, quantity: 1, fragrances: "oops" }])).error?.message).toBe("fragrance_invalid");
    for (const id of [unpublished, soldOut, notEligible, uid(), twoFree.product]) {
      expect((await order([{ variant_id: oneFree.variant, quantity: 1, fragrances: [id] }])).error?.message, id).toBe("fragrance_unavailable");
    }
  });

  it("the quote reports the problem without failing", async () => {
    const { data, error } = await anon.rpc("quote_order", {
      p_items: [{ variant_id: twoFree.variant, quantity: 1, fragrances: [musk] }], p_governorate: "hawalli", p_area: "Salmiya", p_discount_code: "",
    });
    expect(error).toBeNull();
    expect(data.fragrance_problem).toBe("fragrance_selection_required");
    const ok = await anon.rpc("quote_order", {
      p_items: [{ variant_id: twoFree.variant, quantity: 1, fragrances: [musk, oud] }], p_governorate: "hawalli", p_area: "Salmiya", p_discount_code: "",
    });
    expect(ok.data.fragrance_problem).toBeNull();
  });

  it("allows the same fragrance twice unless the owner turns that off", async () => {
    expect((await order([{ variant_id: twoFree.variant, quantity: 1, fragrances: [musk, musk] }])).error).toBeNull();
    await service.from("store_settings").update({ free_fragrance_allow_duplicates: false }).eq("id", 1);
    expect((await order([{ variant_id: twoFree.variant, quantity: 1, fragrances: [musk, musk] }])).error?.message).toBe("fragrance_duplicate");
    await service.from("store_settings").update({ free_fragrance_allow_duplicates: true }).eq("id", 1);
  });
});

describe("orders keep each device's choices", () => {
  it("stores choices per device, charges nothing for them and doesn't touch fragrance stock", async () => {
    const muskStock = await stock(refillVariant);
    const deviceStock = await stock(twoFree.variant);
    const { data, error } = await customer.client.rpc("place_order", {
      p_payload: payload([
        { variant_id: twoFree.variant, quantity: 2, fragrances: [musk, oud] },
        { variant_id: twoFree.variant, quantity: 1, fragrances: [oud, oud] },
      ]),
    });
    expect(error).toBeNull();
    // 3 devices × 25.000 + delivery (free over 50.000): the fragrances add nothing.
    expect(data.total_fils).toBe(75000);
    expect(await stock(twoFree.variant)).toBe(deviceStock - 3);
    expect(await stock(refillVariant)).toBe(muskStock);

    const { data: item } = await service.from("order_items").select("id, quantity, unit_price_fils").eq("order_id", data.order_id).single();
    expect(item).toMatchObject({ quantity: 3, unit_price_fils: 25000 });
    const { data: rows } = await service.from("order_item_fragrances").select("device_no, slot, fragrance_product_id")
      .eq("order_item_id", item!.id).order("device_no").order("slot");
    expect(rows).toEqual([
      { device_no: 1, slot: 1, fragrance_product_id: musk }, { device_no: 1, slot: 2, fragrance_product_id: oud },
      { device_no: 2, slot: 1, fragrance_product_id: musk }, { device_no: 2, slot: 2, fragrance_product_id: oud },
      { device_no: 3, slot: 1, fragrance_product_id: oud }, { device_no: 3, slot: 2, fragrance_product_id: oud },
    ]);

    // The customer's order view lists them; the customer and order staff can read them, others can't.
    const view = await anon.rpc("get_order_for_customer", { order_number: data.number, token: data.access_token });
    expect(view.data.items[0].free_fragrances).toHaveLength(6);
    expect(view.data.items[0].free_fragrances[0]).toMatchObject({ device: 1, slot: 1 });
    expect((await customer.client.from("order_item_fragrances").select("id").eq("order_item_id", item!.id)).data).toHaveLength(6);
    expect((await support.client.from("order_item_fragrances").select("id").eq("order_item_id", item!.id)).data).toHaveLength(6);
    expect((await other.client.from("order_item_fragrances").select("id").eq("order_item_id", item!.id)).data).toHaveLength(0);
    expect((await editor.client.from("order_item_fragrances").select("id").eq("order_item_id", item!.id)).data).toHaveLength(0);
    expect((await anon.from("order_item_fragrances").select("id")).error).not.toBeNull();
    // Nobody writes them directly.
    expect((await support.client.from("order_item_fragrances").insert({ order_item_id: item!.id, device_no: 9, slot: 1, name_ar: "x", name_en: "x" })).error).not.toBeNull();

    // Cancelling restores device stock once and keeps the history.
    expect((await support.client.from("orders").update({ status: "cancelled" }).eq("id", data.order_id)).error).toBeNull();
    expect(await stock(twoFree.variant)).toBe(deviceStock);
    expect(await stock(refillVariant)).toBe(muskStock);
    expect((await service.from("order_item_fragrances").select("id").eq("order_item_id", item!.id)).data).toHaveLength(6);
  });

  it("choices keep the fragrance name even if the fragrance is renamed later", async () => {
    const { data } = await anon.rpc("place_order", { p_payload: payload([{ variant_id: oneFree.variant, quantity: 1, fragrances: [oud] }]) });
    const before = await anon.rpc("get_order_for_customer", { order_number: data.number, token: data.access_token });
    const name = before.data.items[0].free_fragrances[0].name.en;
    await service.from("products").update({ name_en: "Renamed Oud" }).eq("id", oud);
    const after = await anon.rpc("get_order_for_customer", { order_number: data.number, token: data.access_token });
    expect(after.data.items[0].free_fragrances[0].name.en).toBe(name);
  });
});

describe("product details", () => {
  it("save_product stores specs, information and free fragrances; only diffusers keep a count", async () => {
    const base = {
      slug: `p5-save-${uid().slice(0, 8)}`, type: "diffuser", name_ar: "جهاز", name_en: "Device",
      variants: [{ sku: `RS-P5S-${tag()}`, label_ar: "أسود", label_en: "Black", price_fils: 30000 }],
      free_fragrances: "2",
      device_specs: { coverage_m2: 300, dimensions: { width: 20, height: 15, depth: 8, unit: "cm" } },
      info_sections: { operation: { ar: "اضغط الزر", en: "Press the button" } },
    };
    const { data: id, error } = await manager.client.rpc("save_product", { payload: base });
    expect(error).toBeNull();
    const { data: row } = await service.from("products").select("free_fragrances, device_specs, info_sections").eq("id", id).single();
    expect(row).toEqual({ free_fragrances: 2, device_specs: base.device_specs, info_sections: base.info_sections });

    // Switching the type away from diffuser drops the count.
    const { data: variant } = await service.from("product_variants").select("id").eq("product_id", id).single();
    const resave = await manager.client.rpc("save_product", {
      payload: { ...base, id, type: "accessory", variants: [{ ...base.variants[0], id: variant!.id }] },
    });
    expect(resave.error).toBeNull();
    expect((await service.from("products").select("free_fragrances").eq("id", id).single()).data!.free_fragrances).toBeNull();
  });
});

describe("policies", () => {
  it("visitors see nothing until the owner publishes", async () => {
    expect((await anon.rpc("get_policy", { p_key: "returns" })).data).toBeNull();
    expect((await anon.from("site_policies").select("key")).error).not.toBeNull();
    expect((await support.client.from("site_policies").select("key")).data).toHaveLength(0);
    expect((await editor.client.from("site_policies").select("key")).data).toHaveLength(0);
    const drafts = await admin.client.from("site_policies").select("key, published_at").order("position");
    expect(drafts.data!.map((d) => d.key)).toEqual(["returns", "refunds", "warranty", "delivery", "terms", "privacy"]);
  });

  it("only settings editors (owner, admin) can edit or publish", async () => {
    for (const actor of [anon, customer.client, support.client, editor.client, manager.client]) {
      expect((await actor.rpc("save_policy_draft", { p_key: "warranty", p_title_ar: "x", p_title_en: "x", p_body_ar: "x", p_body_en: "x" })).error).not.toBeNull();
      expect((await actor.rpc("publish_policy", { p_key: "warranty" })).error).not.toBeNull();
    }
    expect((await support.client.from("site_policies").update({ published_at: new Date().toISOString() }).eq("key", "warranty").select()).data ?? []).toHaveLength(0);
  });

  it("drafts, publishes and unpublishes", async () => {
    const save = await admin.client.rpc("save_policy_draft", {
      p_key: "warranty", p_title_ar: "الضمان", p_title_en: "Warranty", p_body_ar: "نص الضمان", p_body_en: "Warranty text",
    });
    expect(save.error).toBeNull();
    expect((await anon.rpc("get_policy", { p_key: "warranty" })).data).toBeNull();
    expect((await admin.client.rpc("publish_policy", { p_key: "warranty" })).error).toBeNull();
    const published = await anon.rpc("get_policy", { p_key: "warranty" });
    expect(published.data).toMatchObject({ title: { en: "Warranty" }, body: { ar: "نص الضمان" } });

    // A later draft doesn't change what visitors see until it's published.
    await admin.client.rpc("save_policy_draft", { p_key: "warranty", p_title_ar: "الضمان", p_title_en: "Warranty", p_body_ar: "جديد", p_body_en: "New" });
    expect((await anon.rpc("get_policy", { p_key: "warranty" })).data.body.en).toBe("Warranty text");

    // Incomplete drafts can't be published.
    await admin.client.rpc("save_policy_draft", { p_key: "refunds", p_title_ar: "", p_title_en: "Refunds", p_body_ar: "", p_body_en: "x" });
    expect((await admin.client.rpc("publish_policy", { p_key: "refunds" })).error?.message).toBe("policy_incomplete");

    expect((await admin.client.rpc("unpublish_policy", { p_key: "warranty" })).error).toBeNull();
    expect((await anon.rpc("get_policy", { p_key: "warranty" })).data).toBeNull();
  });
});
