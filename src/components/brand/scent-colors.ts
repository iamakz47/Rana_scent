import type { ScentFamily } from "@/features/catalog/types";

// Mirrors the --color-scent-* tokens for places that need raw values
// (WebGL uniforms, SVG gradients).
export const scentHex: Record<ScentFamily, string> = {
  oud: "#b0703a",
  musk: "#d8b5ad",
  floral: "#b48ccc",
  fresh: "#8cc4d4",
  woody: "#9a8662",
};

export const GOLD_HEX = "#d5b46a";

export function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}
