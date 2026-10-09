SDLG Warranty Claim — Operator Entry Point
==========================================
Last updated: 2026-10-09 (GitHub Pages = sole production)

Production (sole host):
  https://esahuda9900.github.io/Esahuda-Rizqi-Nugraha/

RETIRED (do not use):
  https://sdlg-warranty-backup.esahuda9900.workers.dev
  Cloudflare Workers deploy path is archived.

Start here:
  README.md             — canonical production URL + deploy
  RUNBOOK_EMERGENCY.md  — rollback & incident (1 page)
  STABLE_BACKUP.md      — known-good branches

Deploy:
  Push to main → GitHub Actions "Deploy static content to Pages"
  Hard refresh after green: Ctrl+Shift+R

Engineering rules (short):
  - Prefer modules/*.js — do not add new apply-*.js injectors
  - Domain logic stays in Supabase
  - Smoke-check GitHub Pages after every meaningful deploy
  - Never ship service_role to the browser / never disable RLS to "make it work"
