import type { Locale } from "@/i18n/config";
import { formatKWD } from "@/lib/money";

// Bilingual transactional email templates (pure functions, no I/O).
// Table-based layout with inline styles so they render in Gmail, Outlook and
// Apple Mail, and stack on phones. Every dynamic value is HTML-escaped.
// No payment card data is ever included: only the order, its totals and
// the method name (e.g. "KNET").

export const customerKinds = [
  "order_confirmation",
  "payment_succeeded",
  "payment_failed",
  "order_processing",
  "order_ready_for_delivery",
  "order_out_for_delivery",
  "order_delivered",
  "order_cancelled",
  "refund_initiated",
  "refund_completed",
] as const;
export const staffKinds = [
  "staff_new_paid_order",
  "staff_new_cod_order",
  "staff_payment_attention",
  "staff_refund_requested",
  "staff_low_stock",
] as const;
export const accountKinds = ["account_verification", "password_reset", "account_exists"] as const;
export type EmailKind = (typeof customerKinds)[number] | (typeof staffKinds)[number] | (typeof accountKinds)[number];

export type EmailOrder = {
  number: number;
  customerName: string;
  phone: string;
  paymentMethod: "tap" | "cod";
  paymentLabel?: string | null;
  subtotalFils: number;
  discountFils: number;
  shippingFils: number;
  totalFils: number;
  refundedFils: number;
  items: Array<{ name: string; label: string; quantity: number; lineTotalFils: number }>;
  address: { governorate: string; area: string; block: string; street: string; avenue?: string; building: string; floor?: string; apartment?: string };
  courier?: string;
  trackingNumber?: string;
  estimatedDelivery?: string | null;
};

export type EmailContext = {
  locale: Locale;
  order?: EmailOrder;
  orderUrl?: string;
  adminUrl?: string;
  actionUrl?: string;
  refundFils?: number;
  reason?: string;
  expired?: boolean;
  stock?: { sku: string; name: string; onHand: number; threshold: number };
  storeUrl?: string;
};

export type RenderedEmail = { subject: string; html: string; text: string };

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const governorateNames: Record<string, { ar: string; en: string }> = {
  capital: { ar: "العاصمة", en: "Capital" },
  hawalli: { ar: "حولي", en: "Hawalli" },
  farwaniya: { ar: "الفروانية", en: "Farwaniya" },
  ahmadi: { ar: "الأحمدي", en: "Ahmadi" },
  jahra: { ar: "الجهراء", en: "Jahra" },
  mubarak_al_kabeer: { ar: "مبارك الكبير", en: "Mubarak Al-Kabeer" },
};

const L = {
  ar: {
    brand: "رنا سنت",
    tagline: "عطور منزلية فاخرة",
    hello: (name: string) => (name ? `مرحبًا ${name}،` : "مرحبًا،"),
    order: (n: number) => `الطلب رقم ${n}`,
    viewOrder: "عرض الطلب وتتبعه",
    items: "المنتجات",
    qty: "الكمية",
    subtotal: "المجموع الفرعي",
    discount: "الخصم",
    delivery: "التوصيل",
    free: "مجاني",
    total: "الإجمالي",
    refunded: "المبلغ المسترد",
    deliverTo: "عنوان التوصيل",
    payment: "طريقة الدفع",
    cod: "الدفع عند الاستلام",
    online: "دفع إلكتروني",
    tracking: "رقم التتبع",
    courier: "شركة التوصيل",
    eta: "موعد التوصيل المتوقع",
    help: "لأي استفسار، رُدّ على هذه الرسالة أو تواصل معنا عبر الموقع.",
    footer: "تلقيت هذه الرسالة لأنك أجريت طلبًا أو أنشأت حسابًا لدى رنا سنت. لا نطلب منك أبدًا بيانات بطاقتك عبر البريد.",
    block: "قطعة",
    street: "شارع",
    avenue: "جادة",
    building: "مبنى",
    floor: "دور",
    apartment: "شقة",
    openAdmin: "فتح الطلب في لوحة الإدارة",
  },
  en: {
    brand: "Rana Scent",
    tagline: "Luxury home fragrance",
    hello: (name: string) => (name ? `Hello ${name},` : "Hello,"),
    order: (n: number) => `Order #${n}`,
    viewOrder: "View and track your order",
    items: "Items",
    qty: "Qty",
    subtotal: "Subtotal",
    discount: "Discount",
    delivery: "Delivery",
    free: "Free",
    total: "Total",
    refunded: "Refunded",
    deliverTo: "Delivery address",
    payment: "Payment",
    cod: "Cash on delivery",
    online: "Online payment",
    tracking: "Tracking number",
    courier: "Courier",
    eta: "Estimated delivery",
    help: "Questions? Reply to this email or contact us through the website.",
    footer: "You received this email because you placed an order or created an account with Rana Scent. We never ask for your card details by email.",
    block: "Block",
    street: "Street",
    avenue: "Avenue",
    building: "Building",
    floor: "Floor",
    apartment: "Apartment",
    openAdmin: "Open the order in the admin",
  },
} as const;

