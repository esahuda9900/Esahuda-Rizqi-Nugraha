import { getSupabase } from './supabase';

export type AppRole = 'admin' | 'warranty_admin' | 'viewer' | string;

export type UserRoleRow = {
  user_id: string;
  role: AppRole;
  display_name: string | null;
  is_active: boolean | null;
};

export async function fetchMyRole(userId: string): Promise<UserRoleRow | null> {
  const id = String(userId || '').trim();
  if (!id) return null;
  const sb = getSupabase();
  const { data, error } = await sb
    .from('app_user_roles')
    .select('user_id,role,display_name,is_active')
    .eq('user_id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as UserRoleRow) || null;
}

export function canExportClaims(role: AppRole | null | undefined): boolean {
  return role === 'admin' || role === 'warranty_admin';
}

export function canFullBackup(role: AppRole | null | undefined): boolean {
  return role === 'admin';
}
