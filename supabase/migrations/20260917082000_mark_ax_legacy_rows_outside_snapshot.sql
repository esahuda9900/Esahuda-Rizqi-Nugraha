UPDATE public.ax_warranty_work_orders
SET source_quality_status='LEGACY_NOT_IN_CURRENT_SNAPSHOT',
    source_quality_notes='Present in an earlier AX import but not present in the current uploaded 2026-09-17 source snapshot. Retained for historical traceability; not treated as current source evidence.',
    updated_at=now()
WHERE source_name='tableConvert.com_f5h7ki.md'
  AND wo_no IN ('WO25038385','WO25038397','WO25038403','WO25038408','WO25038423','WO25038434','WO25038436','WO25038459','WO25038471','WO25038477');

UPDATE public.ax_warranty_work_orders
SET source_quality_status='OK',
    source_quality_notes=NULL,
    updated_at=now()
WHERE source_name='tableConvert.com_f5h7ki.md'
  AND wo_no NOT IN ('WO25038385','WO25038397','WO25038403','WO25038408','WO25038423','WO25038434','WO25038436','WO25038459','WO25038471','WO25038477');
