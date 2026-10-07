INSERT INTO public.sdlg_data_sources (source_name,source_type,source_mime_type,source_sha256,source_size_bytes,source_date,description,metadata)
VALUES (
  'tableConvert.com_f5h7ki.md',
  'Dynamics AX Warranty Work Orders',
  'text/plain',
  'c9afaffb7508e61abc7fe95b22fca5998a3cd816fcfd3922e996e88d47955122',
  519692,
  '2026-09-16',
  'Dynamics AX internal work-order export used as the source-of-truth reference for warranty claim WO reconciliation. Two malformed export rows are quarantined and must not be auto-reconstructed.',
  '{"source_rows":789,"valid_wo_rows":787,"malformed_rows":2,"join_key":"wo_no","serial_is_not_unique":true,"snapshot_scope":"2024-10 through 2026-09"}'::jsonb
)
ON CONFLICT (source_sha256) DO UPDATE SET
  source_name=excluded.source_name,
  source_type=excluded.source_type,
  source_mime_type=excluded.source_mime_type,
  source_size_bytes=excluded.source_size_bytes,
  source_date=excluded.source_date,
  description=excluded.description,
  metadata=excluded.metadata,
  updated_at=now();