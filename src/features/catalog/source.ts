import { isSupabaseConfigured } from "@/lib/env";
import { getCatalogSource } from "@/lib/server-env";
import { categories as sampleCategories, products as sampleProducts } from "./sample-data";
import { loadSupabaseCatalog, type CatalogData } from "./supabase-catalog";

// CATALOG_SOURCE=supabase reads published rows; anything else keeps the
// Phase 1 preview catalog. Switch only after the migrations are applied and
// the real products are published.
export function isLiveCatalog(): boolean {
  return getCatalogSource() === "supabase" && isSupabaseConfigured();
}

export async function loadCatalog(): Promise<CatalogData> {
  if (isLiveCatalog()) return loadSupabaseCatalog();
  return { products: sampleProducts, categories: sampleCategories };
}
