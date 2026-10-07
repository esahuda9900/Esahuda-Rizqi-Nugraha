GRANT SELECT ON TABLE public.sdlg_settlements TO authenticated;
NOTIFY pgrst, 'reload schema';
