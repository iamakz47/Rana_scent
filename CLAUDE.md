@AGENTS.md

# Rana Scent

- Next.js 16 App Router with Cache Components; read `node_modules/next/dist/docs/` before using framework APIs.
- Money is integer fils (`src/lib/money.ts`). Never use floats or trust client prices.
- All routes live under `src/app/[lang]`; storefront pages under `(store)`. Use logical CSS properties so RTL works.
- Design rules: `docs/design-system.md`. Vetted agent skills: `.claude/skills/` (see its README).
- Before a PR: `npm run check`, `npm run build`, `npm run test:e2e`.
