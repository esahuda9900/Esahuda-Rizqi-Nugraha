-- Sync the debit-note schema change already applied to the live Supabase project.
-- Production migration version: 20260916151653 / add_payment_batch_debit_note.

ALTER TABLE public.sdlg_payment_batches
  ADD COLUMN IF NOT EXISTS debit_note_no text;

COMMENT ON COLUMN public.sdlg_payment_batches.debit_note_no
  IS 'ITR debit note / billing reference associated with the SDLG payment batch.';
