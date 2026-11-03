# Rana Scent design system — warm luxury

A premium home-fragrance identity: warm ivory and beige carry the page,
espresso carries type and primary actions, and muted gold is a quiet accent
taken from the logo. Deep espresso sections (scent experience, footer,
announcement bar) give the page contrast so it never reads as one flat beige.

## Principles

1. **Hierarchy through contrast and space, not decoration.** Alternate canvas,
   surface and beige sections; use espresso for the moments that need weight.
2. **Gold is an accent.** Logo, hairlines, the hover sheen, small badges. Text in
   gold uses `gold-deep` for contrast. Primary buttons are espresso.
3. **Colour carries meaning.** Each fragrance family has a hue, used on refills,
   filters and the mist, so colour helps people find scents.
4. **Mirrors by default.** Logical properties (`ms-`, `ps-`, `start-`, `end-`)
   so Arabic (RTL) and English (LTR) mirror without overrides.

## Tokens (`src/app/globals.css`)

Colours are semantic roles. Wrapping a section in `.theme-dark` swaps every
role to the espresso palette, so components work unchanged on dark.

| Role | Light | `.theme-dark` | Use |
| --- | --- | --- | --- |
| `canvas` | `#f8f5ef` warm ivory | `#231b17` | Page background |
| `surface` | `#f1ebe1` | `#2e241f` | Panels, inputs, drawers |
| `beige` | `#eae0d2` | `#3a2e27` | Product stages, bands |
| `sand` | `#d8c7ae` | `#4b3c33` | Arches, deeper fills |
| `taupe` | `#a99580` | `#8d7a66` | Decoration only (not text) |
| `ink` | `#352a24` espresso | `#f5efe6` | Type, primary buttons |
| `ink-soft` | `#66574b` (6.4:1) | `#cdbfae` | Secondary type |
| `gold` / `gold-light` | `#b69a65` / `#dcc8a0` | same | Accents, badges |
| `gold-deep` | `#7a5f33` (5.5:1) | `#d6bb85` | Gold-coloured text |
| `scent-*` | oud, musk, floral, fresh, woody | same | Fragrance families |

Type scale: fluid `text-step--1` … `text-step-6`.

## Typography

- **Readex Pro**: body text in both scripts (drawn for Arabic and Latin together).
- **Bodoni Moda**: English display; the perfume-house voice.
- **Reem Kufi**: Arabic display; geometric Kufic with the same formality.

## Layout

Header → hero slider → category quick access → featured products →
fragrance collections → scent experience (dark) → find your diffuser →
brand story → featured sets → footer (dark).

The header is sticky and always visible; it never hides on scroll and has its
own view-transition layer so navigation never cross-fades it.

## Motion

| Tool | Used for |
| --- | --- |
| CSS | Slide cross-fades and entrances, progress bars, drawers, reveals |
| Motion (`motion/react`) | Cart line items, badges, finder pill, wishlist heart |
| GSAP + ScrollTrigger | The pinned brand story (≥1024px only) |
| React `<ViewTransition>` | Card-to-product image morph, list reorders |
| WebGL (`ScentField`) | The mist in the dark scent-experience section |

All motion respects `prefers-reduced-motion` (the slider does not autoplay).

## Admin-managed content (Phase 2)

- **Hero slider**: `src/features/merchandising/hero-slides.ts`. Zod schemas for
  slides (position, enabled, draft/published, ar/en title and description, CTA
  labels and internal destinations, desktop + mobile images) and settings
  (`autoplayIntervalSeconds`, default 4). The carousel receives the interval as
  a prop; it is never hardcoded.
- **Categories**: `Category` in `src/features/catalog/types.ts` (image, position,
  enabled, `showOnHome`). The quick-access row reads `listHomeCategories()`.

## Logo

`src/components/brand/logo.tsx` holds the official logo slot (typographic
placeholder until the file is added). Do not redesign the logo.

## Product imagery

- Real photos live in `public/images/products/` (processed: 1600px, compressed,
  near-white studio background lifted to pure white). `ProductVisual` renders
  them with `mix-blend-multiply` on a stage colour, so the white falls away
  into the warm card. A blended photo's wrapper must paint its own stage
  colour (transforms and masks isolate blending).
- Without a photo, a neutral "Photo coming soon" panel shows. There are no drawn stand-ins.
- Every product is flagged `isSample`; device specs are marked provisional
  until Rana Scent confirms them.
