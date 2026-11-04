import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anonClient, createStaff, createUser, serviceClient } from "./env";

// Row-level security and privilege-escalation tests against the LOCAL stack.

type Actor = { id: string; email: string; client: SupabaseClient };

let anon: SupabaseClient;
let customer: Actor;
let owner: Actor;
let admin: Actor;
let manager: Actor;
let editor: Actor;
let support: Actor;
let finance: Actor;

const PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="),
  (c) => c.charCodeAt(0),
);

beforeAll(async () => {
  anon = anonClient();
  // A clean slate of staff for this run; the store needs one owner first.
  const service = serviceClient();
  owner = await createStaff("owner", "owner");
  admin = await createStaff("admin", "admin");
  manager = await createStaff("manager", "manager");
  editor = await createStaff("editor", "editor");
  support = await createStaff("support", "support");
  finance = await createStaff("finance", "finance");
  customer = await createUser("customer");
  await service.from("store_settings").update({ slider_interval_seconds: 4 }).eq("id", 1);
});

afterAll(async () => {
  const service = serviceClient();
  const { data: tests } = await service.from("products").select("id, product_variants(id)").like("slug", "test-%");
  const variantIds = (tests ?? []).flatMap((p) => p.product_variants.map((v) => v.id));
  if (variantIds.length) await service.from("inventory_movements").delete().in("variant_id", variantIds);
  await service.from("products").delete().like("slug", "test-%");
  await service.from("store_settings").update({ slider_interval_seconds: 4 }).eq("id", 1);
});

async function newDraft(client: SupabaseClient, extra: Record<string, unknown> = {}) {
  const slug = `test-${crypto.randomUUID().slice(0, 8)}`;
  return client
    .from("products")
    .insert({ slug, type: "diffuser", name_ar: "تجربة", name_en: "Test", ...extra })
    .select("id, slug, status")
    .single();
}

