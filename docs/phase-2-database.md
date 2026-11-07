# Phase 2: database, admin and go-live steps

Target project: **Supabase "Rana scent", ref `fquqotnpvftmxgvmlqby`**. Never
apply any of this to MicroLine or any other project.

**Status: the migrations have NOT been applied to the hosted project.** They
have been applied and tested only on the local Supabase stack
(`npx supabase start`). The storefront in production still uses the Phase 1
preview catalog (`CATALOG_SOURCE` unset).

## Migrations (`supabase/migrations/`)

No products are seeded: Rana Scent creates the real catalogue in the admin.
(`supabase/samples/draft_products_from_photos.sql` is an optional local sample,
not a migration.) A Sets category can be added from Categories when needed.

| File | What it creates |
| --- | --- |
| `20261103090000_foundation_staff_permissions.sql` | `private` schema helpers, `roles`, `permissions`, `role_permissions`, `staff_members` (+ escalation guard), owner bootstrap, `audit_logs` (+ trigger), `profiles` (+ auto-create on sign-up) |
| `20261103090100_media_catalog_inventory.sql` | `media_assets`, `scent_families`, `categories`, `products` (+ publish guard), `product_variants`, `product_media`, `product_categories`, `product_scents`, `device_compatibility`, `bundle_items`, `inventory`, `inventory_movements`, `adjust_inventory()` |
| `20261103090200_content_settings_storage.sql` | `store_settings` (slider interval 2–30 s, default 4), `homepage_slides`, `homepage_sections`, `media_usage()`, Storage bucket `media` and its policies |
| `20261103090300_commerce_foundation.sql` | `customer_addresses`, `shipping_zones`, `shipping_rates`, `discount_codes`, `promotions`, `orders`, `order_items`, `order_status_history`, `payments`, `payment_events`, `expenses` (foundation only; no checkout) |
| `20261103090400_initial_content.sql` | Editable rows: 5 scent families, 3 categories (Electronic Diffusers, Fragrance Refills, Diffuser Accessories), the 6 existing product photos registered as site media, the current 3 homepage slides |
| `20261103090600_admin_write_functions.sql` | `save_product()` (atomic product save) and `reorder()` |
| `20261107090000_explicit_api_grants.sql` | Explicit, least-privilege table grants for the API roles (production does not grant them automatically): anon may only `SELECT` the 17 public tables; authenticated gets exactly what its policies use; no API role gets `TRUNCATE`. Grants and revokes only. |

**Destructive operations: none.** No `drop`, `truncate` or `delete` of
existing data. Every statement creates new objects or inserts seed rows with
`on conflict do nothing`. Existing product photos stay in `/public` and are
only referenced.

## Security model

- Row-level security is enabled on **every** table. The anonymous role can
  read only published products (and their variants, images, stock),
  visible categories, live slides, homepage sections, store settings, scent
  families, active shipping rates and live promotions. Nothing else.
- Staff permissions come from `role_permissions`; policies call
  `private.has_permission()` (a SECURITY DEFINER function in a schema the API
  does not expose). Identity is always `auth.uid()`, never an email or a
  client-editable claim.
- Roles: owner, admin, manager, editor, support, finance (matrix on the admin
  Staff page). The mapping is changed only by migration; no client can write it.
- Escalation guard (trigger on `staff_members`): nobody changes their own
  access; only owners grant, change or revoke owner/admin; the last active
  owner can't be removed or demoted.
- Publishing needs `catalog.publish` (managers and above) and an available
  variant. Stock changes only through `adjust_inventory()` (atomic, never
  below zero, records actor, change, reason, note, time). Orders can't be set
  to paid/refunded by staff; that's reserved for verified payment events.
- Audit log rows are written by triggers only and readable by `audit.read`.
- Storage bucket `media`: public read (storefront images), JPEG/PNG/WebP/AVIF
  up to 8 MB, listing and writes need `media.write`, paths are
  `products|categories|hero|library/<uuid>.<ext>` only.
- The secret key is used server-side for exactly one thing: sending staff
  invitations. Role assignment always runs through the inviter's own session.

