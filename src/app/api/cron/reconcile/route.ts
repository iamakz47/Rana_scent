import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isServiceConfigured } from "@/lib/supabase/service";
import { reconcilePayments } from "@/features/payments/service";

// Scheduled job (vercel.json): re-checks online payments and refunds whose
// webhook may have been missed, expires unpaid orders, and sends queued
// emails. Protected by CRON_SECRET (Vercel sends it as a Bearer token);
// refused entirely when the secret isn't configured.
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 16) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false }, { status: 401 });
  if (!isServiceConfigured()) return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });
  const counts = await reconcilePayments();
  return NextResponse.json({ ok: true, ...counts });
}