describe("anonymous visitors", () => {
  it("cannot read any administrative table", async () => {
    for (const table of [
      "staff_members",
      "audit_logs",
      "roles",
      "role_permissions",
      "orders",
      "payments",
      "payment_events",
      "expenses",
      "discount_codes",
      "inventory_movements",
      "profiles",
      "customer_addresses",
    ]) {
      const { data, error } = await anon.from(table).select("*").limit(1);
      expect(error !== null || (data ?? []).length === 0, `${table} leaked to anon`).toBe(true);
    }
  });

  it("sees only published products, visible categories and live slides", async () => {
    const products = await anon.from("products").select("status");
    expect(products.error).toBeNull();
    expect(products.data!.every((row) => row.status === "published")).toBe(true);

    const categories = await anon.from("categories").select("slug, is_visible");
    expect(categories.data!.map((c) => c.slug)).toEqual(
      expect.arrayContaining(["diffusers", "refills", "accessories"]),
    );

    const slides = await anon.from("homepage_slides").select("status, is_enabled");
    expect(slides.data!.length).toBeGreaterThan(0);
    expect(slides.data!.every((s) => s.status === "published" && s.is_enabled)).toBe(true);

    const settings = await anon.from("store_settings").select("slider_interval_seconds").single();
    expect(settings.data!.slider_interval_seconds).toBe(4);
  });

  it("cannot see draft products or their stock", async () => {
    const service = serviceClient();
    const draft = await newDraft(editor.client);
    await editor.client.from("product_variants").insert({
      product_id: draft.data!.id,
      sku: `RS-D-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
      label_ar: "قياسي",
      label_en: "Standard",
      price_fils: 1000,
    });
    const { data: drafts } = await service.from("products").select("id").eq("status", "draft");
    expect(drafts!.length).toBeGreaterThan(0);
    const { data } = await anon.from("products").select("id").in("id", drafts!.map((d) => d.id));
    expect(data).toEqual([]);
    const { data: draftVariants } = await service
      .from("product_variants")
      .select("id")
      .in("product_id", drafts!.map((d) => d.id));
    const { data: stock } = await anon
      .from("inventory")
      .select("variant_id")
      .in("variant_id", draftVariants!.map((v) => v.id));
    expect(stock).toEqual([]);
  });

  it("cannot write catalog, content or settings", async () => {
    expect((await newDraft(anon)).error).not.toBeNull();
    const update = await anon.from("store_settings").update({ slider_interval_seconds: 9 }).eq("id", 1).select();
    expect(update.data ?? []).toEqual([]);
    const slide = await anon.from("homepage_slides").delete().neq("position", -1).select();
    expect(slide.data ?? []).toEqual([]);
  });

  it("cannot call privileged functions", async () => {
    for (const [fn, args] of [
      ["adjust_inventory", { target_variant: crypto.randomUUID(), quantity_change: 5, reason: "restock" }],
      ["list_staff", {}],
      ["assign_staff_role", { target_email: "x@example.test", target_role: "owner" }],
      ["bootstrap_owner", { target_user: crypto.randomUUID() }],
    ] as const) {
      const { error } = await anon.rpc(fn, args);
      expect(error, fn).not.toBeNull();
    }
  });

  it("cannot list or upload media objects", async () => {
    const list = await anon.storage.from("media").list("products");
    expect(list.data ?? []).toEqual([]);
    const upload = await anon.storage
      .from("media")
      .upload(`library/${crypto.randomUUID()}.png`, PNG, { contentType: "image/png" });
    expect(upload.error).not.toBeNull();
  });
});

describe("signed-in customers", () => {
  it("cannot make themselves staff", async () => {
    const self = await customer.client.from("staff_members").insert({ user_id: customer.id, role: "owner" });
    expect(self.error).not.toBeNull();
    const rpc = await customer.client.rpc("assign_staff_role", { target_email: customer.email, target_role: "owner" });
    expect(rpc.error).not.toBeNull();
    const perms = await customer.client.from("role_permissions").insert({ role: "support", permission: "staff.write" });
    expect(perms.error).not.toBeNull();
  });

  it("read only their own profile", async () => {
    const { data } = await customer.client.from("profiles").select("id");
    expect(data!.map((p) => p.id)).toEqual([customer.id]);
  });

  it("cannot read drafts or the audit log", async () => {
    const drafts = await customer.client.from("products").select("id").eq("status", "draft");
    expect(drafts.data).toEqual([]);
    const audit = await customer.client.from("audit_logs").select("id").limit(1);
    expect(audit.data ?? []).toEqual([]);
  });
});

describe("role permissions", () => {
  it("editors create drafts but cannot publish", async () => {
    const draft = await newDraft(editor.client);
    expect(draft.error).toBeNull();
    expect(draft.data!.status).toBe("draft");

    const publish = await editor.client.from("products").update({ status: "published" }).eq("id", draft.data!.id);
    expect(publish.error?.message).toMatch(/catalog\.publish/);

    const direct = await newDraft(editor.client, { status: "published" });
    expect(direct.error).not.toBeNull();
  });

  it("publishing needs an available variant", async () => {
    const draft = await newDraft(manager.client);
    const bare = await manager.client.from("products").update({ status: "published" }).eq("id", draft.data!.id);
    expect(bare.error?.message).toMatch(/variant/);
  });

  it("managers publish, and publishing stamps published_at", async () => {
    const draft = await newDraft(manager.client);
    await manager.client.from("product_variants").insert({
      product_id: draft.data!.id,
      sku: `RS-P-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
      label_ar: "قياسي",
      label_en: "Standard",
      price_fils: 1000,
    });
    const { data, error } = await manager.client
      .from("products")
      .update({ status: "published" })
      .eq("id", draft.data!.id)
      .select("status, published_at, updated_by")
      .single();
    expect(error).toBeNull();
    expect(data!.status).toBe("published");
    expect(data!.published_at).not.toBeNull();
    expect(data!.updated_by).toBe(manager.id);
  });

  it("support and finance cannot edit the catalog", async () => {
    expect((await newDraft(support.client)).error).not.toBeNull();
    expect((await newDraft(finance.client)).error).not.toBeNull();
  });

  it("only finance-capable roles read expenses", async () => {
    const created = await finance.client
      .from("expenses")
      .insert({ category: "packaging", description: "Boxes", amount_fils: 12500, incurred_on: "2026-11-01" })
      .select("id")
      .single();
    expect(created.error).toBeNull();
    const asEditor = await editor.client.from("expenses").select("id");
    expect(asEditor.data).toEqual([]);
    await serviceClient().from("expenses").delete().eq("id", created.data!.id);
  });

  it("writes an audit entry with the acting user", async () => {
    const draft = await newDraft(editor.client);
    const { data } = await owner.client
      .from("audit_logs")
      .select("actor_id, action, table_name")
      .eq("table_name", "products")
      .eq("record_id", draft.data!.id);
    expect(data).toEqual([{ actor_id: editor.id, action: "INSERT", table_name: "products" }]);
    const hidden = await editor.client.from("audit_logs").select("id").limit(1);
    expect(hidden.data).toEqual([]);
  });
});

