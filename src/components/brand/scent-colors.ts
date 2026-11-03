import type { ScentFamily } from "@/features/catalog/types";

// Mirrors the --color-scent-* tokens for places that need raw values
// (WebGL uniforms, SVG gradients, inline accents).
export const scentHex: Record<ScentFamily, string> = {
  oud: "#a8693a",
  musk: "#c9a39b",
  floral: "#a985b8",
  fresh: "#7fb1bf",
  woody: "#8f7b58",
};

export const GOLD_HEX = "#b69a65";

export function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}
