import { afterEach, describe, expect, it, vi } from "vitest";
import { getPaymentsConfig } from "./config";

afterEach(() => vi.unstubAllEnvs());

describe("payments config", () => {
  it("is disabled until configured", () => {
    vi.stubEnv("PAYMENTS_PROVIDER", "");
    expect(getPaymentsConfig()).toEqual({ kind: "disabled", reason: "not_configured" });
  });

  it("accepts test keys and refuses live keys unless explicitly enabled", () => {
    vi.stubEnv("PAYMENTS_PROVIDER", "tap");
    vi.stubEnv("TAP_SECRET_KEY", "sk_test_abc");
    expect(getPaymentsConfig()).toMatchObject({ kind: "tap", live: false, sourceId: "src_all" });
    vi.stubEnv("TAP_SECRET_KEY", "sk_live_abc");
    expect(getPaymentsConfig()).toEqual({ kind: "disabled", reason: "live_key_not_enabled" });
    vi.stubEnv("TAP_LIVE_ENABLED", "true");
    expect(getPaymentsConfig()).toMatchObject({ kind: "tap", live: true });
    vi.stubEnv("TAP_SECRET_KEY", "pk_test_public");
    expect(getPaymentsConfig()).toEqual({ kind: "disabled", reason: "invalid_key" });
  });

  it("never allows the test provider on the production deployment", () => {
    vi.stubEnv("PAYMENTS_PROVIDER", "mock");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(getPaymentsConfig()).toEqual({ kind: "mock" });
    vi.stubEnv("VERCEL_ENV", "production");
    expect(getPaymentsConfig()).toEqual({ kind: "disabled", reason: "mock_in_production" });
  });
});
