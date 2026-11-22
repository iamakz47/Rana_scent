# Phase 6: simple product editor and colour variants

## The editor (Admin → Products)

Six numbered sections, in Arabic or English:

1. **Basic information:** Arabic name (English optional; the Arabic name is
   used when it's empty), type, category.
2. **Price & stock:** one price. Products without colours also have their
   quantity and SKU here (the SKU is filled in automatically). "Add another
   option" adds sizes or other non-colour options.
3. **Photos & colours:** shared product photos, then one card per colour:
   - Arabic name (English optional), swatch (preset or any colour);
   - quantity, an optional different price, SKU;
   - its own photos (upload directly, reorder, first one is the main photo);
   - available for sale, make default (the first card is the default), remove.
4. **Specifications & description:** the six specifications (النوع، التغطية،
   الشاشة، سعة العبوة، التركيب، اللون) as plain Arabic text, with optional
   English, then one large description with Arabic and English tabs.
   - Headings: a short line ending with a colon (المميزات:) or "## ".
   - Lists: lines starting with "1." or "-". Line breaks are kept.
   - With colours, "اللون" shows the colour the customer selects.
5. **Free fragrances:** none, 1 or 2 (diffusers); refills choose whether
   they can be picked as a free fragrance.
6. **Publishing:** featured / new, then **Save as draft** or **Save and
   publish** (publishing still needs a Manager, Admin or Owner).

Everything else (page address, short description, scents, rooms,
compatible devices, older specification and information fields, SEO) is
under **Advanced settings**, closed by default. Nothing existing is deleted:
older specification values (dimensions, weight…) are kept but no longer
shown; coverage in m² and capacity in ml are shown as text in the new fields.

**Quantities:** saving records each change in the stock history ("initial" for
a first quantity, otherwise "correction", note "Product editor"). Staff
without stock permission see quantities read-only.

**Duplicate product** (side panel): a new unpublished draft with the same
texts, specifications, colours, prices and photos (photos are shared, not
copied). SKUs get a new suffix and quantities start at zero.

## Storefront

- Two or more colours: swatch buttons on the product page. Choosing one
  switches the photos (with a short fade, no reload), price, stock and the
  "Colour" specification. One colour, or none: no colour controls.
- A colour without its own photos uses the shared product photos.
- Product cards show small swatches that switch the card photo and open the
  product page on that colour (`?color=SKU`).
- Cart, checkout, order confirmation, emails and admin orders show the
  colour (it is the variant label). Each colour is its own cart line and
  its own stock; the server prices, checks stock and releases stock per
  colour exactly as before. Colour changes don't clear fragrance choices.

## Migration

`20261121090000_color_variants.sql` (additive): `product_variants.color_hex`,
`product_media.variant_id` (photo → colour), and `save_product` storing both
(and accepting "0" free fragrances). Until it is applied, the editor still
saves everything else; swatches and photo-to-colour links are ignored.
