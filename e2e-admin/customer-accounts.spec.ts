import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { accounts, PASSWORD } from "./accounts";

// Customer accounts, guest-order linking, deletion, refunds and emails
// against the LOCAL stack (test payment provider, test email adapter).

let service: SupabaseClient;
const NEW_PASSWORD = "Fresh-Local-Pass2";

test.beforeAll(() => {
  const raw = execFileSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const env = JSON.parse(raw.slice(raw.indexOf("{"))) as Record<string, string>;
  service = createClient(env.API_URL, env.SECRET_KEY, { auth: { persistSession: false } });
});

const uniqueEmail = (label: string) => `${label}-${Math.random().toString(36).slice(2, 8)}@example.test`;

async function customerSignIn(page: Page, email: string, password = PASSWORD, lang: "en" | "ar" = "en") {
  await page.goto(`/${lang}/account/login`);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: lang === "en" ? "Sign in" : "تسجيل الدخول", exact: true }).click();
}

async function staffSignIn(page: Page, email: string) {
  await page.goto("/en/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/en\/admin$/);
}

async function confirmLink(email: string, type: "magiclink" | "recovery", next: string) {
  const { data, error } = await service.auth.admin.generateLink({ type, email });
  if (error) throw error;
  const otp = type === "recovery" ? "recovery" : "email";
  return `/en/account/confirm?token_hash=${data.properties.hashed_token}&type=${otp}&next=${encodeURIComponent(next)}`;
}

async function addToCart(page: Page) {
  await page.goto("/en/products/fixture-aura");
  await page.getByRole("button", { name: /add to cart/i }).first().click();
  await expect(page.locator("dialog[open]")).toBeVisible();
}

async function placeCodOrder(page: Page, { email = "", fill = true } = {}) {
  await addToCart(page);
  await page.goto("/en/checkout");
  if (fill) {
    await page.locator("#customer_name").fill("Account Buyer");
    await page.locator("#phone").fill("6612 3456");
    await page.locator("#governorate").selectOption("hawalli");
    await page.locator("#area").fill("Salmiya");
    await page.locator("#block").fill("10");
    await page.locator("#street").fill("Salem Al Mubarak");
    await page.locator("#building").fill("12");
  }
  if (email) await page.locator("#email").fill(email);
  await page.getByRole("radio", { name: /cash on delivery/i }).click();
  await page.getByRole("button", { name: "Place order" }).click();
  await page.waitForURL(/\/en\/order\?/);
  return page.url();
}

test.describe("customer accounts", () => {
  test("sign-up needs a verified email and never reveals existing accounts", async ({ page }) => {
    const email = uniqueEmail("signup");
    await page.goto("/en/account/register");
    await page.locator("#full_name").fill("New Customer");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(PASSWORD);
    await page.locator("#confirm").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Check your email")).toBeVisible();

    // The verification email was recorded (without its link).
    const { data: logged } = await service.from("email_messages").select("kind, status").eq("to_email", email);
    expect(logged).toEqual([{ kind: "account_verification", status: "sent" }]);

    // Not verified yet: sign-in is refused and a new link is sent.
    await customerSignIn(page, email);
    await expect(page.getByText("Please confirm your email first")).toBeVisible();

    // Registering again with the same email gives the same answer.
    await page.goto("/en/account/register");
    await page.locator("#full_name").fill("Someone Else");
    await page.locator("#email").fill(accounts.customer);
    await page.locator("#password").fill(PASSWORD);
    await page.locator("#confirm").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Check your email")).toBeVisible();

    // Following the link confirms the email and signs the customer in.
    await page.goto(await confirmLink(email, "magiclink", "/account"));
    await expect(page.getByText("Your email is confirmed")).toBeVisible();
    await expect(page.locator("#full_name")).toHaveValue("New Customer");
  });

  test("wrong passwords and unknown emails get the same message", async ({ page }) => {
    await customerSignIn(page, accounts.customer, "Wrong-Password-1");
    await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
    await customerSignIn(page, uniqueEmail("nobody"), "Wrong-Password-1");
    await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
  });

  test("password reset by email link", async ({ page }) => {
    const email = uniqueEmail("reset");
    await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    await page.goto("/en/account/forgot-password");
    await page.locator("#email").fill(email);
    await page.getByRole("button", { name: "Send link" }).click();
    await expect(page.getByText("Check your email")).toBeVisible();
    await page.goto(await confirmLink(email, "recovery", "/account/reset-password"));
    await page.locator("#password").fill(NEW_PASSWORD);
    await page.locator("#confirm").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Save new password" }).click();
    await expect(page.getByText("Your password was updated.")).toBeVisible();
    await page.context().clearCookies();
    await customerSignIn(page, email, NEW_PASSWORD);
    await page.waitForURL(/\/en\/account$/);
  });

  test("profile, addresses, prefilled checkout and order history", async ({ page }) => {
    await customerSignIn(page, accounts.customer);
    await page.waitForURL(/\/en\/account$/);
    await page.locator("#full_name").fill("Account Customer");
    await page.locator("#phone").fill("12");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("valid Kuwaiti mobile number")).toBeVisible();
    await page.locator("#phone").fill("5512 3456");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Profile saved.")).toBeVisible();

    await page.goto("/en/account/addresses");
    for (const label of ["Home", "Office"]) {
      await page.getByRole("button", { name: "Add address" }).click();
      await page.locator("#new-label").fill(label);
      await page.locator("#new-recipient").fill(`${label} Recipient`);
      await page.locator("#new-phone").fill("6612 3456");
      await page.locator("#new-governorate").selectOption("hawalli");
      await page.locator("#new-area").fill("Salmiya");
      await page.locator("#new-block").fill("10");
      await page.locator("#new-street").fill(`${label} Street`);
      await page.locator("#new-building").fill("12");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByRole("heading", { name: label })).toBeVisible();
    }
    const office = page.locator("article").filter({ hasText: "Office Recipient" });
    await office.getByRole("button", { name: "Make default" }).click();
    await expect(office.getByText("Default", { exact: true })).toBeVisible();

    // Checkout starts from the default address.
    await addToCart(page);
    await page.goto("/en/checkout");
    await expect(page.locator("#street")).toHaveValue("Office Street");
    await expect(page.locator("#customer_name")).toHaveValue("Office Recipient");
    await page.getByRole("radio", { name: /cash on delivery/i }).click();
    await page.getByRole("button", { name: "Place order" }).click();
    await page.waitForURL(/\/en\/order\?/);
    const number = (await page.getByRole("heading", { level: 1 }).innerText()).match(/\d+/)![0];

    await page.goto("/en/account/orders");
    await expect(page.getByText(`Order #${number}`)).toBeVisible();

    // Delete the home address.
    await page.goto("/en/account/addresses");
    page.once("dialog", (d) => d.accept());
    await page.locator("article").filter({ hasText: "Home Recipient" }).getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Home Recipient")).toHaveCount(0);
  });

  test("a guest order is linked only with its link and the matching verified email", async ({ page, browser }) => {
    const email = uniqueEmail("claimer");
    await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    const orderUrl = await placeCodOrder(page, { email });
    const number = orderUrl.match(/n=(\d+)/)![1];

    // A different signed-in customer can't take it.
    const other = await browser.newPage();
    await customerSignIn(other, accounts.customer);
    await other.waitForURL(/\/en\/account$/);
    await other.goto(orderUrl);
    await other.getByRole("button", { name: "Add to my account" }).click();
    await expect(other.getByText("can't be added to your account")).toBeVisible();

    // The owner of the email can.
    await customerSignIn(page, email);
    await page.waitForURL(/\/en\/account$/);
    await page.goto(orderUrl);
    await page.getByRole("button", { name: "Add to my account" }).click();
    await expect(page.getByText("This order is now in your account.")).toBeVisible();
    await page.goto("/en/account/orders");
    await expect(page.getByText(`Order #${number}`)).toBeVisible();
  });

  test("account deletion: requested by the customer, completed by support", async ({ page, browser }) => {
    const email = uniqueEmail("leaver");
    await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    await customerSignIn(page, email);
    await page.waitForURL(/\/en\/account$/);
    page.once("dialog", (d) => d.accept());
    await page.locator("#delete-reason").fill("Moving abroad");
    await page.getByRole("button", { name: "Request account deletion" }).click();
    await expect(page.getByText("Request received.")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Your deletion request is being reviewed.")).toBeVisible();

    const staff = await browser.newPage();
    await staffSignIn(staff, accounts.support);
    await staff.goto("/en/admin/customers");
    const row = staff.locator("li").filter({ hasText: email });
    staff.once("dialog", (d) => d.accept());
    await row.getByRole("button", { name: "Delete account" }).click();
    await expect(staff.locator("li").filter({ hasText: email })).toHaveCount(0);

    await page.context().clearCookies();
    await customerSignIn(page, email);
    await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
  });

  test("account pages work in Arabic on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await customerSignIn(page, accounts.customer, PASSWORD, "ar");
    await page.waitForURL(/\/ar\/account$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "حسابي", exact: true })).toBeVisible();
    for (const path of ["/ar/account", "/ar/account/orders", "/ar/account/addresses"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(1);
    }
  });

  test("signed-out visitors are sent to sign in", async ({ page }) => {
    for (const path of ["/en/account", "/en/account/orders", "/en/account/addresses"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/en\/account\/login\?next=/);
    }
  });
});

