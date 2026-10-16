# Fase 0.2 — Inventaris database (production)

**Tanggal:** 2026-10-16  
**Project:** `frqvelcreczmnofldrga`  
**Metode:** query read-only via Supabase SQL  
**Schema change:** tidak ada

## 1. Tabel public + RLS

Semua **34** tabel di bawah punya `rowsecurity = true`.

| Table |
|-------|
| app_user_roles |
| ax_warranty_work_order_costs |
| ax_warranty_work_order_import_issues |
| ax_warranty_work_orders |
| branches |
| claim_audit_log |
| claim_number_counters |
| claim_status_history |
| claim_workflow_transitions |
| claims |
| customer_aliases |
| customers |
| dealers |
| machines |
| models |
| ops_incident_lessons |
| parts_master |
| sdlg_ax_branch_aliases |
| sdlg_data_sources |
| sdlg_model_naming_knowledge |
| sdlg_payment_batch_settlements |
| sdlg_payment_batches |
| sdlg_policy_component_taxonomy |
| sdlg_policy_part_mapping |
| sdlg_policy_part_master |
| sdlg_product_type_codes |
| sdlg_serial_correction_rules |
| sdlg_settlement_disputes |
| sdlg_settlement_lines |
| sdlg_settlements |
| service_policy_documents |
| service_policy_rules |
| service_policy_warranty_rules |
| wo_followups |

## 2. Policy (ringkas)

- **claims:** SELECT `claims_read_by_role`; INSERT `claims_insert_by_admin`; UPDATE `claims_update_by_admin`
- **Master** (branches, customers, dealers, machines, models, parts_master, aliases): SELECT authenticated; write = admin_*
- **claim_audit_log:** SELECT admin
- **claim_status_history:** SELECT by role
- Banyak tabel SDLG settlement/payment: SELECT authenticated saja

*(Detail `qual`/`with_check` tidak di-dump penuh di sini; bisa di-query ulang saat desain RLS baru — dilarang ubah tanpa izin.)*

## 3. Functions / RPC (penting untuk web baru)

| Routine | Catatan |
|---------|--------|
| create_sdlg_claim / update_sdlg_claim / delete_sdlg_claim | CRUD klaim resmi |
| next_sdlg_claim_id | Alokasi ID |
| update_claim_status / _atomic / _batch | Status + history |
| guard_claim_status_transition | Dipakai trigger |
| audit_claim_change | Audit |
| create_claim_with_history / record_initial_claim_history | History |
| resolve_sdlg_claim_context | Context resolve |
| sdlg_warranty_resolve_claim / sdlg_warranty_assess | Policy warranty |
| get_machine_360 | Unit 360 |
| search_warranty_master | Master search |
| sdlg_normalize_* / sdlg_lookup_unit | Normalisasi |
| apply_sdlg_settlement_paid_import | Settlement |

## 4. Triggers di `claims`

| Trigger | Timing | Event |
|---------|--------|-------|
| trg_auto_advance_claim_workflow | BEFORE | INSERT, UPDATE |
| trg_guard_claim_status_transition | BEFORE | UPDATE |
| trg_claims_parts_canonical | BEFORE | INSERT, UPDATE |
| trg_claim_audit | AFTER | INSERT, UPDATE, DELETE |
| trg_claim_initial_history | AFTER | INSERT |

## 5. Views (ops / monitoring — kandidat Fase 1+ / M2)

Contoh: `claim_ops_boss_v`, `claim_aging_v`, `claim_workflow_v`, `data_quality_health`, `v_machine_360_*`, `warranty_master_v`, `claim_warranty_resolution_v`, `free_tier_db_health`, … (total ~45 views).

## 6. Role storage

**Tabel:** `app_user_roles`  
**Kolom:** user_id, role, branch_id, display_name, is_active, created_at, updated_at  
**Nilai role teramati:** `admin`, `warranty_admin`, `viewer`

## 7. Implikasi Fase 1 (read-only)

- Boleh query `claims` + master + views dengan user authenticated (mengikuti RLS existing).
- Jangan INSERT/UPDATE dari web baru ke production sampai Fase 4 + staging lolos.
- Prefer RPC status/create saat menulis (Fase 4), jangan bypass trigger.
