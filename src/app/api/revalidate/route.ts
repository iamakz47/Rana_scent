import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { refreshStorefront } from "@/features/catalog/invalidate";

// Refreshes the cached storefront catalogue and homepage after changes made
// outside the admin (for example a bulk SQL import). Same secret as the
// scheduled job; refused when it isn't configured.
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (secret.length < 16 || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  refreshStorefront();
  return NextResponse.json({ ok: true });
}