Tests: `npm run test:db` (31 RLS and escalation tests) and
`npm run test:e2e:admin` (14 browser tests) against the local stack.

## Applying to the hosted project (after approval)

1. Back up: Supabase dashboard → Database → Backups (confirm a recent backup).
2. Auth settings (dashboard → Authentication):
   - Customer sign-up can stay enabled. Admin access never comes from signing
     up: it requires a staff role, which only an owner or admin can assign.
   - Minimum password length 10, require lower, upper case and digits.
   - URL configuration: Site URL `https://ranascent.vercel.app`; add redirect
     URLs `https://ranascent.vercel.app/**` and the Vercel preview pattern
     `https://ranascent-*-ahmed-alzabadia-s-projects.vercel.app/**`.
3. Apply the migrations, either:
   - `npx supabase link --project-ref fquqotnpvftmxgvmlqby` then
     `npx supabase db push` (needs the database password), or
   - paste each file, in order, into the SQL editor.
4. Run `supabase/verify/phase2_verify.sql` (read-only) in the SQL editor:
   every row must show `ok = true`.
5. Bootstrap the owner (below), only when you decide to.
6. Vercel → Project → Settings → Environment Variables:
   - `SUPABASE_SECRET_KEY` (Server only; Production + Preview) for invitations.
   - `NEXT_PUBLIC_SITE_URL=https://ranascent.vercel.app` (auth email links).
   - Leave `CATALOG_SOURCE` unset until products are published, then set
     `CATALOG_SOURCE=supabase` and redeploy.

## If a migration fails, or you need to undo Phase 2

- `supabase db push` runs each migration file in its own transaction. If a
  file fails, that file is rolled back completely and nothing after it runs;
  files already applied stay applied and are recorded in
  `supabase_migrations.schema_migrations`. Fix the cause and push again.
- Before applying, take a backup: Dashboard → Database → Backups (if your plan
  includes them), or `npx supabase db dump --linked -f backup.sql`.
- Full undo: `supabase/rollback/phase2_down.sql` (tested locally) removes
  exactly the Phase 2 objects and nothing else (no `CASCADE`); then delete the
  `media` bucket in the Storage dashboard and clear the Phase 2 rows from the
  migration history (command in the script). It deletes Phase 2 data, so use
  it only before real data exists or after a backup.
- The app keeps working throughout: with `CATALOG_SOURCE` unset the storefront
  never reads these tables.

## Owner bootstrap (one time)

No credentials are hard-coded and no email address grants anything.

1. Dashboard → Authentication → Users → **Add user** → *Send invitation* to the
   owner's email (or *Create new user* with a strong password and auto-confirm).
2. The owner accepts the invite / confirms the email.
3. Copy the user's **UID** from the Users list.
4. Dashboard → SQL editor, run (as the project owner):

   ```sql
   select private.bootstrap_owner('<USER-UID>', 'Owner name');
   ```

   It refuses if an owner already exists or the email isn't confirmed, and it
   can't be called through the API.
5. Sign in at `/ar/admin/login`. Invite further staff from **Staff**.

## Local development

```bash
npm run db:start        # local Supabase (Docker); first run downloads images
npm run db:reset        # re-apply all migrations
npm run db:dev-owner    # local-only owner: owner@rana.test / Owner-Local-Pass1
npm run dev:local       # next dev pinned to the local stack, CATALOG_SOURCE=supabase
npm run test:db         # RLS tests
npm run test:e2e:admin  # admin browser tests
npm run db:types        # regenerate src/types/database.ts
```

`scripts/with-local-supabase.sh` overrides any `NEXT_PUBLIC_SUPABASE_*`
values inherited from the shell so local work can't reach the hosted project.

## Not in Phase 2 (extension points ready)

Checkout, customer accounts and sign-up, order workflow, discount validation,
shipping fee calculation, Tap payments (KNET, cards, Apple Pay: tables
`payments` and `payment_events` are idempotent by provider event id and
written only by server code after signature verification), finance reports.
