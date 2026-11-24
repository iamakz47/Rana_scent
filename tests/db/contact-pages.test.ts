import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anonClient, createStaff, createUser, serviceClient } from "./env";

// Contact messages and editable content pages, against the LOCAL stack under
// production-style privileges.

type Actor = { id: string; email: string; client: SupabaseClient };

let anon: SupabaseClient;
let service: SupabaseClient;
let customer: Actor;
let support: Actor;
let editor: Actor;
let finance: Actor;

const send = (client: SupabaseClient, extra: Record<string, string> = {}) =>
  client.rpc("submit_contact_message", {
    p_name: "Noura",
    p_email: "noura@example.test",
    p_phone: "",
    p_message: "Is the Rana Tower available in red?",
    p_locale: "ar",
    p_client_hash: crypto.randomUUID().replace(/-/g, ""),
    ...extra,
  });

beforeAll(async () => {
  anon = anonClient();
  service = serviceClient();
  customer = await createUser("cp-customer");
  support = await createStaff("cp-support", "support");
  editor = await createStaff("cp-editor", "editor");
  finance = await createStaff("cp-finance", "finance");
});

describe("contact messages", () => {
  it("visitors can send a message but never read the inbox", async () => {
    const { data: id, error } = await send(anon);
    expect(error).toBeNull();
    expect(typeof id).toBe("string");
    expect((await anon.from("contact_messages").select("id")).error).not.toBeNull();
    expect((await customer.client.from("contact_messages").select("id")).data).toEqual([]);
    const direct = await anon.from("contact_messages").insert({ name: "x", message: "hello there friend" });
    expect(direct.error).not.toBeNull();
  });

  it("validates the fields and needs an email or a phone number to reply to", async () => {
    expect((await send(anon, { p_name: "x" })).error?.message).toBe("contact_name");
    expect((await send(anon, { p_email: "", p_phone: "" })).error?.message).toBe("contact_reply_to");
    expect((await send(anon, { p_email: "not-an-email" })).error?.message).toBe("contact_email");
    expect((await send(anon, { p_email: "", p_phone: "12" })).error?.message).toBe("contact_phone");
    expect((await send(anon, { p_message: "short" })).error?.message).toBe("contact_message");
    expect((await send(anon, { p_email: "", p_phone: "+965 6612 3456" })).error).toBeNull();
  });

  it("refuses link spam and limits each sender to 5 messages an hour", async () => {
    const spam = "Cheap deals http://a.test http://b.test http://c.test www.d.test";
    expect((await send(anon, { p_message: spam })).error?.message).toBe("contact_spam");
    const hash = crypto.randomUUID().replace(/-/g, "");
    for (let i = 0; i < 5; i++) expect((await send(anon, { p_client_hash: hash })).error).toBeNull();
    expect((await send(anon, { p_client_hash: hash })).error?.message).toBe("contact_rate_limited");
  });

  it("customer staff read messages and mark them; other staff can't", async () => {
    const { data: id } = await send(anon, { p_name: "Status Test" });
    const { data: seen } = await support.client.from("contact_messages").select("id, status").eq("id", id).single();
    expect(seen).toEqual({ id, status: "new" });
    expect((await editor.client.from("contact_messages").select("id").eq("id", id)).data).toEqual([]);
    expect((await finance.client.from("contact_messages").select("id").eq("id", id)).data).toEqual([]);

    expect((await editor.client.rpc("set_contact_message_status", { p_id: id, p_status: "read" })).error?.code).toBe("42501");
    expect((await anon.rpc("set_contact_message_status", { p_id: id, p_status: "read" })).error).not.toBeNull();
    expect((await support.client.rpc("set_contact_message_status", { p_id: id, p_status: "archived" })).error).toBeNull();
    const { data: row } = await service.from("contact_messages").select("status, handled_by").eq("id", id).single();
    expect(row).toEqual({ status: "archived", handled_by: support.id });
    // Staff can't edit a message's text.
    const edit = await support.client.from("contact_messages").update({ message: "changed by staff" }).eq("id", id).select();
    expect(edit.data ?? []).toEqual([]);
  });
});

describe("content pages", () => {
  const content = (title: string) => ({
    title: { ar: `${title} ع`, en: title },
    lead: { ar: "", en: "" },
    body: { ar: "قصتنا:\nنص", en: "Our story:\nText" },
    items: [],
  });

  it("visitors only ever see published content", async () => {
    await service.from("site_pages").update({ published_at: null, published_content: null }).eq("key", "about");
    expect((await anon.rpc("get_site_page", { p_key: "about" })).data).toBeNull();
    expect((await editor.client.rpc("save_site_page_draft", { p_key: "about", p_content: content("Draft only") })).error).toBeNull();
    expect((await anon.rpc("get_site_page", { p_key: "about" })).data).toBeNull();
    expect((await anon.from("site_pages").select("key")).error).not.toBeNull();
  });

  it("content editors save and publish; a title is needed in both languages", async () => {
    await editor.client.rpc("save_site_page_draft", { p_key: "about", p_content: { ...content("x"), title: { ar: "", en: "About" } } });
    expect((await editor.client.rpc("publish_site_page", { p_key: "about" })).error?.message).toBe("page_incomplete");

    await editor.client.rpc("save_site_page_draft", { p_key: "about", p_content: content("About Rana") });
    expect((await editor.client.rpc("publish_site_page", { p_key: "about" })).error).toBeNull();
    const { data: page } = await anon.rpc("get_site_page", { p_key: "about" });
    expect(page.title).toEqual({ ar: "About Rana ع", en: "About Rana" });
    expect(page.published_at).toBeTruthy();

    // Later draft edits don't reach visitors until published again.
    await editor.client.rpc("save_site_page_draft", { p_key: "about", p_content: content("Changed") });
    expect((await anon.rpc("get_site_page", { p_key: "about" })).data.title.en).toBe("About Rana");

    expect((await editor.client.rpc("unpublish_site_page", { p_key: "about" })).error).toBeNull();
    expect((await anon.rpc("get_site_page", { p_key: "about" })).data).toBeNull();
  });

  it("only content editors can change pages", async () => {
    for (const actor of [support, finance, customer]) {
      expect((await actor.client.rpc("save_site_page_draft", { p_key: "faq", p_content: content("Nope") })).error?.code).toBe("42501");
      expect((await actor.client.rpc("publish_site_page", { p_key: "faq" })).error?.code).toBe("42501");
    }
    expect((await anon.rpc("save_site_page_draft", { p_key: "faq", p_content: content("Nope") })).error).not.toBeNull();
    expect((await editor.client.rpc("save_site_page_draft", { p_key: "terms", p_content: content("Nope") })).error?.code).toBe("P0002");
    expect((await editor.client.rpc("save_site_page_draft", { p_key: "faq", p_content: [] })).error?.code).toBe("22023");
  });
});
