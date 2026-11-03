# Rana Scent — project status and handover

_Last updated: 2026-11-03._

## Overview

A bilingual (Arabic RTL default, English LTR) e-commerce site for Rana Scent
(Kuwait): electronic scent diffusers, fragrance refills (aroma oils), sets
and accessories. Prices in Kuwaiti dinar (KWD), stored as integer fils.

- **Repository:** `iamakz47/Rana_scent` (public). Work happens on branch
  `claude/rana-scent-env-verify-6prcez`.
- **Open PR:** #3, "Phase 0–1: foundations and premium storefront". Not merged.
- **Hosting:** Vercel. Production `ranascent.vercel.app` builds from `main`;
  PR #3 has an automatic preview deployment.
- **Database:** Supabase project "Rana scent" (`fquqotnpvftmxgvmlqby`).
  Environment variables `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are set in Vercel and verified.
  **No tables or migrations yet.**

## Stack

- Next.js 16.4 (App Router, Cache Components, Turbopack), React 19.3, TypeScript
- Tailwind CSS v4 with semantic design tokens in `src/app/globals.css`
- Motion for React, GSAP + ScrollTrigger, React `<ViewTransition>`, a small WebGL mist
- `@supabase/ssr` (browser, server and proxy clients ready; publishable key only)
- Zod for all untrusted input; Vitest unit tests; Playwright + axe end-to-end tests
- GitHub Actions CI: lint, types, unit, build, e2e

## Done

### Phase 0: foundations
- Project setup, security headers, locale routing (`/ar`, `/en`) via `src/proxy.ts`.
- Vetted agent skills saved in `.claude/skills/` (Anthropic frontend-design,
  Vercel React/Next, Supabase, GSAP).
- Tests: 18 unit and 39 end-to-end. These cover 7 screen widths × 2 languages for
  layout overflow, the axe accessibility audit, cart, filters, wishlist, the hero
  slider, header stability and the mobile menu.

### Phase 1: storefront prototype (sample data, real photos)
- **Design:** warm luxury palette (ivory `#F8F5EF`, beige, sand, espresso
  `#352A24`, muted gold `#B69A65`), with `.theme-dark` espresso sections. Fonts:
  Bodoni Moda (English display), Reem Kufi (Arabic display), Readex Pro (body).
  Documented in `docs/design-system.md`.
- **Header:** sticky and always visible. The earlier disappearing-header bug was
  caused by auto-hide on scroll plus a view-transition cross-fade; it's fixed.
- **Homepage order:** header → hero slider → categories → featured products →
  fragrance collections → scent experience → find your diffuser → brand story →
  featured sets → footer.
- **Hero slider:** admin-ready data model in `src/features/merchandising/hero-slides.ts`.
  Zod schemas; slides have position, enabled, draft/published, Arabic/English
  copy, CTA links (internal paths only) and desktop/mobile images. The autoplay
  interval is set in seconds (default 4). The carousel is accessible: pause/play,
  dots, swipe, RTL-aware, and no autoplay under reduced motion. The accessories
  slide is disabled until accessory photos exist.
- **Categories:** Electronic Diffusers (الفواحات الإلكترونية), Fragrance Refills
  (عبوات العطر), Diffuser Accessories (إكسسوارات الفواحات). The model has image,
  position, enabled and `showOnHome`.
- **Pages:** shop (search, filters, sort in the URL), collections, product pages
  (gallery, variants, stock, compatibility, fragrance notes, provisional specs,
  related products, JSON-LD), cart drawer, cart page, wishlist (stored locally),
  about, contact, FAQ, shipping, privacy, terms (marked drafts), 404.
- **Images:** only real Rana Scent photos, in `public/images/products/`. Anything
  without a photo shows a "Photo coming soon" panel.

## Sample data (provisional, replace with real details)

Data lives in `src/features/catalog/sample-data.ts`.

| Product | Photo | Price (KWD) |
| --- | --- | --- |
| Rana Tower (floor tower, black & bronze) | yes | 119.000 |
| Rana Majlis (black LCD large-space unit) | yes | 79.000 |
| Rana Aura (champagne plug-in, touch panel) | yes (2) | 29.000 |
| Rana Mini (white plug-in) | yes | 15.000 |
| Rana Drive (car) | no | 39.000 |
| 6 aroma oil refills (Oud Royale, Midnight Musk, White Jasmine, Damask Rose, Sea Salt Vetiver, Cedar Smoke) | shared bottle photo | 200 ml / 500 ml |
| 2 sets, 2 accessories | no | — |

Device specifications are assumptions and are labelled "provisional" on the site.

## Still needed from Rana Scent
- The official logo file. The header shows a text placeholder; the slot is
  `src/components/brand/logo.tsx`.
- Real product names, prices, specifications, scents and refill sizes.
- Photos of the car diffuser, accessories and sets, plus more angles of each product.
- Contact details and policy text for the draft pages.

## Next phases (planned)
2. Supabase schema with migrations, reviewed before applying: catalog, inventory,
   customers, orders, payments, content (hero slides, categories), staff roles,
   audit logs. Row-level security on every table; admin authentication with roles.
3. Move the catalog and pages onto Supabase data.
4. Cart and checkout (server-side price recalculation), customer accounts, guest checkout.
5. Admin dashboard: products, inventory, orders, customers, slider, categories, media.
6. Payments: Tap Payments (KNET, Visa/Mastercard, Apple Pay), using a mock provider
   first, verified server-side with webhooks. Never trust the redirect.
7. Marketing, content, finance, analytics.
8. Launch hardening: Content-Security-Policy, performance, set `SITE_INDEXING=true`.

## Working rules
- Never trust client prices; money is integer fils (`src/lib/money.ts`).
- Use logical CSS properties so RTL mirrors automatically; every string goes in
  both `ar.json` and `en.json`.
- Before a PR: `npm run check`, `npm run build`, `npm run test:e2e`.
- Don't touch the MicroLine Supabase project or other projects.