describe("staff management and escalation", () => {
  it("nobody changes their own role", async () => {
    for (const actor of [editor, manager, admin, owner]) {
      const { data } = await actor.client
        .from("staff_members")
        .update({ role: "owner" })
        .eq("user_id", actor.id)
        .select();
      expect(data ?? [], actor.email).toEqual([]);
    }
    const { data } = await serviceClient().from("staff_members").select("role").eq("user_id", editor.id).single();
    expect(data!.role).toBe("editor");
  });

  it("editors and managers cannot assign roles", async () => {
    const target = await createUser("target-a");
    for (const actor of [editor, manager]) {
      const { error } = await actor.client.rpc("assign_staff_role", { target_email: target.email, target_role: "support" });
      expect(error).not.toBeNull();
    }
  });

  it("admins assign standard roles but never owner or admin", async () => {
    const target = await createUser("target-b");
    const ok = await admin.client.rpc("assign_staff_role", { target_email: target.email, target_role: "editor" });
    expect(ok.error).toBeNull();

    const up = await admin.client.rpc("assign_staff_role", { target_email: target.email, target_role: "owner" });
    expect(up.error?.message).toMatch(/owner/i);
    const toAdmin = await admin.client.rpc("assign_staff_role", { target_email: target.email, target_role: "admin" });
    expect(toAdmin.error).not.toBeNull();

    const demote = await admin.client.from("staff_members").update({ is_active: false }).eq("user_id", owner.id);
    expect(demote.error).not.toBeNull();
  });

  it("owners assign admins, and the last owner cannot be removed", async () => {
    const target = await createUser("target-c");
    const ok = await owner.client.rpc("assign_staff_role", { target_email: target.email, target_role: "admin" });
    expect(ok.error).toBeNull();

    const service = serviceClient();
    const { data: owners } = await service.from("staff_members").select("user_id").eq("role", "owner").eq("is_active", true);
    // Temporarily make our owner the only owner, then try to remove it.
    const others = owners!.map((o) => o.user_id).filter((id) => id !== owner.id);
    if (others.length > 0) {
      await service.from("staff_members").update({ is_active: false }).in("user_id", others);
    }
    const remove = await service.from("staff_members").delete().eq("user_id", owner.id);
    expect(remove.error?.message).toMatch(/at least one active owner/);
    if (others.length > 0) {
      await service.from("staff_members").update({ is_active: true }).in("user_id", others);
    }
  });

  it("deactivated staff lose access immediately", async () => {
    const temp = await createStaff("temp-editor", "editor");
    expect((await newDraft(temp.client)).error).toBeNull();
    await owner.client.from("staff_members").update({ is_active: false }).eq("user_id", temp.id);
    expect((await newDraft(temp.client)).error).not.toBeNull();
  });

  it("the staff list is limited to staff.read", async () => {
    expect((await owner.client.rpc("list_staff")).data!.length).toBeGreaterThan(0);
    expect((await editor.client.rpc("list_staff")).error).not.toBeNull();
  });
});

