import { NextResponse, type NextRequest } from "next/server";
import { getPaymentsConfig } from "@/features/payments/config";
import { recordVerifiedCharge } from "@/features/payments/service";
import { TapProvider, verifyTapWebhook } from "@/features/payments/tap";

// Tap charge webhook. The body is treated as a hint only: the hashstring
// signature is checked, and the charge is then re-fetched from Tap with the
// secret key. Only that authenticated result can change an order. Replays
// are harmless (each charge status is recorded once).
export async function POST(request: NextRequest) {
  const config = getPaymentsConfig();
  if (config.kind !== "tap") return NextResponse.json({ ok: false }, { status: 404 });

  const raw = await request.text();
  if (raw.length > 100_000) return NextResponse.json({ ok: false }, { status: 413 });
  let body: { id?: unknown; object?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const chargeId = typeof body.id === "string" ? body.id : "";
  if (!/^chg_[A-Za-z0-9]+$/.test(chargeId)) return NextResponse.json({ ok: true, ignored: true });

  const hashValid = verifyTapWebhook(body, request.headers.get("hashstring"), config.secretKey);
  const provider = new TapProvider(config.secretKey, config.sourceId, config.apiBase);
  try {
    const charge = await provider.retrieveCharge(chargeId);
    charge.raw = { ...(charge.raw as object), webhook_hash_valid: hashValid };
    const result = await recordVerifiedCharge("tap", charge, true);
    return NextResponse.json({ ok: true, outcome: result.outcome });
  } catch {
    // Let Tap retry later; nothing was recorded.
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
