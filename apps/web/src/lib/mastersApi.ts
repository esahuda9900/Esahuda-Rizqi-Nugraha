import { getSupabase } from './supabase';

export type CustomerRow = {
  id: string;
  customer_code: string | null;
  customer_name: string | null;
  customer_type: string | null;
  is_active: boolean | null;
};

export type BranchRow = {
  id: string;
  branch_code: string | null;
  branch_name: string | null;
  is_active: boolean | null;
};

export type ModelRow = {
  id: string;
  model_code: string | null;
  model_name: string | null;
  product_family: string | null;
  is_active: boolean | null;
};

export async function fetchCustomers(limit = 200): Promise<CustomerRow[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('customers')
    .select('id,customer_code,customer_name,customer_type,is_active')
    .order('customer_name', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data || []) as CustomerRow[];
}

export async function searchCustomers(q: string, limit = 50): Promise<CustomerRow[]> {
  const term = q.trim();
  const sb = getSupabase();
  if (!term) return fetchCustomers(limit);
  const { data, error } = await sb
    .from('customers')
    .select('id,customer_code,customer_name,customer_type,is_active')
    .or(`customer_name.ilike.%${term}%,customer_code.ilike.%${term}%`)
    .limit(limit);
  if (error) throw error;
  return (data || []) as CustomerRow[];
}

export async function fetchBranches(limit = 100): Promise<BranchRow[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('branches')
    .select('id,branch_code,branch_name,is_active')
    .order('branch_name', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data || []) as BranchRow[];
}

export async function fetchModels(limit = 200): Promise<ModelRow[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('models')
    .select('id,model_code,model_name,product_family,is_active')
    .order('model_code', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data || []) as ModelRow[];
}

export async function countTable(table: 'customers' | 'branches' | 'models'): Promise<number> {
  const sb = getSupabase();
  const { count, error } = await sb.from(table).select('id', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}