describe("inventory", () => {
  async function variantFor(client: SupabaseClient) {
    const draft = await newDraft(client);
    const sku = `RS-T-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const variant = await client
      .from("product_variants")
      .insert({ product_id: draft.data!.id, sku, label_ar: "قياسي", label_en: "Standard", price_fils: 15000 })
      .select("id")
      .single();
    expect(variant.error).toBeNull();
    return variant.data!.id as string;
  }

  it("adjusts atomically, records the movement, and refuses negative stock", async () => {
    const variant = await variantFor(manager.client);
    const up = await manager.client.rpc("adjust_inventory", {
      target_variant: variant,
      quantity_change: 10,
      reason: "restock",
      note: "Initial delivery",
    });
    expect(up.data).toBe(10);

    const down = await manager.client.rpc("adjust_inventory", { target_variant: variant, quantity_change: -11, reason: "damage" });
    expect(down.error?.message).toMatch(/below zero/);

    const { data: moves } = await manager.client
      .from("inventory_movements")
      .select("quantity_change, quantity_after, reason, actor_id, note")
      .eq("variant_id", variant);
    expect(moves).toEqual([
      { quantity_change: 10, quantity_after: 10, reason: "restock", actor_id: manager.id, note: "Initial delivery" },
    ]);
  });

  it("editors can view but not adjust stock, and nobody writes stock directly", async () => {
    const variant = await variantFor(editor.client);
    const adjust = await editor.client.rpc("adjust_inventory", { target_variant: variant, quantity_change: 5, reason: "restock" });
    expect(adjust.error).not.toBeNull();

    const direct = await manager.client.from("inventory").update({ on_hand: 999 }).eq("variant_id", variant);
    expect(direct.error).not.toBeNull();
    const forged = await manager.client
      .from("inventory_movements")
      .insert({ variant_id: variant, quantity_change: 5, quantity_after: 5, reason: "restock" });
    expect(forged.error).not.toBeNull();

    const threshold = await manager.client.from("inventory").update({ low_stock_threshold: 3 }).eq("variant_id", variant).select();
    expect(threshold.error).toBeNull();
    expect(threshold.data!.length).toBe(1);
  });
});

describe("homepage slider settings", () => {
  it("content editors set the interval within 2–30 seconds", async () => {
    const ok = await editor.client.from("store_settings").update({ slider_interval_seconds: 6 }).eq("id", 1).select().single();
    expect(ok.error).toBeNull();
    expect(ok.data!.slider_interval_seconds).toBe(6);
    expect((await anon.from("store_settings").select("slider_interval_seconds").single()).data!.slider_interval_seconds).toBe(6);

    for (const value of [1, 31]) {
      const bad = await editor.client.from("store_settings").update({ slider_interval_seconds: value }).eq("id", 1);
      expect(bad.error, String(value)).not.toBeNull();
    }
  });

  it("content editors cannot change contact settings; support cannot touch the slider", async () => {
    const contact = await editor.client.from("store_settings").update({ contact_email: "x@example.test" }).eq("id", 1);
    expect(contact.error?.message).toMatch(/settings\.write/);
    const slider = await support.client.from("store_settings").update({ slider_interval_seconds: 5 }).eq("id", 1).select();
    expect(slider.data ?? []).toEqual([]);
  });

  it("drafts stay private until published", async () => {
    const draft = await editor.client
      .from("homepage_slides")
      .insert({
        position: 9,
        status: "draft",
        title_ar: "مسودة",
        title_en: "Draft",
        primary_cta_label_ar: "تسوّق",
        primary_cta_label_en: "Shop",
        primary_cta_href: "/shop",
        composition: "diffusers",
      })
      .select("id")
      .single();
    expect(draft.error).toBeNull();
    expect((await anon.from("homepage_slides").select("id").eq("id", draft.data!.id)).data).toEqual([]);

    const external = await editor.client.from("homepage_slides").update({ primary_cta_href: "//evil.example" }).eq("id", draft.data!.id);
    expect(external.error).not.toBeNull();

    await editor.client.from("homepage_slides").delete().eq("id", draft.data!.id);
  });
});

describe("media library", () => {
  it("media editors upload to safe paths only", async () => {
    const path = `library/${crypto.randomUUID()}.png`;
    const ok = await editor.client.storage.from("media").upload(path, PNG, { contentType: "image/png" });
    expect(ok.error).toBeNull();

    const traversal = await editor.client.storage.from("media").upload(`../${crypto.randomUUID()}.png`, PNG, { contentType: "image/png" });
    expect(traversal.error).not.toBeNull();
    const badFolder = await editor.client.storage.from("media").upload(`secret/${crypto.randomUUID()}.png`, PNG, { contentType: "image/png" });
    expect(badFolder.error).not.toBeNull();
    const badType = await editor.client.storage
      .from("media")
      .upload(`library/${crypto.randomUUID()}.png`, new TextEncoder().encode("<svg/>"), { contentType: "image/svg+xml" });
    expect(badType.error).not.toBeNull();

    const support_ = await support.client.storage.from("media").upload(`library/${crypto.randomUUID()}.png`, PNG, { contentType: "image/png" });
    expect(support_.error).not.toBeNull();

    const moved = await editor.client.storage.from("media").move(path, `secret/${crypto.randomUUID()}.png`);
    expect(moved.error).not.toBeNull();

    await editor.client.storage.from("media").remove([path]);
  });

  it("site photography cannot be deleted and in-use media is protected", async () => {
    const { data: statics } = await editor.client.from("media_assets").select("id").eq("bucket", "static");
    expect(statics!.length).toBeGreaterThan(0);
    const del = await owner.client.from("media_assets").delete().in("id", statics!.map((s) => s.id)).select();
    expect(del.data ?? []).toEqual([]);

    const forged = await editor.client
      .from("media_assets")
      .insert({ bucket: "static", path: "images/products/forged.jpg", mime_type: "image/jpeg" });
    expect(forged.error).not.toBeNull();
  });
});

describe("save_product", () => {
  const payload = (extra: Record<string, unknown> = {}) => ({
    slug: `test-${crypto.randomUUID().slice(0, 8)}`,
    type: "refill",
    name_ar: "عود",
    name_en: "Oud",
    spaces: ["majlis"],
    variants: [
      { sku: `RS-S-${crypto.randomUUID().slice(0, 6).toUpperCase()}`, label_ar: "200 مل", label_en: "200 ml", price_fils: 14500 },
    ],
    ...extra,
  });

  it("saves a product and its relations atomically", async () => {
    const { data: media } = await editor.client.from("media_assets").select("id").eq("bucket", "static").limit(2);
    const { data: category } = await editor.client.from("categories").select("id").eq("slug", "refills").single();
    const { data: id, error } = await editor.client.rpc("save_product", {
      payload: payload({ media: media!.map((m) => m.id), category_id: category!.id }),
    });
    expect(error).toBeNull();
    const { data } = await editor.client
      .from("products")
      .select("status, product_variants(price_fils), product_media(position), product_categories(is_primary)")
      .eq("id", id)
      .single();
    expect(data!.status).toBe("draft");
    expect(data!.product_variants).toEqual([{ price_fils: 14500 }]);
    expect(data!.product_media).toHaveLength(2);
    expect(data!.product_categories).toEqual([{ is_primary: true }]);
  });

  it("rolls back everything when one part is invalid", async () => {
    const bad = payload({ variants: [{ sku: "bad sku", label_ar: "x", label_en: "x", price_fils: 100 }] });
    const { error } = await editor.client.rpc("save_product", { payload: bad });
    expect(error).not.toBeNull();
    const { data } = await serviceClient().from("products").select("id").eq("slug", bad.slug);
    expect(data).toEqual([]);
  });

  it("is refused for roles without catalog.write", async () => {
    const { error } = await support.client.rpc("save_product", { payload: payload() });
    expect(error).not.toBeNull();
  });
});
