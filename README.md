# Rana Scent

E-commerce website for scent diffusers and fragrance cartridges.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Cache Components, Turbopack) with TypeScript
- Tailwind CSS v4
- ESLint (`eslint-config-next`)
- Supabase (`@supabase/ssr`) for auth and data
- Deployed on Vercel

## Getting started

Requires Node.js 20.9 or newer.

```bash
npm install
cp .env.example .env.local   # optional until Supabase is connected
npm run dev
```

Open http://localhost:3000. You are redirected to `/ar` or `/en` based on your
browser language.

| Script              | Purpose                                   |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Start the dev server                      |
| `npm run build`     | Production build                          |
| `npm run start`     | Serve the production build                |
| `npm run lint`      | Run ESLint                                |
| `npm run typecheck` | Generate route types and run `tsc`        |

## Project structure

```
src/
  app/
    [lang]/            # Every route lives under the locale segment
      layout.tsx       # Root layout: sets <html lang dir>, fonts, metadata
      page.tsx
    globals.css        # Tailwind entry and design tokens
  components/          # Shared UI components
  i18n/
    config.ts          # Supported locales, default locale, text direction
    dictionaries.ts    # getLocale() / getDictionary() for Server Components
    dictionaries/      # ar.json, en.json translation files
  lib/
    env.ts             # Typed access to environment variables
    supabase/
      client.ts        # Browser client (Client Components)
      server.ts        # Server client (Server Components, Actions, Route Handlers)
      proxy.ts         # Session refresh used by src/proxy.ts
  types/
    database.ts        # Supabase generated types (placeholder)
  proxy.ts             # Locale redirect + Supabase session refresh
```

## Internationalization (Arabic / English)

- Locales are `ar` (default, right-to-left) and `en` (left-to-right), defined in
  `src/i18n/config.ts`.
- `src/proxy.ts` redirects paths without a locale using the `NEXT_LOCALE`
  cookie, then the `Accept-Language` header, then the default locale.
- The root layout sets `lang` and `dir` on `<html>`. Use Tailwind's logical
  utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`)
  and the `rtl:` / `ltr:` variants so layouts mirror correctly.
- Add strings to both `ar.json` and `en.json`; read them in Server Components
  with `await getDictionary()`.

## Supabase

Supabase is wired up but not connected to a project. Set
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in
`.env.local` (and in Vercel project settings) to enable it. Until then the
proxy skips session refresh and the app runs without a backend.
