GRANT SELECT ON TABLE public.sdlg_payment_batch_settlements TO authenticated;
GRANT SELECT ON TABLE public.sdlg_payment_batches TO authenticated;
NOTIFY pgrst, 'reload schema';
