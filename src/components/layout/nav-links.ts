import type { Dictionary } from "@/i18n/dictionaries";

type NavKey = keyof Dictionary["nav"];

export const primaryNav: Array<{ key: NavKey; path: string }> = [
  { key: "diffusers", path: "/collections/diffusers" },
  { key: "refills", path: "/collections/refills" },
  { key: "sets", path: "/collections/bundles" },
  { key: "accessories", path: "/collections/accessories" },
  { key: "about", path: "/about" },
];
