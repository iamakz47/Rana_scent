import "server-only";

// Order emails through Resend's HTTP API (https://resend.com). Optional:
// without RESEND_API_KEY and ORDER_EMAIL_FROM, emails are skipped and the
// order flow is unaffected. Customers always see their order on the
// confirmation page, which doesn't depend on email.

export type OrderEmail = {
  to: string;
  locale: "ar" | "en";
  orderNumber: number;
  totalLabel: string;
  statusLabel: string;
  orderUrl: string;
};

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.ORDER_EMAIL_FROM);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function renderOrderEmail(email: OrderEmail): { subject: string; html: string; text: string } {
  const ar = email.locale === "ar";
  const subject = ar ? `رنا سنت: طلبك رقم ${email.orderNumber}` : `Rana Scent: your order #${email.orderNumber}`;
  const lines = ar
    ? [`شكرًا لطلبك من رنا سنت.`, `رقم الطلب: ${email.orderNumber}`, `الحالة: ${email.statusLabel}`, `الإجمالي: ${email.totalLabel}`]
    : [`Thank you for your order from Rana Scent.`, `Order: #${email.orderNumber}`, `Status: ${email.statusLabel}`, `Total: ${email.totalLabel}`];
  const cta = ar ? "عرض الطلب" : "View your order";
  const html = `<!doctype html><html lang="${email.locale}" dir="${ar ? "rtl" : "ltr"}"><body style="margin:0;background:#f8f5ef;color:#352a24;font-family:Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;padding:32px 24px">
<p style="font-size:22px;color:#7a5f33;margin:0 0 24px">${ar ? "رنا سنت" : "Rana Scent"}</p>
${lines.map((l) => `<p style="margin:0 0 10px;font-size:15px">${escapeHtml(l)}</p>`).join("")}
<p style="margin:28px 0"><a href="${escapeHtml(email.orderUrl)}" style="background:#352a24;color:#f8f5ef;padding:12px 22px;border-radius:999px;text-decoration:none">${cta}</a></p>
</div></body></html>`;
  return { subject, html, text: `${lines.join("\n")}\n\n${cta}: ${email.orderUrl}` };
}

export async function sendOrderEmail(email: OrderEmail): Promise<"sent" | "skipped" | "failed"> {
  if (!isEmailConfigured() || !email.to) return "skipped";
  const { subject, html, text } = renderOrderEmail(email);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.ORDER_EMAIL_FROM, to: [email.to], subject, html, text }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
