-- Allow the authenticated app to invoke the canonical claim-update RPC.
-- The function itself performs the admin/warranty_admin authorization check.
revoke execute on function public.update_sdlg_claim(text, jsonb, jsonb) from public, anon;

grant execute on function public.update_sdlg_claim(text, jsonb, jsonb) to authenticated;
