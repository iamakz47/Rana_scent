# Rana Scent

E-commerce website for scent diffusers and fragrance cartridges, in Arabic
(RTL, default) and English (LTR), priced in Kuwaiti dinar.

> **Status: visual prototype (Phases 0–1).** Products, prices and stock are
> sample data, product images are drawn placeholders, and checkout is not yet
> connected. The official logo slot is in `src/components/brand/logo.tsx`.

## Stack

- [Next.js 16](https://nextjs.org) App Router with Cache Components, React 19.3, TypeScript
- Tailwind CSS v4 design tokens (`src/app/globals.css`, documented in [`docs/design-system.md`](docs/design-system.md))
- Motion for React, GSAP + ScrollTrigger, React View Transitions, WebGL scent field
- Supabase (`@supabase/ssr`), wired up and connected in Phase 2
- Zod for validating untrusted input (URL params, local storage, env)
- Vitest (unit) and Playwright + axe (end-to-end, accessibility)
- Deployed on Vercel

## Getting started

Requires Node.js 22.

```bash
npm install
cp .env.example .env.local   # optional until Supabase is connected
npm run dev
```

Open http://localhost:3000. You are redirected to `/ar` or `/en` from your
saved choice or browser language.

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm run start` | Production build / serve it |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate route types and run `tsc` |
| `npm run test` | Unit tests (Vitest) |
| `npm run test:e2e` | Playwright: 7 widths × 2 languages, axe audit, cart/catalog/nav flows (needs a build) |
| `npm run check` | Lint, types and unit tests together |

CI (`.github/workflows/ci.yml`) runs all of these on every pull request.

## Project structure

```
src/
  app/
    [lang]/layout.tsx        Root layout: <html lang dir>, fonts, metadata
    [lang]/(store)/          Storefront: home, shop, collections, products,
                             cart, wishlist, about, contact, FAQ, policies, 404
    robots.ts, sitemap.ts    Indexing is off until SITE_INDEXING=true
    globals.css              Design tokens and motion primitives
  components/
    brand/                   Logo slot, ScentField (WebGL mist), ProductArt
    layout/                  Header, mobile nav, footer, page templates
    ui/                      Buttons, icons, price, availability
  features/
    catalog/                 Types, sample data, queries, cards, gallery, filters
    cart/                    Local cart store, drawer, cart page
    home/                    Hero, scent library, story, space finder
    wishlist/                Local wishlist
  i18n/                      Locales, dictionaries (ar.json, en.json), client context
  lib/                       env (Zod), money (integer fils), Supabase clients
  proxy.ts                   Locale redirect + Supabase session refresh
e2e/                         Playwright specs
.claude/skills/              Vetted agent skills for future sessions
```

## Conventions

- **Money** is integer fils (`1 KWD = 1000 fils`). Client-side prices are for
  display only; checkout recomputes everything on the server.
- **RTL**: use logical utilities (`ms-*`, `ps-*`, `start-*`, `end-*`,
  `text-start`) so layouts mirror automatically.
- **Copy**: add strings to both `ar.json` and `en.json` (the Arabic file is
  type-checked against the English shape).
- **Motion**: respect `prefers-reduced-motion`; see the design system doc.

## Environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase project (publishable key only) |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin; defaults to the Vercel production domain |
| `SITE_INDEXING` | Set to `true` at launch to allow search engines |
