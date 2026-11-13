# Phase 3: checkout, orders, payments and delivery

Status: **implemented and tested locally / in CI. Not applied to production.**
Nothing here takes real payments until Tap test keys (then live approval) are
configured, and the storefront keeps the preview catalogue until
`CATALOG_SOURCE=supabase` is set.

## Migrations (apply with `npx supabase db push`, which applies only these)

| File | What it does |
| --- | --- |
| `20261112090000_order_status_values.sql` | Adds `ready_for_delivery`, `out_for_delivery` to the order status enum (own file: Postgres can't use new enum values in the same transaction). |
| `20261112090100_checkout_orders_payments.sql` | Order columns (access token, idempotency key, customer name, payment method, delivery instructions, expiry, tracking); `order_notes`, `refund_requests` (RLS); checkout settings; `place_order`, `quote_order`, `get_order_for_customer`, `record_payment_result` (service role only), `attach_payment_charge` (service role only), `request_refund`, `resolve_refund`, `list_customers`, `expire_unpaid_orders`; status-transition guard; stock release on cancellation; an **inactive** provisional delivery zone. |
| `20261112090200_settings_guard_checkout.sql` | Only `settings.write` can change checkout settings (content editors keep only the slider). |
| `20261112090300_phase3_api_grants.sql` | Explicit table grants for the new/changed tables (production doesn't grant them automatically). |

Non-destructive: new columns/tables/functions, two relaxed or widened check
constraints (email may be empty; payment provider/method lists widened). No
data is removed. Verify afterwards with `supabase/verify/phase3_verify.sql`
(read-only, 10 checks) and `supabase/verify/phase2_verify.sql`.

## How money and stock are protected

- The browser sends only variant ids and quantities. `place_order()` reads every
  price, discount and delivery fee from the database in one transaction.
- Stock is reserved under row locks when the order is placed; it can't go
  below zero, so concurrent checkouts can't oversell (tested with parallel
  orders). Cancelled, expired (default 30 min) or failed-payment orders return
  their stock exactly once.
- A checkout submitted twice (same idempotency key) returns the same order.
- Discount redemption limits are enforced under a row lock; cancellations give
  the redemption back.
- Payment results are recorded only by the server with the service role, after
  re-fetching the charge from Tap with the secret key. Amount and currency must
  match the order. Each charge status is processed once (webhook replays and
  the return redirect are no-ops). A redirect never marks an order paid.
- Staff can't set `paid`/`refunded`, edit amounts or customer details, or skip
  fulfilment stages; every change is in `order_status_history`.

## Configuration needed (Vercel → Project → Settings → Environment Variables)

| Variable | Scope | Purpose |
| --- | --- | --- |
| `SUPABASE_SECRET_KEY` | Server, Production + Preview | **Required for online payments** (records verified results) and staff invites. |
| `PAYMENTS_PROVIDER` | Server | `tap` to enable Tap. (`mock` = test page; refused on production.) |
| `TAP_SECRET_KEY` | Server, secret | `sk_test_…` first. A `sk_live_…` key is refused unless `TAP_LIVE_ENABLED=true`. |
| `TAP_LIVE_ENABLED` | Server | Set to `true` only after Tap live approval and your sign-off. |
| `TAP_SOURCE_ID` | Server, optional | Default `src_all` (Tap page offers KNET, cards, Apple Pay as enabled on your account). |
| `NEXT_PUBLIC_SITE_URL` | All | `https://ranascent.vercel.app` (payment redirect and email links). |
| `RESEND_API_KEY`, `ORDER_EMAIL_FROM` | Server, optional | Order confirmation emails via Resend; skipped if unset. |
| `CATALOG_SOURCE` | Server | `supabase` only after real products are published. |

**Tap dashboard:** set the webhook / post URL to
`https://ranascent.vercel.app/api/payments/tap/webhook`. Before going live,
send a test payment and confirm the webhook's `hashstring` validates (the
handler records `webhook_hash_valid` in `payment_events.payload`); the order
status itself always comes from re-fetching the charge from Tap.

## Go-live checklist

1. Apply the four migrations (`db push`), run both verification scripts.
2. Admin → Settings: set delivery fees, activate zones, choose cash on delivery
   and/or online payment, set the delivery note.
3. Admin → Products: publish the real catalogue with stock and photos.
4. Set the Vercel variables above (Tap **test** key), redeploy, place test
   orders on a preview; check Admin → Orders and Finance.
5. Set `CATALOG_SOURCE=supabase` (production) and redeploy.
6. After Tap live approval: switch to the live key with `TAP_LIVE_ENABLED=true`.

## Local testing

```bash
npm run db:start && npm run db:reset
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/samples/local_checkout_fixture.sql
PAYMENTS_PROVIDER=mock npm run dev:local     # test payment page, no money moves
npm run test:db && npm run test:e2e:admin
```
