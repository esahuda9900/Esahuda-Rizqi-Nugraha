# F1 — Parts Schema Canonical — LIVE 2026-10-05

Applied to project `frqvelcreczmnofldrga`.

Objects:
- `private_normalize_part_object(jsonb)`
- `private_normalize_parts_array(jsonb)`
- trigger `trg_claims_parts_canonical` on `claims.parts`
- view `parts_schema_health`

Canonical keys: failurePartNo, replacementPartNo, description, qty, unitPrice, amount

Rollback only if needed:
```sql
BEGIN;
DROP TRIGGER IF EXISTS trg_claims_parts_canonical ON public.claims;
DROP FUNCTION IF EXISTS public.private_validate_parts_canonical();
DROP FUNCTION IF EXISTS public.private_normalize_parts_array(jsonb);
DROP FUNCTION IF EXISTS public.private_normalize_part_object(jsonb);
DROP VIEW IF EXISTS public.parts_schema_health;
COMMIT;
```
