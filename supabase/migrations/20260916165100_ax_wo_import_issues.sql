CREATE TABLE IF NOT EXISTS public.ax_warranty_work_order_import_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text NOT NULL,
  source_sha256 text NOT NULL,
  source_row_number integer NOT NULL,
  issue_code text NOT NULL,
  issue_note text,
  raw_source_line text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_sha256, source_row_number)
);
ALTER TABLE public.ax_warranty_work_order_import_issues ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY ax_wo_import_issues_read_authenticated
    ON public.ax_warranty_work_order_import_issues
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO public.ax_warranty_work_order_import_issues
(source_name,source_sha256,source_row_number,issue_code,issue_note,raw_source_line)
VALUES
('tableConvert.com_f5h7ki.md','c9afaffb7508e61abc7fe95b22fca5998a3cd816fcfd3922e996e88d47955122',616,'MALFORMED_SOURCE_ROW','Exported row has no WO number and is missing the leading source columns; preserved for manual source recovery instead of inventing a WO identity.','| Temporare install relay Temporare install relay lokal K19" | SDLG COMPACTOR SINGLE DRUM | LAJU PERDANA INDAH PT | LAJU PERDANA INDAH PT | 0541               | ITR-000011590 | Vinsensius Triadmadi | Palembang_Field | ITR - PALEMBANG | 36.00 | SDLG | PALEMBANG | | | 021 57940482 | | | | | | | | | |'),
('tableConvert.com_f5h7ki.md','c9afaffb7508e61abc7fe95b22fca5998a3cd816fcfd3922e996e88d47955122',627,'MALFORMED_SOURCE_ROW','Exported row has no WO number and is missing the leading source columns; preserved for manual source recovery instead of inventing a WO identity.','| Replace With New sealing ring axelSDLG WHEEL LOADER" | SDLG WHEEL LOADER | KAILANI | KAILANI | 2285 | ITR-000011405 | Vinsensius Triadmadi | Palembang_Field | ITR - PALEMBANG | 10.00 | SDLG | PALEMBANG | | | 082378493366 | | | | | | | | | |');
ON CONFLICT (source_sha256, source_row_number)
DO UPDATE SET issue_code=excluded.issue_code, issue_note=excluded.issue_note, raw_source_line=excluded.raw_source_line;