test.describe("refunds and emails in the admin", () => {
  test("finance refunds a paid order through the provider, once; emails are recorded", async ({ page, browser }) => {
    // Pay online with the test provider.
    await addToCart(page);
    await page.goto("/en/checkout");
    await page.locator("#customer_name").fill("Refund Buyer");
    await page.locator("#phone").fill("5512 3456");
    await page.locator("#email").fill(uniqueEmail("refund"));
    await page.locator("#governorate").selectOption("hawalli");
    await page.locator("#area").fill("Salmiya");
    await page.locator("#block").fill("10");
    await page.locator("#street").fill("Salem Al Mubarak");
    await page.locator("#building").fill("12");
    await page.getByRole("button", { name: "Continue to payment" }).click();
    await page.waitForURL(/test-payment/);
    await page.getByRole("button", { name: "Approve payment" }).click();
    await page.waitForURL(/\/en\/order\?/);
    const number = (await page.getByRole("heading", { level: 1 }).innerText()).match(/\d+/)![0];

    const owner = await browser.newPage();
    await staffSignIn(owner, accounts.owner);
    await owner.goto(`/en/admin/orders?q=${number}`);
    await owner.getByRole("link", { name: new RegExp(`#${number}`) }).click();
    await owner.locator("#refund-amount").fill("5.000");
    await owner.locator("#refund-reason").fill("Damaged box");
    await owner.getByRole("button", { name: "Request refund" }).click();
    await expect(owner.getByText("Refund requested.")).toBeVisible();
    await owner.reload();
    owner.once("dialog", (d) => d.accept());
    await owner.getByRole("button", { name: "Refund through the payment provider" }).click();
    // The request moves to "Refunded" and can't be sent again.
    await expect(owner.getByText(/Refunded\s*Damaged box/)).toBeVisible();
    await owner.reload();
    await expect(owner.getByText(/Partially refunded/)).toBeVisible();
    await expect(owner.getByRole("button", { name: "Refund through the payment provider" })).toHaveCount(0);

    // Emails for this order were queued and sent through the test adapter.
    await expect(owner.getByText("Payment confirmed").first()).toBeVisible();
    await expect(owner.getByText("Refund completed").first()).toBeVisible();

    // The customer sees the refund on the order page.
    await page.reload();
    await expect(page.getByText(/has been refunded/)).toBeVisible();
  });

  test("the owner sets the staff alert email", async ({ page }) => {
    await staffSignIn(page, accounts.owner);
    await page.goto("/en/admin/settings");
    await expect(page.getByText("Test mode: emails are recorded but not delivered")).toBeVisible();
    await page.locator("#staff_email").fill("alerts@example.test");
    await page.getByRole("button", { name: "Save", exact: true }).nth(1).click();
    await expect(page.getByText("Notification settings saved.")).toBeVisible();
    const { data } = await service.from("notification_settings").select("staff_email").eq("id", 1).single();
    expect(data!.staff_email).toBe("alerts@example.test");
  });
});
