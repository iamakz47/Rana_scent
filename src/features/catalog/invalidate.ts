import "server-only";
import { revalidateTag } from "next/cache";
import { CATALOG_TAG, HOMEPAGE_TAG } from "./cache-tags";

// Stock changed outside the admin (an order reserved or released stock):
// drop the cached catalog so the next visitor sees current availability.
// Checkout never relies on this cache; it re-checks stock in the database.
export function catalogStockChanged(): void {
  try {
    revalidateTag(CATALOG_TAG, { expire: 0 });
  } catch {
    // Outside a request scope (tests): nothing is cached there.
  }
}

export function refreshStorefront(): void {
  revalidateTag(CATALOG_TAG, { expire: 0 });
  revalidateTag(HOMEPAGE_TAG, { expire: 0 });
}
