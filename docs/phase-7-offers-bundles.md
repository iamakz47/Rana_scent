# Phase 7: Offers & Bundles

## What an offer is

An offer **is a product** (`type = 'bundle'`), built on `bundle_items` (a
table that existed since Phase 2 but nothing used until now). Nothing is
duplicated: the owner picks existing products. A bundle gets exactly one
`product_variants` row — its price is the owner's one final figure — and
one `bundle_items` row per included product (quantity, and an optional
locked colour). Publishing, unpublishing, archiving and deleting an offer
reuse the exact same admin actions a normal product already has.

## The owner's workflow (Admin → Offers)

**+ Create offer** → search and tick existing products → set a quantity
per product and, for a product with two or more colours, either leave it
"العميل يختار" (customer chooses, the default) or lock it to one colour →
type one price → see the original total, the saving and the percentage
update live → Save as draft, or Save and publish.

- No SKU, no slug, no manual stock entry: the server generates both, and
  stock is never tracked on the offer itself (see below).
- The server — never the browser — computes the original total and
  rejects a price that isn't a genuine saving (`offer_price_too_high`) or
  isn't positive (`offer_price_invalid`).
- An offer cannot include another offer, and a locked colour must belong
  to the product it's locked on (both enforced by a database trigger).
- Publishing is blocked unless the offer has at least one included
  product **and every one of them is itself currently published** —
  otherwise the storefront could show an incomplete bundle while still
  charging the full price.
- Optional, collapsed by default: description, a start/end schedule, and
  "allow discount codes to combine with this offer" (off by default — see
  Discounts below).
- **Duplicate offer:** a new draft with the same products, quantities,
  locked colours and price; any schedule is cleared so the copy doesn't
  inherit an expired or future window.
- **Delete:** only a draft (never a published offer), same rule as for a
  product.

## Storefront

- `/offers`: every published, currently-scheduled offer — image, name,
  "Includes N products", original price struck through, offer price,
  savings percentage, a details link.
- `/offers/[slug]`: every included product with its image and quantity;
  a colour picker (reusing the same swatches as a normal product page)
  for anything not locked, defaulting to its own default colour and
  disabling out-of-stock colours; the existing free-fragrance picker (and
  its exact required caution text) for any included diffuser that has
  one; the bundle price, the original price and the saving; one "Add to
  cart" for the whole bundle (one quantity stepper, not one per item).
- A bundle in the cart is **one line**: the offer's name, every included
  product indented underneath with its chosen colour and fragrances, the
  bundle's price and quantity. Two cart lines of the same offer with
  different colour choices stay separate, never merged.
- A direct link to a bundle's product page (`/products/[slug]`) redirects
  to its offer page; a bundle never appears in the regular shop grid,
  search, or "related products".

## Checkout: one price, real stock

A bundle line still bills at the offer's own flat price — checkout prices
it exactly like any other product, from its own variant. What's new is
that the same checkout call also **expands it into its included
products**, so the real stock they share with every standalone sale is
correctly checked and reserved:

- The owner's locked colour always wins over whatever the browser sends;
  an unlocked item uses the browser's chosen colour, re-validated.
- A short/invalid submission (wrong product, wrong colour, insufficient
  stock, a missing required free-fragrance choice) rejects the whole
  checkout before anything is created — exactly like a standalone line.
- Two bundle lines of the same offer with different colours are each
  validated and recorded on their own, never merged into one average.
- Every sale (standalone or inside a bundle) now actually respects
  `track_inventory`: a product explicitly marked "always available"
  (including the offer's own placeholder variant, which is never
  stock-tracked) is no longer wrongly blocked once a counter hits zero —
  this was a latent gap the existing checkout already had everywhere
  else, closed as part of this change.
- The order (admin and the guest confirmation page) shows the full
  breakdown: the bundle line, then every real product inside it with its
  colour, quantity and any confirmed free-fragrance choices — a new pair
  of tables, `order_item_components` and `order_item_component_fragrances`,
  mirror `order_items`/`order_item_fragrances` for this purpose.
- Cancelling a bundle order restores stock to the real included products
  (grouped across every bundle line of that order), not to the offer's
  own placeholder.

## Discount codes

One discount code applies to a whole order; there's no mechanism to
apply it to only part of a cart. So by default, a discount code is
**rejected outright** (`discount_blocked_by_offer`) when the cart contains
an offer that doesn't allow stacking — the owner opts an individual offer
into allowing it.

## Admin nav

"العروض" now opens this feature. The discount-codes screen it used to
label is relabelled "رموز الخصم" ("Discount codes") — it didn't move, it
just has an accurate name now that a real "Offers" feature exists.

## Migration

`20261123090000_offers_bundles.sql` (additive): `bundle_items.locked_
variant_id`; `products.offer_starts_at` / `offer_ends_at` / `allow_
discount_stacking`; `order_item_components` and `order_item_component_
fragrances`; the publish guard extended for bundles; `save_offer`; and
`price_cart` / `quote_order` / `place_order` / `release_order` /
`get_order_for_customer` extended for a bundle line. Nothing existing is
removed or renamed; a database without this migration simply has no
Offers feature yet (as with every earlier phase's migration).

## Tests

- `tests/db/offers.test.ts`: `save_offer` validation (price bounds, item
  count, locked-colour ownership, no nesting), the publish guard, checkout
  pricing/stock/fragrances for a bundle line, tamper-resistance of a
  locked colour, two differently-coloured lines of the same offer staying
  separate, cancellation restoring the real components' stock, and
  discount-code stacking being blocked by default.
- `e2e-admin/offers.spec.ts`: create, publish, edit, duplicate, delete,
  and the rejected-price case, end to end against the local stack.
- `e2e/offers.spec.ts`: listing, detail page, colour/fragrance selection,
  add-to-cart gating, the cart breakdown, and two colours of the same
  offer staying separate, end to end against the local stack (skips
  itself with a clear reason when no local Supabase stack is running,
  same as the admin suite).
