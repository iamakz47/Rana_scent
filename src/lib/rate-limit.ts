import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createServiceClient, isServiceConfigured } from "@/lib/supabase/service";

// Fixed-window rate limiting backed by the database (works across
// serverless instances). Keys are hashed, so no raw emails or IP addresses
// are stored. Fails open if the database can't be reached: Supabase Auth
// applies its own limits underneath.
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0] || "unknown").trim();
}

export function hashKey(...parts: string[]): string {
  return createHash("sha256").update(parts.join("|").toLowerCase()).digest("hex").slice(0, 40);
}

export async function allow(scope: string, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  if (!isServiceConfigured()) return true;
  try {
    const { data, error } = await createServiceClient().rpc("consume_rate_limit", {
      p_bucket: `${scope}:${hashKey(key)}`,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    return error ? true : data !== false;
  } catch {
    return true;
  }
}
