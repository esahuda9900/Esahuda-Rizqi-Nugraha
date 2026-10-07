# Idempotency

DB sudah punya migration `harden_claim_idempotency_and_optimistic_concurrency` (2026-09-07).
Tidak diubah ulang. Double-submit harus no-op atau conflict jelas, bukan silent overwrite.
