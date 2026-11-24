import ar from "@/i18n/dictionaries/ar.json";
import en from "@/i18n/dictionaries/en.json";
import type { PageContent, SitePageKey } from "./schema";

// The built-in text of each page, as editable content. The admin editor starts
// from it, so the owner changes words instead of retyping whole pages.
export function builtInContent(key: SitePageKey): PageContent {
  const both = <T,>(get: (d: typeof en) => T) => ({ ar: get(ar as typeof en), en: get(en) });
  if (key === "about") {
    const body = both((d) => d.pages.about.sections.map((s) => `${s.title}:\n${s.body}`).join("\n\n"));
    return { title: both((d) => d.pages.about.title), lead: both((d) => d.pages.about.lead), body, items: [] };
  }
  if (key === "contact") {
    return { title: both((d) => d.pages.contact.title), lead: both((d) => d.pages.contact.lead), body: { ar: "", en: "" }, items: [] };
  }
  return {
    title: both((d) => d.pages.faq.title),
    lead: { ar: "", en: "" },
    body: { ar: "", en: "" },
    items: en.pages.faq.items.map((item, index) => ({
      q: { ar: (ar as typeof en).pages.faq.items[index]?.q ?? "", en: item.q },
      a: { ar: (ar as typeof en).pages.faq.items[index]?.a ?? "", en: item.a },
    })),
  };
}
