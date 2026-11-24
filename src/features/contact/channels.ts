// Links for the shop's contact channels (from Admin → Settings).

// WhatsApp needs the full international number without "+" or spaces.
// Kuwaiti numbers are 8 digits; those get the 965 country code.
export function whatsappHref(number: string, text?: string): string | null {
  const digits = number.replace(/\D/g, "");
  if (digits.length < 7) return null;
  const full = digits.length === 8 ? `965${digits}` : digits.replace(/^00/, "");
  return `https://wa.me/${full}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function telHref(number: string): string | null {
  const clean = number.replace(/[^\d+]/g, "");
  if (clean.replace(/\D/g, "").length < 7) return null;
  return `tel:${clean.length === 8 && !clean.startsWith("+") ? `+965${clean}` : clean}`;
}

export type StoreContact = { email: string; phone: string; whatsapp: string; instagram: string };
