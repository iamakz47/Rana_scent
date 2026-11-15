# Phase 4: customer accounts, emails, refunds and launch readiness

This phase adds customer accounts, transactional email, provider refunds and
payment reconciliation. It also hardens the storefront for the switch to the
live catalogue. Production behaviour is unchanged until the steps in
[Going live](#going-live) are taken:

- the storefront keeps the preview catalogue;
- checkout and customer accounts stay closed ("opening soon");
- no payment or email provider is called.

## Database migrations (apply in order)

| File | What it does |
| --- | --- |
| `20261115090000_customer_accounts.sql` | Address rules (max 10 per customer, one default), `set_default_address`, `claim_guest_order`, `my_orders`, account-deletion requests, and a database-backed rate limiter. |
| `20261115090100_email_outbox.sql` | `notification_settings` (staff-only), the `email_messages` outbox and audit history, triggers that queue every order, refund, payment-attention and low-stock email, and the dispatcher API. |
| `20261115090200_refunds_reconciliation.sql` | Adds `orders.refunded_fils` for partial refunds, the `processing`/`failed` refund states, `approve_refund`, `record_refund_result`, `reopen_refund`, `payments_to_reconcile` and `abandon_unstarted_payment`. A paid order that is cancelled now opens a refund request automatically. |
| `20261115090300_phase4_api_grants.sql` | Explicit Data API grants. Production grants nothing by default. |

All four are additive: new tables, columns, functions and triggers, and one
widened check constraint. No data is changed or removed. After applying them,
run `supabase/verify/phase4_verify.sql` (read-only); every row should be
`true`. `phase2_verify.sql` now accepts "exactly one active owner" instead of
"no staff yet".

## Customer accounts

- Supabase Auth users without a `staff_members` row. They can never reach the
  admin, because every admin check and staff RLS policy uses
  `private.has_permission()`.
- **Sign-up** creates the user with the server key (`auth.admin.createUser`,
  unconfirmed). It then emails a one-time link through our own bilingual
  template. Signing in is refused until the email is confirmed, and an
  unconfirmed sign-in re-sends the link.
  - Public sign-ups can stay disabled in Supabase (Auth → Providers → Email →
    "Allow new users to sign up" off). The site never uses the public sign-up
    endpoint.
- **No account enumeration:** sign-up, password reset and sign-in give the
  same answer whether or not the email exists. Registering an existing email
  sends that address an "you already have an account" email instead.
- **Rate limits** (hashed keys, database-backed):

  | Action | Per IP | Per email or account |
  | --- | --- | --- |
  | Sign-up | 10/h | 3/h |
  | Sign-in | 30 per 15 min | 8 per 15 min |
  | Password reset | 10/h | 3/h |
  | Linking a guest order | — | 20/h per account |
  | Placing orders | 20 per 10 min | — |

- **Profile** (name, Kuwaiti mobile, language, marketing opt-in), **addresses**
  (add, edit, delete, default) and **order history** with tracking. Checkout is
  pre-filled from the default address.
- **Guest orders are never attached because an email matches.**
  `claim_guest_order` requires all three of:
  - the order's secret token (it's only in the customer's own order link);
  - a verified account email equal to the order's email;
  - an order that has no account yet.

  The customer presses "Add to my account" on the order page.
- **Deletion** is a request:
  - Support or a manager completes it from Admin → Customers. The profile is
    anonymised, addresses are deleted, orders are kept for accounting without
    the customer link, and the login is removed.
  - Staff accounts can't use this flow.
- Accounts open together with checkout (`CATALOG_SOURCE=supabase` and
  `SUPABASE_SECRET_KEY` set). Until then `/account` pages say "opening soon"
  and the header shows no account icon.

## Email

- Order events are queued in `email_messages` **inside the same transaction**
  as the order change, so an email is never lost and never blocks or fails an
  order. One row per `dedupe_key` (for example `order:<id>:delivered`), so
  repeated webhooks or retries never send twice.
- **Customer emails:**
  - order confirmation (cash on delivery);
  - payment succeeded;
  - payment failed or expired;
  - processing, ready for delivery, out for delivery, delivered;
  - cancelled;
  - refund started, refund completed.
- **Account emails:** verification, password reset, "you already have an
  account". They are sent directly and logged without their secret link.
- **Staff alerts:**
  - new paid order;
  - new cash-on-delivery order;
  - payment amount mismatch or refund failure;
  - refund requested;
  - low stock (once per variant per day).

  Recipient and language are set in Admin → Settings → Notifications.
- Templates (`src/features/notifications/templates.ts`) are bilingual,
  right-to-left in Arabic, mobile-friendly, and HTML-escaped. They show items,
  totals in KWD with three decimals, the delivery address and the secure order
  link. Card details are never included.
- **Delivery and retries:**
  - Emails are sent right after each change and by the scheduled job.
  - Failed sends retry with back-off (1, 2, 4, 8, 16 minutes); permanent
    errors stop at once.
  - Each order's email history, with a Retry button, is on the admin order
    page.
- **Safety:**
  - Without `RESEND_API_KEY` + `EMAIL_FROM`, a test adapter records emails
    and sends nothing.
  - Outside the production deployment, real sending is limited to
    `EMAIL_TEST_ALLOWLIST`, so previews and tests can't email real customers.

## Payments and refunds

- **Double submit / refresh:** a second submit of the same checkout reuses the
  existing Tap charge and its payment page, instead of failing.
- **Provider unreachable:** if Tap can't create the charge, the order is
  cancelled immediately and its stock released. The customer never saw a
  payment page.
- **Refunds:**
  1. Support or finance requests one.
  2. Finance presses "Refund through the payment provider".
  3. The database moves the request to `processing` exactly once, so a double
     click or second tab can't refund twice.
  4. The server calls Tap's Refunds API and records the re-fetched result:
     - refunded → `processed`;
     - pending → stays `processing` until the webhook or the scheduled job
       confirms it;
     - rejected → `failed`, and finance can "Try again".
  5. If Tap doesn't answer, the request stays `processing` and is **never
     retried automatically**. Staff check the Tap dashboard, then resolve it
     by hand.

  Cash-on-delivery refunds are resolved manually. Partial refunds update
  `orders.refunded_fils`; a full refund moves the payment and order to
  `refunded`.
- **Reconciliation:** `/api/cron/reconcile`, protected by `CRON_SECRET`:
  1. re-checks online payments and refunds still open after 2 minutes (missed
     webhooks);
  2. then expires unpaid orders;
  3. then sends queued emails.

  `vercel.json` runs it daily, the most frequent schedule the Vercel Hobby
  plan allows. On Pro, change the schedule to every 10 minutes
  (`*/10 * * * *`).
- **The webhook** now also accepts refund notifications. Bodies are hints
  only: every charge and refund is re-fetched from Tap with the secret key.

### Tap details to confirm in sandbox (blocker before live)

The official documentation (developers.tap.company) could not be reached from
the build environment, so these follow Tap's v2 API as previously documented
and are **not verified**:

1. Refund request fields (`charge_id`, `amount`, `currency`, `reason`,
   `reference.merchant`, `metadata`, `post.url`) and response fields (`id`,
   `status`, `amount`, `currency`, `charge_id`).
2. The refund status names (we treat `REFUNDED`/`SUCCEEDED` as done,
   `PENDING`/`IN_PROGRESS`/`INITIATED` as pending, anything else as failed).
3. Whether refund webhooks are signed with the same `hashstring` scheme. It
   doesn't matter for safety, because we re-fetch.
4. The charge webhook `hashstring` field list (from Phase 3).
5. Whether a charge's `transaction.url` remains valid when retrieving an
   `INITIATED` charge (used to reuse the payment page).

**Test plan:**
- Create a sandbox charge and pay with the KNET and card test credentials.
- Let one charge expire.
- Refund one charge partially and one fully.
- Point the dashboard webhook at a preview deployment and compare the
  recorded `webhook_hash_valid` flag.

## Storefront fixes for the live catalogue

- **Cached stock:** stock changes from orders, failed or abandoned payments,
  cancellations and expiry now refresh the cached catalogue. Product pages no
  longer show "in stock" for hours after the last unit sold.
- **"Sets" link:** the main navigation's "Sets" link (`/collections/bundles`)
  404ed with the live catalogue, which has no bundles category. Collections
  without a category now open the shop filtered by product type.
- **404 status:** product and collection pages keep a real 404 status for
  unpublished or unknown slugs.
- **Cart prices:** the cart now refreshes its displayed prices from the
  server, so a price change is visible before checkout.
- **Refreshing after bulk imports:** `POST /api/revalidate` with
  `Authorization: Bearer $CRON_SECRET` refreshes the storefront cache after
  bulk changes made outside the admin.
- **Forms keep what was typed:** forms used to lose what customers had typed
  whenever the server rejected the submission. React resets form fields after
  an action. Checkout and the account forms now keep their values.

## Going live

These steps are for the owner, in this order:

1. Apply the four Phase 4 migrations and run `phase4_verify.sql`.
2. In Vercel (Production):
   - set `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SITE_URL` and `CRON_SECRET`;
   - for email, set `RESEND_API_KEY` and `EMAIL_FROM` (with a domain verified
     in Resend), and `EMAIL_TEST_ALLOWLIST` for previews.
3. Admin → Settings:
   - activate delivery zones and fees;
   - choose cash on delivery and/or online payments;
   - set the staff alert email.
4. Publish the real products, then set `CATALOG_SOURCE=supabase`. Checkout and
   accounts open together.
5. Tap: test keys first (`PAYMENTS_PROVIDER=tap`, `TAP_SECRET_KEY=sk_test_…`).
   Run the sandbox test plan above. Live keys need Tap's approval and
   `TAP_LIVE_ENABLED=true`.
