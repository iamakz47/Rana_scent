import { z } from "zod";
import type { Locale } from "@/i18n/config";

// Editable content pages (Admin → Pages). The same shape is stored for drafts
// and published copies; the database only limits size and who may write.
export const sitePageKeys = ["about", "contact", "faq"] as const;
export type SitePageKey = (typeof sitePageKeys)[number];

export function isSitePageKey(value: string): value is SitePageKey {
  return (sitePageKeys as readonly string[]).includes(value);
}

const text = (max: number) => z.object({ ar: z.string().trim().max(max).default(""), en: z.string().trim().max(max).default("") });

export const faqItemSchema = z.object({ q: text(300), a: text(3000) });

export const pageContentSchema = z.object({
  title: text(120),
  lead: text(400).default({ ar: "", en: "" }),
  body: text(20000).default({ ar: "", en: "" }),
  items: z.array(faqItemSchema).max(60).default([]),
});
export type PageContent = z.infer<typeof pageContentSchema>;
export type FaqItem = z.infer<typeof faqItemSchema>;

export const emptyPageContent: PageContent = {
  title: { ar: "", en: "" },
  lead: { ar: "", en: "" },
  body: { ar: "", en: "" },
  items: [],
};

// Text in the visitor's language, falling back to the other language rather
// than showing nothing (no translation is ever invented).
export function pick(value: { ar: string; en: string }, locale: Locale): string {
  return (value[locale] || value[locale === "ar" ? "en" : "ar"] || "").trim();
}

// Lenient read of stored JSON: anything invalid means "not usable".
export function parsePageContent(value: unknown): PageContent | null {
  const parsed = pageContentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
