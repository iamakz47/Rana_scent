// Image checks shared by upload preparation (declared type and size) and
// registration (the actual bytes). SVG is never accepted: it can carry script.
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export const imageTypes = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
} as const;

export type ImageMime = keyof typeof imageTypes;

export const mediaFolders = ["products", "categories", "hero", "library"] as const;
export type MediaFolder = (typeof mediaFolders)[number];

export function isImageMime(value: string): value is ImageMime {
  return value in imageTypes;
}

// Identifies the format from the file's first bytes rather than trusting the
// browser-supplied type or the extension.
export function sniffImageType(bytes: Uint8Array): ImageMime | null {
  const at = (offset: number, sig: number[]) => sig.every((b, i) => bytes[offset + i] === b);
  if (at(0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) return "image/webp";
  if (at(4, [0x66, 0x74, 0x79, 0x70])) {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    if (brand === "avif" || brand === "avis") return "image/avif";
  }
  return null;
}

export function mediaPath(folder: MediaFolder, id: string, mime: ImageMime): string {
  return `${folder}/${id}.${imageTypes[mime]}`;
}

export function isSafeMediaPath(path: string): boolean {
  return /^(products|categories|hero|library)\/[0-9a-f-]{36}\.(jpg|png|webp|avif)$/.test(path);
}
