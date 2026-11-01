# Rana Scent design system — "Visible Scent"

Scent is invisible; Rana Scent makes the machines that carry it through a
room. The identity makes scent visible, built on the brand's gold, deep
charcoal and dark navy.

## Principles

1. **One bold thing.** The scent field (animated mist) is the signature. Everything
   around it stays quiet: no decorative gradients, no eyebrow labels, no
   motion that doesn't answer the visitor or reveal something.
2. **Gold means value or action.** Gold is used for the logo, prices and the
   primary button. Never as decoration.
3. **Colour carries meaning.** Each fragrance family has a hue, used on refills,
   filters and the mist, so colour helps people find scents.
4. **Mirrors by default.** Every layout uses logical properties (`ms-`, `ps-`,
   `start-`, `end-`), so Arabic (RTL) and English (LTR) mirror without
   overrides.

## Tokens (`src/app/globals.css`)

| Token | Value | Use |
| --- | --- | --- |
| `navy-950` → `navy-600` | `#060c17` → `#2a4570` | Night surfaces, the "chamber" |
| `charcoal-950` → `charcoal-400` | `#141518` → `#8a8d96` | Text on light, neutrals |
| `porcelain` | `#f1f2f5` | Light editorial sections |
| `ivory` | `#ece9e2` | Text on dark |
| `gold-200` → `gold-700` | `#f3e4b9` → `#6c5126` | Brushed metal (`text-gold`, `bg-gold`) |
| `scent-oud/musk/floral/fresh/woody` | see file | Fragrance families |

Type scale: fluid `text-step--1` … `text-step-6` (clamp-based, 360px → 1440px).

## Typography

- **Readex Pro**: body text in both scripts (drawn for Arabic and Latin together).
- **Bodoni Moda**: English display; the perfume-house voice.
- **Reem Kufi**: Arabic display; geometric Kufic with the same formality.

Display type is set large and tight; body copy stays under ~65 characters.

## Motion

| Tool | Used for |
| --- | --- |
| CSS (`@starting-style`, scroll-driven `view()`) | Drawers, sheets, section reveals, hero entrance, parallax |
| Motion (`motion/react`, `LazyMotion`) | Cart line items, badges, finder pill, wishlist heart |
| GSAP + ScrollTrigger | The single pinned story section (≥1024px only) |
| React `<ViewTransition>` | Product image morph from card to product page; list reorders |
| WebGL (`ScentField`) | The mist, paused off-screen, frozen under reduced motion |

All motion respects `prefers-reduced-motion`.

## Logo

`src/components/brand/logo.tsx` holds the official logo slot. Until the file
is added, a typographic placeholder renders (marked `data-logo-placeholder`).
Do not redesign the logo.

## Placeholder imagery

`ProductArt` draws illustrations until product photography exists. Every
product image shows a "Placeholder image" tag; every product is flagged
`isSample`. Device specifications are intentionally absent until supplied.
