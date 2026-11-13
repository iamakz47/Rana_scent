import { expect, test, type Page } from "@playwright/test";
import { accounts, PASSWORD } from "./accounts";

// Customer purchase and staff fulfilment against the LOCAL stack with the
// test payment provider (no money moves).

async function signIn(page: Page, email: string) {
  await page.goto("/en/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/en\/admin$/);
}

async function addToCart(page: Page, lang: "en" | "ar" = "en") {
  await page.goto(`/${lang}/products/fixture-aura`);
  await page.getByRole("button", { name: lang === "en" ? /add to cart/i : /أضف إلى السلة/ }).first().click();
  await expect(page.locator("dialog[open]")).toBeVisible();
}

async function fillCheckout(page: Page, { cod = false, phone = "5512 3456" } = {}) {
  await page.goto("/en/checkout");
  await page.locator("#customer_name").fill("E2E Buyer");
  await page.locator("#phone").fill(phone);
  await page.locator("#governorate").selectOption("hawalli");
  await page.locator("#area").fill("Salmiya");
  await page.locator("#block").fill("10");
  await page.locator("#street").fill("Salem Al Mubarak");
  await page.locator("#building").fill("12");
  if (cod) await page.getByRole("radio", { name: /cash on delivery/i }).click();
  await expect(page.locator("#checkout-summary").locator("..")).toContainText("KWD 31.000");
}

test.describe("customer purchase", () => {
  test("pays online and staff fulfil the order to delivery", async ({ page, browser }) => {
    await addToCart(page);
    await fillCheckout(page);
    await page.getByRole("button", { name: "Continue to payment" }).click();
    await page.waitForURL(/test-payment/);
    await expect(page.getByText("KWD 31.000").filter({ visible: true })).toBeVisible();
    await page.getByRole("button", { name: "Approve payment" }).click();
    await page.waitForURL(/\/en\/order\?/);
    await expect(page.getByText("Payment confirmed")).toBeVisible();
    const number = (await page.getByRole("heading", { level: 1 }).innerText()).match(/\d+/)![0];
    const orderUrl = page.url();
    expect(await page.evaluate(() => localStorage.getItem("rana-cart-v1"))).toBe("[]");

    const staff = await browser.newPage();
    await signIn(staff, accounts.support);
    await staff.goto(`/en/admin/orders?q=${number}`);
    await staff.getByRole("link", { name: new RegExp(`#${number}`) }).click();
    await expect(staff.getByText("Captured")).toBeVisible();
    for (const next of ["Processing", "Ready for delivery", "Out for delivery"]) {
      await staff.getByRole("button", { name: `Move to: ${next}` }).click();
      await expect(staff.getByText("Status updated.")).toBeVisible();
      await staff.reload();
    }
    await staff.getByLabel("Courier").fill("Rana Fleet");
    await staff.getByLabel("Tracking number").fill("RS-E2E-1");
    await staff.getByRole("button", { name: "Save", exact: true }).click();
    await expect(staff.getByText("Delivery details saved.")).toBeVisible();
    await staff.getByLabel("Internal note").fill("Customer asked to call on arrival");
    await staff.getByRole("button", { name: "Add note" }).click();
    await expect(staff.getByText("Note added.")).toBeVisible();
    await staff.getByRole("button", { name: "Move to: Delivered" }).click();
    // Delivered is final: the actions disappear and the status badge updates.
    await expect(staff.getByRole("button", { name: /Move to:/ })).toHaveCount(0);
    await expect(staff.getByText("Delivered", { exact: true }).first()).toBeVisible();

    await page.goto(orderUrl);
    await expect(page.getByText("DELIVERED", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("RS-E2E-1")).toBeVisible();
    await expect(page.getByText("Customer asked to call")).toHaveCount(0);
  });

  test("a declined payment cancels the order and keeps the cart", async ({ page }) => {
    await addToCart(page);
    await fillCheckout(page);
    await page.getByRole("button", { name: "Continue to payment" }).click();
    await page.waitForURL(/test-payment/);
    await page.getByRole("button", { name: "Decline payment" }).click();
    await page.waitForURL(/\/en\/order\?/);
    await expect(page.getByText("The payment didn't go through")).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("rana-cart-v1") ?? "[]").length)).toBe(1);
  });

  test("cash on delivery, with invalid input caught first", async ({ page }) => {
    await addToCart(page);
    await fillCheckout(page, { cod: true, phone: "1234" });
    await page.locator("#customer_name").click();
    await expect(page.getByText("valid Kuwaiti mobile number")).toBeVisible();
    await page.locator("#phone").fill("6612 3456");
    await page.getByRole("button", { name: "Place order" }).click();
    await page.waitForURL(/\/en\/order\?/);
    await expect(page.getByText("You'll pay in cash when your order arrives.")).toBeVisible();
  });

  test("a discount code created in the admin applies at checkout", async ({ page, browser }) => {
    const code = `E2E${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const admin = await browser.newPage();
    await signIn(admin, accounts.manager);
    await admin.goto("/en/admin/promotions");
    await admin.locator("#new-code").fill(code);
    await admin.locator("#new-value").fill("10");
    await admin.getByRole("button", { name: "Save code" }).first().click();
    await expect(admin.getByText("Code saved.")).toBeVisible();

    await addToCart(page);
    await fillCheckout(page);
    await page.getByPlaceholder("Discount code").fill(code.toLowerCase());
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("Code applied")).toBeVisible();
    await expect(page.locator("#checkout-summary").locator("..")).toContainText("KWD 28.100");
    await page.getByPlaceholder("Discount code").fill("");
    await page.getByRole("button", { name: "Remove" }).click();
    await page.getByPlaceholder("Discount code").fill("NOTACODE");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("This discount code isn't valid.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue to payment" })).toBeDisabled();
  });

  test("checkout fits a phone screen in Arabic", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await addToCart(page, "ar");
    await page.goto("/ar/checkout");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "إتمام الطلب" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe("commerce permissions", () => {
  test("editors can't reach orders, finance or delivery settings", async ({ page }) => {
    await signIn(page, accounts.editor);
    for (const path of ["/en/admin/orders", "/en/admin/finance", "/en/admin/settings", "/en/admin/customers"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/en\/admin\?denied=1/);
    }
  });

  test("support can manage orders but not finance or settings", async ({ page }) => {
    await signIn(page, accounts.support);
    await page.goto("/en/admin/orders");
    await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
    for (const path of ["/en/admin/finance", "/en/admin/settings", "/en/admin/promotions"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/en\/admin\?denied=1/);
    }
  });

  test("the owner can switch cash on delivery off and checkout follows", async ({ page, browser }) => {
    const owner = await browser.newPage();
    await signIn(owner, accounts.owner);
    await owner.goto("/en/admin/settings");
    await owner.getByLabel("Cash on delivery").uncheck();
    await owner.getByRole("button", { name: "Save", exact: true }).first().click();
    await expect(owner.getByText("Checkout settings saved.")).toBeVisible();

    await addToCart(page);
    await page.goto("/en/checkout");
    await expect(page.getByRole("radio", { name: /cash on delivery/i })).toHaveCount(0);

    await owner.getByLabel("Cash on delivery").check();
    await owner.getByRole("button", { name: "Save", exact: true }).first().click();
    await expect(owner.getByText("Checkout settings saved.")).toBeVisible();
  });
});
