import { describe, expect, it } from "vitest";
import { isSafeMediaPath, mediaPath, sniffImageType } from "./validation";

const bytes = (...values: number[]) => Uint8Array.from([...values, ...new Array(16).fill(0)]);

describe("media validation", () => {
  it("identifies images by their bytes", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    const webp = bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50);
    expect(sniffImageType(webp)).toBe("image/webp");
    expect(sniffImageType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("GIF89a........"))).toBeNull();
  });

  it("builds and accepts only generated paths", () => {
    const id = "3f2b8c1e-1d2a-4c3b-9e8f-0a1b2c3d4e5f";
    expect(mediaPath("products", id, "image/webp")).toBe(`products/${id}.webp`);
    expect(isSafeMediaPath(`products/${id}.webp`)).toBe(true);
    for (const bad of [`../${id}.png`, `secret/${id}.png`, `products/${id}.svg`, `products/x.png`, `/products/${id}.png`]) {
      expect(isSafeMediaPath(bad)).toBe(false);
    }
  });
});
