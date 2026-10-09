# Release Stability

Production flow is intentionally one-way:

`GitHub main -> Vercel Production -> Supabase`

Supabase owns business data and workflow. Edge Functions are adapters. Gemini is optional assistance with local-parser fallback. Analytics, Notion and Exa are non-transactional.

Production deploys should originate from the Git integration. GitHub Actions are validation, regression-gate, and monitoring only.

## Release gates

Every frontend change touching `index.html`, the canonical warranty helper, or production patch scripts runs the production build gate in `frontend-ci.yml`.

The production build gate must pass:

- approved patch chain
- inline JavaScript syntax validation
- canonical warranty helper wiring
- canonical resolver contract checks
- warranty golden contract structure
- unsafe legacy zero-display injector guard

Production smoke monitoring checks the live Vercel URL, expected Supabase endpoint, canonical helper wiring, Supabase REST availability, and parser edge-function authentication protection.

The live warranty golden RPC test remains fail-closed when Supabase credentials are supplied to CI. When credentials are unavailable, the build reports the golden test as skipped rather than pretending it executed.

## Change discipline

`Reproduce -> root cause -> smallest isolated fix -> CI regression gate -> Vercel deploy -> production smoke -> verify`

Do not add broad text replacement or global runtime monkey-patches unless they are explicitly reviewed and protected by a regression test.
