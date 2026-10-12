-- app_user_roles policies call private.is_admin() as the signed-in user.
-- EXECUTE is required for those policies. The function stays in schema private,
-- so it is not published on /rest/v1/rpc.
grant execute on function private.is_admin() to authenticated;
revoke all on function private.is_admin() from public, anon;
