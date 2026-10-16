# Progress PLAN v2.1 — Milestone 1 (+ partial M2)

**Updated:** 2026-10-16  
**Preview:** https://esahuda9900.github.io/Esahuda-Rizqi-Nugraha/preview/  
**Cutover (Milestone 3):** **FORBIDDEN until owner says AUTHORIZE CUTOVER** — see `docs/CUTOVER-POLICY.md`

## Production vs preview

| Path | App |
|------|-----|
| `/` | **Web lama** (active production) |
| `/preview/` | Web baru Vite SPA only |

CI: `scripts/guard-no-cutover.sh` + `AGENTS.md` ban accidental cutover.

## Parse / New Claim parity

See earlier table; focus remains parity without replacing production root.

## Rule

Do not change production root to SPA. Do not archive old web until owner signs **AUTHORIZE CUTOVER**.
