# SDLG Warranty Architecture Stability Contract

Last updated: 2026-09-23 (expert pass — Vercel retired)

## System of record
- GitHub `main`: source code authority.
- Supabase: data, auth, RLS, claim workflow and business-rule authority.
- **Cloudflare Workers**: sole production frontend delivery (static assets).
- Supabase Edge Functions: isolated application adapters; failures must degrade safely.
- Gemini, Data Analytics, Notion and Exa: non-transactional support tools.
- AWS Data Analytics: optional sandbox only; never part of the production claim write path.

## Dependency rules
1. Production claim writes must not depend on Gemini, Notion, Exa, AWS Analytics or analytics tooling.
2. GitHub Actions should be read-only with respect to repository history. Any mutation workflow must be explicitly reviewed, narrowly scoped, and must not silently rewrite `main` on ordinary pushes.
3. CI must not directly deploy infrastructure; deployment ownership stays with the platform integration (Cloudflare).
4. Frontend validation must not be coupled to unrelated workflow-only changes.
5. Backups are isolated and must never mutate application source or production claim data.
6. Any new critical dependency must be documented here before being introduced.

## Free-tier operating rules
- GitHub Actions: keep CI lightweight and avoid mutation loops that consume unnecessary Actions minutes.
- Cloudflare Workers: sole release surface; auto-deploy from `main` via Git integration / Wrangler.
- Supabase Free: one production project; avoid unnecessary polling and extra environments.
- Notion: documentation/knowledge only, not transactional storage.
- Exa: on-demand research only; never call it from runtime transactions.
- AWS Data Analytics: isolated sandbox only; never part of the production claim write path.

## Release flow
`GitHub main → CI/Smoke → Cloudflare Workers (sole production) → Supabase runtime`

## Stability rule
If a non-critical tool is unavailable, claim CRUD and workflow transitions must continue to function through Supabase without that tool.
