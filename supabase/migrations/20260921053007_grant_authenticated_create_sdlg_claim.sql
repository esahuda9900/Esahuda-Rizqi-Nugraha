-- Allow the authenticated app to invoke the canonical claim-creation RPC.
-- The function itself performs the admin/warranty_admin authorization check.
revoke execute on function public.create_sdlg_claim(jsonb) from public, anon;
revoke execute on function public.create_sdlg_claim(jsonb, jsonb) from public, anon;

grant execute on function public.create_sdlg_claim(jsonb) to authenticated;
grant execute on function public.create_sdlg_claim(jsonb, jsonb) to authenticated;