type Copy = { subject: string; heading: string; body: string[]; cta?: { label: string; url?: string } };

function copyFor(kind: EmailKind, ctx: EmailContext): Copy {
  const ar = ctx.locale === "ar";
  const t = L[ctx.locale];
  const n = ctx.order?.number ?? 0;
  const money = (fils: number) => formatKWD(fils, ctx.locale);
  const orderCta = { label: t.viewOrder, url: ctx.orderUrl };
  const adminCta = { label: t.openAdmin, url: ctx.adminUrl };
  switch (kind) {
    case "order_confirmation":
      return ar
        ? { subject: `تم استلام طلبك رقم ${n} من رنا سنت`, heading: "شكرًا لطلبك", body: ["استلمنا طلبك وسنبدأ بتجهيزه قريبًا. ستدفع نقدًا عند وصول الطلب."], cta: orderCta }
        : { subject: `We've received your Rana Scent order #${n}`, heading: "Thank you for your order", body: ["We've received your order and will start preparing it shortly. You'll pay in cash when it arrives."], cta: orderCta };
    case "payment_succeeded":
      return ar
        ? { subject: `تم تأكيد الدفع لطلبك رقم ${n}`, heading: "تم الدفع بنجاح", body: ["شكرًا لك، تم استلام دفعتك وتأكيد طلبك. سنُعلمك عند تجهيزه وشحنه."], cta: orderCta }
        : { subject: `Payment confirmed for order #${n}`, heading: "Payment received", body: ["Thank you. Your payment was received and your order is confirmed. We'll let you know as it's prepared and sent out."], cta: orderCta };
    case "payment_failed":
      return ar
        ? { subject: `لم يكتمل الدفع للطلب رقم ${n}`, heading: "لم يكتمل الدفع", body: [ctx.expired ? "انتهت مهلة الدفع لهذا الطلب، لذلك أُلغي ولم يُخصم أي مبلغ." : "لم تنجح عملية الدفع، لذلك أُلغي الطلب ولم يُخصم أي مبلغ.", "يمكنك إعادة المحاولة من سلة التسوق في أي وقت."], cta: { label: "العودة إلى المتجر", url: ctx.storeUrl } }
        : { subject: `Payment for order #${n} didn't go through`, heading: "Your payment didn't go through", body: [ctx.expired ? "The time to pay for this order ran out, so it was cancelled and you were not charged." : "The payment wasn't completed, so the order was cancelled and you were not charged.", "You can try again from your cart at any time."], cta: { label: "Back to the store", url: ctx.storeUrl } };
    case "order_processing":
      return ar
        ? { subject: `نجهّز طلبك رقم ${n}`, heading: "طلبك قيد التجهيز", body: ["بدأنا بتجهيز طلبك بعناية."], cta: orderCta }
        : { subject: `We're preparing order #${n}`, heading: "Your order is being prepared", body: ["We've started preparing your order with care."], cta: orderCta };
    case "order_ready_for_delivery":
      return ar
        ? { subject: `طلبك رقم ${n} جاهز للتوصيل`, heading: "طلبك جاهز للتوصيل", body: ["تم تغليف طلبك وهو بانتظار المندوب."], cta: orderCta }
        : { subject: `Order #${n} is ready for delivery`, heading: "Your order is ready for delivery", body: ["Your order is packed and waiting for the courier."], cta: orderCta };
    case "order_out_for_delivery":
      return ar
        ? { subject: `طلبك رقم ${n} في الطريق إليك`, heading: "طلبك في الطريق", body: ["المندوب في طريقه إليك. يُرجى إبقاء هاتفك متاحًا."], cta: orderCta }
        : { subject: `Order #${n} is out for delivery`, heading: "Your order is on its way", body: ["The courier is on the way. Please keep your phone nearby."], cta: orderCta };
    case "order_delivered":
      return ar
        ? { subject: `تم توصيل طلبك رقم ${n}`, heading: "تم التوصيل", body: ["نتمنى أن تستمتع بعطورك الجديدة. شكرًا لاختيارك رنا سنت."], cta: orderCta }
        : { subject: `Order #${n} has been delivered`, heading: "Delivered", body: ["We hope you enjoy your new scents. Thank you for choosing Rana Scent."], cta: orderCta };
    case "order_cancelled":
      return ar
        ? { subject: `تم إلغاء طلبك رقم ${n}`, heading: "تم إلغاء الطلب", body: ["أُلغي طلبك. إذا كنت قد دفعت، فسيُعاد المبلغ إلى وسيلة الدفع نفسها وسنُعلمك بذلك."], cta: orderCta }
        : { subject: `Order #${n} has been cancelled`, heading: "Order cancelled", body: ["Your order was cancelled. If you paid, the amount will be returned to the same payment method and we'll let you know."], cta: orderCta };
    case "refund_initiated":
      return ar
        ? { subject: `بدأنا استرداد ${money(ctx.refundFils ?? 0)} للطلب رقم ${n}`, heading: "بدأ الاسترداد", body: [`أرسلنا طلب استرداد بمبلغ ${money(ctx.refundFils ?? 0)} إلى وسيلة الدفع الأصلية. قد يستغرق ظهوره في حسابك بضعة أيام عمل حسب البنك.`], cta: orderCta }
        : { subject: `Refund of ${money(ctx.refundFils ?? 0)} started for order #${n}`, heading: "Refund started", body: [`We've sent a refund of ${money(ctx.refundFils ?? 0)} to your original payment method. Depending on your bank, it can take a few business days to appear.`], cta: orderCta };
    case "refund_completed":
      return ar
        ? { subject: `تم استرداد ${money(ctx.refundFils ?? 0)} للطلب رقم ${n}`, heading: "تم الاسترداد", body: [`اكتمل استرداد مبلغ ${money(ctx.refundFils ?? 0)}.`], cta: orderCta }
        : { subject: `Refund of ${money(ctx.refundFils ?? 0)} completed for order #${n}`, heading: "Refund completed", body: [`Your refund of ${money(ctx.refundFils ?? 0)} has been completed.`], cta: orderCta };
    case "staff_new_paid_order":
      return ar
        ? { subject: `طلب مدفوع جديد رقم ${n} (${money(ctx.order?.totalFils ?? 0)})`, heading: "طلب مدفوع جديد", body: ["تم تأكيد الدفع من بوابة الدفع. الطلب جاهز للتجهيز."], cta: adminCta }
        : { subject: `New paid order #${n} (${money(ctx.order?.totalFils ?? 0)})`, heading: "New paid order", body: ["Payment was confirmed by the payment provider. The order is ready to prepare."], cta: adminCta };
    case "staff_new_cod_order":
      return ar
        ? { subject: `طلب دفع عند الاستلام رقم ${n} (${money(ctx.order?.totalFils ?? 0)})`, heading: "طلب جديد (دفع عند الاستلام)", body: ["يُنصح بتأكيد الطلب مع العميل هاتفيًا قبل الشحن."], cta: adminCta }
        : { subject: `New cash-on-delivery order #${n} (${money(ctx.order?.totalFils ?? 0)})`, heading: "New cash-on-delivery order", body: ["Consider confirming the order with the customer by phone before dispatch."], cta: adminCta };
    case "staff_payment_attention": {
      const why = ctx.reason === "amount_mismatch"
        ? (ar ? "المبلغ الذي أكدته بوابة الدفع لا يطابق إجمالي الطلب. لا تُجهّز الطلب قبل المراجعة." : "The amount confirmed by the payment provider doesn't match the order total. Don't fulfil the order until it's reviewed.")
        : (ar ? "فشل استرداد المبلغ لدى بوابة الدفع. راجع الطلب وأعد المحاولة أو عالجه يدويًا." : "A refund failed at the payment provider. Review the order and retry or resolve it manually.");
      return ar
        ? { subject: `يحتاج انتباهك: الطلب رقم ${n}`, heading: "دفعة تحتاج إلى مراجعة", body: [why], cta: adminCta }
        : { subject: `Needs attention: order #${n}`, heading: "A payment needs review", body: [why], cta: adminCta };
    }
    case "staff_refund_requested":
      return ar
        ? { subject: `طلب استرداد ${money(ctx.refundFils ?? 0)} للطلب رقم ${n}`, heading: "طلب استرداد جديد", body: [`السبب: ${ctx.reason ?? ""}`, "يحتاج إلى موافقة فريق المالية."], cta: adminCta }
        : { subject: `Refund request of ${money(ctx.refundFils ?? 0)} for order #${n}`, heading: "New refund request", body: [`Reason: ${ctx.reason ?? ""}`, "Finance approval is needed."], cta: adminCta };
    case "staff_low_stock":
      return ar
        ? { subject: `مخزون منخفض: ${ctx.stock?.sku ?? ""}`, heading: "مخزون منخفض", body: [`${ctx.stock?.name ?? ""} (${ctx.stock?.sku ?? ""}): متبقٍ ${ctx.stock?.onHand ?? 0}، والحد الأدنى ${ctx.stock?.threshold ?? 0}.`], cta: { label: "فتح المخزون", url: ctx.adminUrl } }
        : { subject: `Low stock: ${ctx.stock?.sku ?? ""}`, heading: "Low stock", body: [`${ctx.stock?.name ?? ""} (${ctx.stock?.sku ?? ""}): ${ctx.stock?.onHand ?? 0} left, threshold ${ctx.stock?.threshold ?? 0}.`], cta: { label: "Open inventory", url: ctx.adminUrl } };
    case "account_verification":
      return ar
        ? { subject: "أكّد بريدك الإلكتروني لدى رنا سنت", heading: "أكّد بريدك الإلكتروني", body: ["أهلًا بك في رنا سنت. اضغط الزر أدناه لتأكيد بريدك وتفعيل حسابك. ينتهي الرابط خلال ساعة.", "إذا لم تنشئ حسابًا، يمكنك تجاهل هذه الرسالة."], cta: { label: "تأكيد البريد", url: ctx.actionUrl } }
        : { subject: "Confirm your email for Rana Scent", heading: "Confirm your email", body: ["Welcome to Rana Scent. Press the button below to confirm your email and activate your account. The link expires in one hour.", "If you didn't create an account, you can ignore this email."], cta: { label: "Confirm email", url: ctx.actionUrl } };
    case "password_reset":
      return ar
        ? { subject: "إعادة تعيين كلمة المرور لدى رنا سنت", heading: "إعادة تعيين كلمة المرور", body: ["طلبت إعادة تعيين كلمة المرور. اضغط الزر أدناه لاختيار كلمة جديدة. ينتهي الرابط خلال ساعة.", "إذا لم تطلب ذلك، تجاهل هذه الرسالة وستبقى كلمة مرورك كما هي."], cta: { label: "اختيار كلمة مرور جديدة", url: ctx.actionUrl } }
        : { subject: "Reset your Rana Scent password", heading: "Reset your password", body: ["You asked to reset your password. Press the button below to choose a new one. The link expires in one hour.", "If you didn't ask for this, ignore this email and your password stays the same."], cta: { label: "Choose a new password", url: ctx.actionUrl } };
    case "account_exists":
      return ar
        ? { subject: "لديك حساب بالفعل لدى رنا سنت", heading: "لديك حساب بالفعل", body: ["حاول أحدهم إنشاء حساب بهذا البريد، لكن لديك حساب بالفعل. يمكنك تسجيل الدخول أو إعادة تعيين كلمة المرور.", "إذا لم تكن أنت، فلا داعي لأي إجراء."], cta: { label: "تسجيل الدخول", url: ctx.actionUrl } }
        : { subject: "You already have a Rana Scent account", heading: "You already have an account", body: ["Someone tried to create an account with this email, but you already have one. You can sign in or reset your password.", "If this wasn't you, no action is needed."], cta: { label: "Sign in", url: ctx.actionUrl } };
  }
}

