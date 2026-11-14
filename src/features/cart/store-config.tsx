"use client";

import { createContext, use, type ReactNode } from "react";

// Server-decided storefront capabilities for client components. Checkout is
// enabled only with the live catalog (preview items aren't orderable).
type StoreConfig = { checkoutEnabled: boolean };

const StoreConfigContext = createContext<StoreConfig>({ checkoutEnabled: false });

export function StoreConfigProvider({ value, children }: { value: StoreConfig; children: ReactNode }) {
  return <StoreConfigContext value={value}>{children}</StoreConfigContext>;
}

export function useStoreConfig(): StoreConfig {
  return use(StoreConfigContext);
}
