SDLG Warranty Claim — Operator Entry Point
==========================================
Last updated: 2026-09-29 (release gate closed)

Production (sole host):
  https://sdlg-warranty-backup.esahuda9900.workers.dev

Start here:
  CURRENT_STATUS.md     — live expert snapshot (read this first)
  RUNBOOK.md            — daily ops + incident steps
  DEPLOYMENT.md         — build chain + release discipline
  RELEASE_READINESS.md  — gates (internal release: met)
  SECURITY.md           — intentional DEFINER / RLS rules
  FREE_TIER.md          — size limits + hygiene

Release status:
  Issue #12 closed 2026-09-29 — live expert verification accepted.
  Automated auth E2E remains optional enhancement.

Free Resilience Kit (backup):
  .github/workflows/sdlg-supabase-backup.yml
  SETUP.md
  RESTORE_CHECKLIST.md
  Designed for zero paid spend.

Engineering rules (short):
  - Prefer modules/*.js — do not add new apply-*.js injectors
  - Domain logic stays in Supabase
  - Smoke-check Cloudflare after every meaningful deploy
  - Never ship service_role to the browser / never disable RLS to "make it work"
