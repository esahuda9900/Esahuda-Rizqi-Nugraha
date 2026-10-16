import { getSupabase } from './supabase';

export type AppRole = 'admin' | 'warranty_admin' | 'viewer' | string;

export type UserRoleRow = {
  user_id: string;
  role: AppRole;
  display_name: string | null;
  is_active: boolean | null;
  branch_id?: string | null;
};

export async function fetchMyRole(userId: string): Promise<UserRoleRow | null> {
  const id = String(userId || '').trim();
  if (!id) return null;
  const sb = getSupabase();
  const { data, error } = await sb
    .from('app_user_roles')
    .select('user_id,role,display_name,is_active,branch_id')
    .eq('user_id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as UserRoleRow) || null;
}

export async function fetchAllRoles(): Promise<UserRoleRow[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('app_user_roles')
    .select('user_id,role,display_name,is_active,branch_id')
    .order('role', { ascending: true })
    .limit(200);
  if (error) throw error;
  return (data || []) as UserRoleRow[];
}

export function canExportClaims(role: AppRole | null | undefined): boolean {
  return role === 'admin' || role === 'warranty_admin';
}

export function canFullBackup(role: AppRole | null | undefined): boolean {
  return role === 'admin';
}

export function canAdminCenter(role: AppRole | null | undefined): boolean {
  return role === 'admin' || role === 'warranty_admin';
}
