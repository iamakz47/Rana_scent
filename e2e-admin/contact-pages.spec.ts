import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CRON_SECRET } from "../playwright.admin.config";
import { accounts, PASSWORD } from "./accounts";

// The contact form and Admin → Messages, and the editable About, Contact and
// FAQ pages (Admin → Pages), against the LOCAL stack.

let db: SupabaseClient;
const tag = Math.random().toString(36).slice(2, 7);

async function staffSignIn(page: Page, email: string) {
  await page.goto("/en/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/en\/admin(\?.*)?$/);
}

async function refresh(page: Page) {
  const res = await page.request.post("/api/revalidate", { headers: { Authorization: `Bearer ${CRON_SECRET}` } });
  expect(res.status()).toBe(200);
}

test.beforeAll(async () => {
  const raw = execFileSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const env = JSON.parse(raw.slice(raw.indexOf("{"))) as Record<string, string>;
  db = createClient(env.API_URL, env.SECRET_KEY, { auth: { persistSession: false } });
  await db.from("store_settings").update({ contact_phone: "+965 2222 3333", whatsapp_number: "66123456", contact_email: "hello@rana.test" }).eq("id", 1);
  // Pages start from their built-in text.
  await db.from("site_pages").update({ draft_content: {}, published_content: null, published_at: null }).in("key", ["about", "faq"]);
});

test.describe.serial("contact", () => {
  test("WhatsApp, call and email buttons come from the store settings, also in the footer", async ({ page }) => {
    await refresh(page);
    await page.goto("/en/contact");
    const buttons = page.getByTestId("contact-buttons");
    await expect(buttons.getByRole("link", { name: "Chat on WhatsApp" })).toHaveAttribute("href", "https://wa.me/96566123456");
    await expect(buttons.getByRole("link", { name: "Call us" })).toHaveAttribute("href", "tel:+96522223333");
    await expect(buttons.getByRole("link", { name: "Email us" })).toHaveAttribute("href", "mailto:hello@rana.test");
    await expect(page.getByTestId("footer-contact").getByRole("link", { name: "Chat on WhatsApp" })).toBeVisible();
    await page.goto("/ar/contact");
    await expect(page.getByTestId("contact-buttons").getByRole("link", { name: "تواصل عبر واتساب" })).toBeVisible();
  });

  test("a visitor sends a message; mistakes keep what they typed", async ({ page }) => {
    await page.goto("/en/contact");
    await page.waitForLoadState("networkidle");
    const form = page.getByTestId("contact-form");
    await form.getByLabel("Name").fill(`Visitor ${tag}`);
    await form.getByLabel("Message").fill(`Is the Rana Tower available in red? (${tag})`);
    // A person takes a few seconds; faster submissions are treated as bots.
    await page.waitForTimeout(3200);
    await form.getByRole("button", { name: "Send message" }).click();
    await expect(form.getByRole("alert")).toContainText("Please leave an email or a phone number");
    await expect(form.getByLabel("Message")).toHaveValue(`Is the Rana Tower available in red? (${tag})`);

    await form.getByLabel("Phone (optional)").fill("6612 3456");
    await form.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByTestId("contact-sent")).toContainText("Your message has reached us");
    await expect.poll(async () => (await db.from("contact_messages").select("phone, status").eq("name", `Visitor ${tag}`)).data).toEqual([
      { phone: "6612 3456", status: "new" },
    ]);
  });

  test("bots that fill the hidden field get no message through", async ({ page }) => {
    await page.goto("/ar/contact");
    await page.waitForLoadState("networkidle");
    const form = page.getByTestId("contact-form");
    await form.getByLabel("الاسم").fill(`Bot ${tag}`);
    await form.getByLabel("البريد الإلكتروني (اختياري)").fill("bot@example.test");
    await form.getByLabel("الرسالة").fill("Buy followers now, best price guaranteed");
    await page.locator('input[name="website"]').fill("https://spam.test", { force: true });
    await page.waitForTimeout(3200);
    await form.getByRole("button", { name: "إرسال الرسالة" }).click();
    await expect(page.getByTestId("contact-sent")).toBeVisible();
    expect((await db.from("contact_messages").select("id").eq("name", `Bot ${tag}`)).data).toEqual([]);
  });

  test("support reads, replies to and archives messages in Admin → Messages; editors can't see them", async ({ page, browser }) => {
    await staffSignIn(page, accounts.support);
    await page.goto("/en/admin/messages");
    const message = page.getByTestId("message").filter({ hasText: `Visitor ${tag}` });
    await expect(message).toContainText(`Is the Rana Tower available in red? (${tag})`);
    await expect(message.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/96566123456");
    await expect(message.getByRole("link", { name: "Call" })).toHaveAttribute("href", "tel:+96566123456");
    await message.getByRole("button", { name: "Mark as read" }).click();
    await expect(page.getByTestId("message").filter({ hasText: `Visitor ${tag}` })).toHaveCount(0);
    await page.goto("/en/admin/messages?status=read");
    const read = page.getByTestId("message").filter({ hasText: `Visitor ${tag}` });
    await read.getByRole("button", { name: "Archive" }).click();
    await expect(read).toHaveCount(0);
    await page.goto("/en/admin/messages?status=archived");
    await expect(page.getByTestId("message").filter({ hasText: `Visitor ${tag}` })).toHaveCount(1);

    const editor = await browser.newPage();
    await staffSignIn(editor, accounts.editor);
    await editor.goto("/en/admin/messages");
    await expect(editor).toHaveURL(/denied=1/);
  });
});

test.describe.serial("content pages", () => {
  test("the FAQ starts from the built-in questions; the editor adds, reorders and removes, then publishes", async ({ page, browser }) => {
    await staffSignIn(page, accounts.editor);
    await page.goto("/en/admin/pages/faq");
    await expect(page.getByText("Filled in from the built-in text.")).toBeVisible();
    const questions = page.getByTestId("faq-question");
    await expect(questions).toHaveCount(5);

    await page.getByRole("button", { name: "+ Add question" }).click();
    await expect(questions).toHaveCount(6);
    await questions.nth(5).getByLabel("Question 6").fill(`هل التوصيل مجاني؟ ${tag}`);
    await questions.nth(5).getByLabel("Answer").fill("نعم، للطلبات فوق 50 د.ك.\nخلال يومين.");
    await page.getByRole("tab", { name: "English" }).click();
    await questions.nth(5).getByLabel("Question 6").fill(`Is delivery free? ${tag}`);
    await questions.nth(5).getByLabel("Answer").fill("Yes, on orders over KWD 50.\nWithin two days.");
    // Move it to the top, and remove the old last question.
    for (let i = 0; i < 5; i++) await questions.nth(5 - i).getByRole("button", { name: "Move up" }).click();
    await questions.nth(5).getByRole("button", { name: "Remove" }).click();
    await expect(questions).toHaveCount(5);
    await expect(page.getByTestId("page-preview")).toContainText(`Is delivery free? ${tag}`);

    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft saved.")).toBeVisible();
    // A saved draft is not public yet.
    const visitor = await browser.newPage();
    await visitor.goto("/en/faq");
    await expect(visitor.getByText(`Is delivery free? ${tag}`)).toHaveCount(0);

    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("Page published.")).toBeVisible();
    await visitor.goto("/en/faq");
    await expect(visitor.getByTestId("faq-item")).toHaveCount(5);
    await expect(visitor.getByTestId("faq-item").first()).toContainText(`Is delivery free? ${tag}`);
    await visitor.goto("/ar/faq");
    await expect(visitor.getByTestId("faq-item").first()).toContainText(`هل التوصيل مجاني؟ ${tag}`);
  });

  test("About us: edit the text, publish, then go back to the built-in text", async ({ page, browser }) => {
    await staffSignIn(page, accounts.editor);
    await page.goto("/en/admin/pages/about");
    await page.getByLabel("Page text").fill(`قصتنا:\nبدأت رنا سنت في الكويت. ${tag}\n\n1. عطور مختارة\n2. أجهزة أنيقة`);
    await page.getByRole("tab", { name: "English" }).click();
    await page.getByLabel("Page title").fill("About Rana Scent");
    await page.getByLabel("Page text").fill(`Our story:\nRana Scent began in Kuwait. ${tag}\n\n1. Chosen fragrances\n2. Elegant devices`);
    // Publishing publishes what is on screen (it saves first).
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("Page published.")).toBeVisible();

    const visitor = await browser.newPage();
    await visitor.goto("/en/about");
    await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("About Rana Scent");
    const body = visitor.getByTestId("page-body");
    await expect(body.getByRole("heading", { name: "Our story:" })).toBeVisible();
    await expect(body.locator("ol > li")).toHaveCount(2);
    await expect(visitor.getByRole("note")).toHaveCount(0);
    await visitor.goto("/ar/about");
    await expect(visitor.getByTestId("page-body")).toContainText(`بدأت رنا سنت في الكويت. ${tag}`);

    await page.getByRole("button", { name: "Back to built-in text" }).click();
    await expect(page.getByText("The page shows its built-in text again.")).toBeVisible();
    await visitor.goto("/en/about");
    await expect(visitor.getByTestId("page-body")).toHaveCount(0);
    await expect(visitor.getByRole("note")).toBeVisible();
  });

  test("support staff can't edit pages; the editor works on a phone", async ({ page, browser }) => {
    const support = await browser.newPage();
    await staffSignIn(support, accounts.support);
    await support.goto("/en/admin/pages");
    await expect(support).toHaveURL(/denied=1/);

    await page.setViewportSize({ width: 390, height: 844 });
    await staffSignIn(page, accounts.editor);
    for (const path of ["/en/admin/pages", "/en/admin/pages/faq", "/ar/admin/pages/about"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), path).toBeLessThanOrEqual(1);
    }
  });
});
