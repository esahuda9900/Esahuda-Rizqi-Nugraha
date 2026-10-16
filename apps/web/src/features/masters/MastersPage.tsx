import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { countMachines, searchMachines } from '@/lib/claimsApi';
import {
  countTable,
  fetchBranches,
  fetchModels,
  searchCustomers,
} from '@/lib/mastersApi';

type Tab = 'machines' | 'customers' | 'branches' | 'models';

export function MastersPage() {
  const [tab, setTab] = useState<Tab>('machines');
  const [q, setQ] = useState('');

  const mCount = useQuery({ queryKey: ['machines', 'count'], queryFn: countMachines, staleTime: 60_000 });
  const cCount = useQuery({ queryKey: ['customers', 'count'], queryFn: () => countTable('customers'), staleTime: 60_000 });
  const bCount = useQuery({ queryKey: ['branches', 'count'], queryFn: () => countTable('branches'), staleTime: 60_000 });
  const moCount = useQuery({ queryKey: ['models', 'count'], queryFn: () => countTable('models'), staleTime: 60_000 });

  const machinesQ = useQuery({
    queryKey: ['machines', 'search', q],
    queryFn: () => searchMachines(q, 50),
    enabled: tab === 'machines',
    staleTime: 15_000,
  });
  const customersQ = useQuery({
    queryKey: ['customers', 'search', q],
    queryFn: () => searchCustomers(q, 80),
    enabled: tab === 'customers',
    staleTime: 15_000,
  });
  const branchesQ = useQuery({
    queryKey: ['branches', 'list'],
    queryFn: () => fetchBranches(100),
    enabled: tab === 'branches',
    staleTime: 60_000,
  });
  const modelsQ = useQuery({
    queryKey: ['models', 'list'],
    queryFn: () => fetchModels(300),
    enabled: tab === 'models',
    staleTime: 60_000,
  });

  return (
    <div className="page wide">
      <header className="page-header">
        <p className="eyebrow">Master Data</p>
        <h1>Referensi master</h1>
        <p className="muted">Machines · Customers · Branches · Models (read dari Supabase).</p>
      </header>

      <div className="tab-row">
        <button type="button" className={tab === 'machines' ? '' : 'ghost'} onClick={() => setTab('machines')}>
          Machines ({mCount.data ?? '…'})
        </button>
        <button type="button" className={tab === 'customers' ? '' : 'ghost'} onClick={() => setTab('customers')}>
          Customers ({cCount.data ?? '…'})
        </button>
        <button type="button" className={tab === 'branches' ? '' : 'ghost'} onClick={() => setTab('branches')}>
          Branches ({bCount.data ?? '…'})
        </button>
        <button type="button" className={tab === 'models' ? '' : 'ghost'} onClick={() => setTab('models')}>
          Models ({moCount.data ?? '…'})
        </button>
      </div>

      {(tab === 'machines' || tab === 'customers') && (
        <div className="toolbar">
          <input
            type="search"
            placeholder={tab === 'machines' ? 'Cari serial / model / customer…' : 'Cari customer…'}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      )}

      {tab === 'machines' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Serial</th>
                <th>Model</th>
                <th>Customer</th>
                <th>Dealer/Branch</th>
                <th>Sales</th>
              </tr>
            </thead>
            <tbody>
              {(machinesQ.data || []).map((m, i) => (
                <tr key={`${m.serial_no}-${i}`}>
                  <td className="mono">{m.serial_no || '—'}</td>
                  <td>{m.model || '—'}</td>
                  <td>{m.customer || '—'}</td>
                  <td>{m.branch || '—'}</td>
                  <td className="mono">{m.sales_date || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'customers' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Type</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {(customersQ.data || []).map((c) => (
                <tr key={c.id}>
                  <td className="mono">{c.customer_code || '—'}</td>
                  <td>{c.customer_name || '—'}</td>
                  <td>{c.customer_type || '—'}</td>
                  <td>{c.is_active === false ? 'No' : 'Yes'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'branches' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {(branchesQ.data || []).map((b) => (
                <tr key={b.id}>
                  <td className="mono">{b.branch_code || '—'}</td>
                  <td>{b.branch_name || '—'}</td>
                  <td>{b.is_active === false ? 'No' : 'Yes'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'models' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Family</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {(modelsQ.data || []).map((m) => (
                <tr key={m.id}>
                  <td className="mono">{m.model_code || '—'}</td>
                  <td>{m.model_name || '—'}</td>
                  <td>{m.product_family || '—'}</td>
                  <td>{m.is_active === false ? 'No' : 'Yes'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
