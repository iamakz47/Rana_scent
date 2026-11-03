"use client";

import { z } from "zod";
import { createPersistentStore } from "@/lib/persistent-store";

// Saved product slugs. Moves to the customer's account in Phase 4.
const wishlist = createPersistentStore(
  "rana-wishlist-v1",
  z.array(z.string().min(1)).max(100),
  [],
);

export const useWishlist = wishlist.useStore;

export function toggleWishlist(slug: string) {
  wishlist.set((slugs) =>
    slugs.includes(slug) ? slugs.filter((item) => item !== slug) : [...slugs, slug],
  );
}
