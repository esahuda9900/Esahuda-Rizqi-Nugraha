# BUGS.md

Catat bug di luar lingkup tugas aktif. Jangan "selipkan fix" di PR lain.

| Tanggal | Area | Gejala | Severity | Status |
|---------|------|--------|----------|--------|
| 2026-10-16 | apps/web parse (sebelum TSV fix) | Field parse kosong pada form tab-separated | high | fixed (parser TSV v0.3) |
| 2026-10-21 | auth / route-guard | Console spam berulang `auth event SIGNED_IN` setelah login (banyak listener) | low | open — tidak memblok form identity (#9) |
| 2026-10-21 | legacy form | Flicker / kontaminasi data antar klaim | high | mitigated (#9 merged) — tunggu konfirmasi uji manual A↔B pemilik |