function addressLine(order: EmailOrder, locale: Locale): string {
  const t = L[locale];
  const a = order.address;
  const parts = [
    governorateNames[a.governorate]?.[locale] ?? a.governorate,
    a.area,
    `${t.block} ${a.block}`,
    `${t.street} ${a.street}`,
    a.avenue ? `${t.avenue} ${a.avenue}` : "",
    `${t.building} ${a.building}`,
    a.floor ? `${t.floor} ${a.floor}` : "",
    a.apartment ? `${t.apartment} ${a.apartment}` : "",
  ].filter(Boolean);
  return parts.join(locale === "ar" ? "، " : ", ");
}

function orderSummaryHtml(order: EmailOrder, locale: Locale, staff: boolean): string {
  const t = L[locale];
  const money = (fils: number) => escapeHtml(formatKWD(fils, locale));
  const align = locale === "ar" ? "left" : "right";
  const rows = order.items
    .map(
      (i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #eadfcd;font-size:14px;color:#352a24">${escapeHtml(i.name)}${i.label ? `<br><span style="color:#8a7a6a;font-size:12px">${escapeHtml(i.label)}</span>` : ""}</td>
<td style="padding:8px 6px;border-bottom:1px solid #eadfcd;font-size:14px;color:#6b5d50;white-space:nowrap">× ${i.quantity}</td>
<td style="padding:8px 0;border-bottom:1px solid #eadfcd;font-size:14px;color:#352a24;text-align:${align};white-space:nowrap" dir="ltr">${money(i.lineTotalFils)}</td></tr>`,
    )
    .join("");
  const line = (label: string, value: string, strong = false) =>
    `<tr><td colspan="2" style="padding:4px 0;font-size:14px;color:${strong ? "#352a24" : "#6b5d50"};${strong ? "font-weight:bold" : ""}">${escapeHtml(label)}</td><td style="padding:4px 0;font-size:14px;text-align:${align};color:#352a24;${strong ? "font-weight:bold" : ""}" dir="ltr">${value}</td></tr>`;
  const totals = [
    line(t.subtotal, money(order.subtotalFils)),
    order.discountFils > 0 ? line(t.discount, `−${money(order.discountFils)}`) : "",
    line(t.delivery, order.shippingFils === 0 ? escapeHtml(t.free) : money(order.shippingFils)),
    line(t.total, money(order.totalFils), true),
    order.refundedFils > 0 ? line(t.refunded, `−${money(order.refundedFils)}`) : "",
  ].join("");
  const payment = order.paymentMethod === "cod" ? t.cod : order.paymentLabel ? `${t.online} (${order.paymentLabel})` : t.online;
  const tracking = order.trackingNumber
    ? `<p style="margin:12px 0 0;font-size:14px;color:#352a24">${escapeHtml(t.tracking)}: <span dir="ltr">${escapeHtml(order.trackingNumber)}</span>${order.courier ? ` · ${escapeHtml(t.courier)}: ${escapeHtml(order.courier)}` : ""}</p>`
    : "";
  const eta = order.estimatedDelivery
    ? `<p style="margin:6px 0 0;font-size:14px;color:#352a24">${escapeHtml(t.eta)}: <span dir="ltr">${escapeHtml(order.estimatedDelivery)}</span></p>`
    : "";
  const contact = staff
    ? `<p style="margin:6px 0 0;font-size:14px;color:#352a24">${escapeHtml(order.customerName)} · <span dir="ltr">${escapeHtml(order.phone)}</span></p>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:20px 0 8px">
<tr><td colspan="3" style="padding:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8a7a6a">${escapeHtml(t.order(order.number))} · ${escapeHtml(t.items)}</td></tr>
${rows}${totals}</table>
<p style="margin:14px 0 0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8a7a6a">${escapeHtml(t.deliverTo)}</p>
<p style="margin:4px 0 0;font-size:14px;color:#352a24">${escapeHtml(addressLine(order, locale))}</p>${contact}
<p style="margin:12px 0 0;font-size:14px;color:#352a24">${escapeHtml(t.payment)}: ${escapeHtml(payment)}</p>${tracking}${eta}`;
}

function safeUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function renderEmail(kind: EmailKind, ctx: EmailContext): RenderedEmail {
  const t = L[ctx.locale];
  const ar = ctx.locale === "ar";
  const copy = copyFor(kind, ctx);
  const staff = kind.startsWith("staff_");
  const showOrder = Boolean(ctx.order) && kind !== "payment_failed" && kind !== "staff_low_stock";
  const name = staff ? "" : ctx.order?.customerName.split(/\s+/)[0] ?? "";
  const ctaUrl = safeUrl(copy.cta?.url);
  const font = ar ? "Tahoma,'Segoe UI',Arial,sans-serif" : "Georgia,'Times New Roman',serif";

  const html = `<!doctype html>
<html lang="${ctx.locale}" dir="${ar ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(copy.subject)}</title></head>
<body style="margin:0;padding:0;background:#f4efe6;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(copy.body[0] ?? "")}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4efe6"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffdf9;border:1px solid #eadfcd;border-radius:16px">
<tr><td style="padding:28px 28px 8px;text-align:center;font-family:${font}">
<p style="margin:0;font-size:24px;letter-spacing:.06em;color:#7a5f33">${escapeHtml(t.brand)}</p>
<p style="margin:4px 0 0;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#a08a6a">${escapeHtml(t.tagline)}</p>
</td></tr>
<tr><td style="padding:20px 28px 28px;font-family:${font};text-align:${ar ? "right" : "left"}">
<h1 style="margin:0 0 14px;font-size:22px;font-weight:normal;color:#352a24">${escapeHtml(copy.heading)}</h1>
${name ? `<p style="margin:0 0 10px;font-size:15px;color:#352a24">${escapeHtml(t.hello(name))}</p>` : ""}
${copy.body.map((p) => `<p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#352a24">${escapeHtml(p)}</p>`).join("")}
${showOrder && ctx.order ? orderSummaryHtml(ctx.order, ctx.locale, staff) : ""}
${ctaUrl ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 6px"><tr><td style="border-radius:999px;background:#352a24"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:13px 26px;font-size:15px;color:#fffdf9;text-decoration:none;border-radius:999px">${escapeHtml(copy.cta!.label)}</a></td></tr></table>` : ""}
${staff ? "" : `<p style="margin:22px 0 0;font-size:13px;color:#6b5d50">${escapeHtml(t.help)}</p>`}
</td></tr></table>
<p style="max-width:560px;margin:16px auto 0;font-family:Arial,sans-serif;font-size:11px;line-height:1.5;color:#8a7a6a;text-align:center">${escapeHtml(t.footer)}</p>
</td></tr></table></body></html>`;

  const textParts = [
    t.brand,
    "",
    copy.heading,
    ...(name ? [t.hello(name)] : []),
    ...copy.body,
  ];
  if (showOrder && ctx.order) {
    const o = ctx.order;
    textParts.push("", t.order(o.number));
    for (const i of o.items) textParts.push(`- ${i.name}${i.label ? ` (${i.label})` : ""} × ${i.quantity}: ${formatKWD(i.lineTotalFils, ctx.locale)}`);
    textParts.push(`${t.total}: ${formatKWD(o.totalFils, ctx.locale)}`);
    if (o.refundedFils > 0) textParts.push(`${t.refunded}: ${formatKWD(o.refundedFils, ctx.locale)}`);
    textParts.push(`${t.deliverTo}: ${addressLine(o, ctx.locale)}`);
    if (o.trackingNumber) textParts.push(`${t.tracking}: ${o.trackingNumber}`);
  }
  if (ctaUrl) textParts.push("", `${copy.cta!.label}: ${ctaUrl}`);
  if (!staff) textParts.push("", t.help);
  textParts.push("", t.footer);
  return { subject: copy.subject, html, text: textParts.join("\n") };
}
