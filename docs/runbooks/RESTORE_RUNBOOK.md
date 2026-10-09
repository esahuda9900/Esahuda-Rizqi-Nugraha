# Restore Runbook (non-prod only)

1. Download artifact dari GitHub Actions backup workflow
2. Buat target Supabase non-prod / branch
3. `psql` / `pg_restore` ke target — **jangan** overwrite production tanpa approval tertulis
4. Success: claim count match, RLS on claims = true, RPC `sdlg_warranty_resolve_claim` exists
5. Estimasi total 60–120 menit
