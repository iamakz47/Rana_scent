import "server-only";

// Payment configuration (server-only; nothing here reaches the browser).
//
//   PAYMENTS_PROVIDER   "tap" | "mock". Unset = online payment unavailable.
//   TAP_SECRET_KEY      sk_test_… (or sk_live_… once approved).
//   TAP_LIVE_ENABLED    must be "true" before a live key is accepted.
//   TAP_SOURCE_ID       optional, default "src_all" (Tap's hosted page offers
//                       every method the merchant account has: KNET, cards,
//                       Apple Pay…).
//   TAP_API_BASE        optional, default https://api.tap.company/v2.
//
// The mock provider is for local development, CI and preview testing. It is
// refused on the Vercel production deployment, always.

export type PaymentsConfig =
  | { kind: "disabled"; reason: "not_configured" | "live_key_not_enabled" | "mock_in_production" | "invalid_key" }
  | { kind: "tap"; secretKey: string; live: boolean; sourceId: string; apiBase: string }
  | { kind: "mock" };

export function isProductionDeployment(): boolean {
  return process.env.VERCEL_ENV === "production";
}

export function getPaymentsConfig(): PaymentsConfig {
  const provider = process.env.PAYMENTS_PROVIDER;
  if (provider === "mock") {
    return isProductionDeployment() ? { kind: "disabled", reason: "mock_in_production" } : { kind: "mock" };
  }
  if (provider !== "tap") return { kind: "disabled", reason: "not_configured" };

  const secretKey = process.env.TAP_SECRET_KEY ?? "";
  const live = secretKey.startsWith("sk_live_");
  if (!secretKey.startsWith("sk_test_") && !live) return { kind: "disabled", reason: "invalid_key" };
  if (live && process.env.TAP_LIVE_ENABLED !== "true") return { kind: "disabled", reason: "live_key_not_enabled" };

  const sourceId = process.env.TAP_SOURCE_ID || "src_all";
  const apiBase = (process.env.TAP_API_BASE || "https://api.tap.company/v2").replace(/\/$/, "");
  return { kind: "tap", secretKey, live, sourceId, apiBase };
}

export function onlinePaymentsAvailable(): boolean {
  return getPaymentsConfig().kind !== "disabled";
}
