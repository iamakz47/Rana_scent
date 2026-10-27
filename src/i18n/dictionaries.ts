import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { isLocale, type Locale } from "./config";
import type en from "./dictionaries/en.json";

// English is the reference shape; every locale must provide the same keys.
export type Dictionary = typeof en;

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  ar: () => import("./dictionaries/ar.json").then((module) => module.default),
  en: () => import("./dictionaries/en.json").then((module) => module.default),
};

// Resolves the active locale from the `[lang]` root segment.
export async function getLocale(): Promise<Locale> {
  const locale = await lang();
  if (!isLocale(locale)) notFound();
  return locale;
}

export async function getDictionary(): Promise<Dictionary> {
  return dictionaries[await getLocale()]();
}
