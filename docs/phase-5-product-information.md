# Phase 5: product information, free fragrances and policies

## Reference site

The reference store (raymondkw.com) could not be reached from the build
environment: its domain does not resolve there. Nothing here is based on its
pages. The specification fields, information sections and policy topics follow
the requirements Rana Scent provided. To use the reference for wording or
structure, allow `raymondkw.com` in the environment's network settings.

## Device specifications

Every field is optional and editable in **Admin → Products → Device details**.
The store shows only filled fields, in this fixed order:

| Field | Stored as | Shown as (EN / AR) |
| --- | --- | --- |
| Device type | text, both languages | text |
| Coverage | number (m²) | "Up to 1,000 m²" / "حتى 1,000 م²" |
| Fragrance capacity | number (ml) | "500 ml" / "500 مل" |
| **Dimensions** | width, height, depth + unit (cm or mm) | "Dimensions (W × H × D): 20 × 15 × 8 cm" / "الأبعاد (العرض × الارتفاع × العمق): 20 × 15 × 8 سم" |
| Weight | value + unit (g or kg) | "1.2 kg" |
| Power requirements | text | text |
| Power consumption | number (W) | "5 W" / "5 واط" |
| Operating method, control type, colours, material, installation, fragrance consumption | text | text |
| Noise level | number (dB) | "30 dB" / "30 ديسيبل" |
| Recommended spaces, maintenance, warranty, package contents | text | text |

Validation rules:
- Numbers must be positive. Arabic-Indic digits are accepted.
- Dimensions need all three values, or none.
- Text fields need both Arabic and English, or neither.
- The existing free-form specification lines remain available and are shown
  after the structured ones.
- The "provisional specifications" note keeps working through the
  "Specifications confirmed" checkbox.

## Information sections

There are ten optional bilingual sections:
- overview;
- features and benefits;
- coverage and recommended use;
- how to operate;
- installation;
- maintenance and cleaning;
- fragrance cartridges;
- what's in the box;
- warranty and support;
- important usage notes.

They appear on the product page as expandable panels, the first one open.
Formatting is limited to `## Heading`, `- item`, `1. step` and blank lines
between paragraphs. HTML is never interpreted.

## Free fragrances

- **Setting the count:** each diffuser has **Number of free fragrances**
  (1 or 2), which is required when saving a diffuser.
- **Which fragrances are offered:** refills have **Can be chosen as a free
  fragrance** (on by default). The dropdowns list published, eligible,
  in-stock refills from the live catalogue; nothing is hardcoded.
- **On the product page:**
  - a soft yellow note above the dropdowns, using the owner's wording:
    "يتم تأكيد اختيار العطور مع مندوب التوصيل" / "Fragrance selection will be
    confirmed with our delivery representative.";
  - one or two dropdowns ("Your First / Second Free Fragrance",
    "عطرك المجاني الأول / الثاني");
  - every choice is required before adding to the cart.
- **Same fragrance twice:** allowed by default. Admin → Settings → "Allow the
  same free fragrance twice" turns it off.
- **Cart:**
  - one line is one device variant plus one set of choices;
  - the choices apply to each device on the line, so 2 devices × 2 free
    fragrances gives 4 cartridges, recorded per device;
  - choices survive a refresh and can be changed on the cart page;
  - identical lines merge;
  - an unavailable choice is flagged.
- **Product cards:** for these devices the quick-add button opens the product
  page instead of adding directly.
- **Checkout:** shows the choices, marked "Free". The server re-checks
  everything in `quote_order` and `place_order`:
  - the exact count per device, taken from the product (never from the
    browser);
  - eligibility, publication and stock;
  - the duplicate rule.
  The order is refused with a clear message if anything is wrong. Free
  cartridges are never priced.
- **After the order:** each device's choices are stored in
  `order_item_fragrances` (names are snapshotted). They appear on the order
  confirmation page, in order emails and in the admin order page, where they
  are labelled as preferences to confirm on delivery. Nothing is ever
  substituted silently.

### Inventory decision (needs the owner's confirmation)

Refills are tracked as physical stock. **Free cartridges are not deducted from
stock automatically**, because:
1. the customer's choice is a preference, confirmed with the delivery
   representative and possibly changed then;
2. which refill size or variant is given free isn't defined.

A refill must be in stock to be offered, but choosing it reserves nothing.
After delivery, staff record the cartridges actually handed over in
**Inventory → Adjust** (reason "sale"). If the owner prefers automatic
reservation, define the free cartridge's variant and it can be added to
`place_order` and `release_order`.

## Policies

**Admin → Policies** (owner and admin only) lets the owner edit, save drafts,
preview, publish and unpublish six bilingual policies:
- returns and exchanges;
- refunds;
- warranty;
- delivery;
- terms and conditions;
- privacy.

Each shows its last-updated and published dates. Visitors see only published
text, on `/policies/<key>`, `/privacy`, `/terms` and `/shipping-returns`.
Until something is published, the existing built-in pages are shown, so
production is unchanged.

The six drafts are original texts for a Kuwait-based store. They are seeded
**unpublished**, and every business decision is marked `[OWNER TO CONFIRM …]` /
`[يحتاج تأكيد المالك …]`. The admin warns while any marker remains.
Decisions for the owner, with legal review recommended:
- return and defect-report windows;
- who pays change-of-mind return pickups;
- whether opened cartridges are returnable;
- refund timing and the cash-on-delivery refund method;
- whether delivery fees are refunded;
- warranty length per device and exclusions;
- delivery areas, times, failed-delivery attempts and fees;
- legal business name and registration;
- taxes and fees;
- service providers, analytics and cookies;
- data retention period and privacy contact.

None of the drafts promises a warranty period, refund timing or legal right
on the owner's behalf. Each states that it does not limit rights under
Kuwait's consumer protection law.

## Migrations (additive)

1. `20261120090000_product_details_fragrances_policies.sql`: new product
   columns, fragrance validation and storage, the policy table and functions,
   and updated `save_product`, `quote_order`, `place_order` and
   `get_order_for_customer`.
2. `20261120090100_phase5_api_grants.sql`: explicit grants.
3. `20261120090200_policy_drafts.sql`: six unpublished drafts. Existing rows
   are never overwritten.

Check with `supabase/verify/phase5_verify.sql`.
