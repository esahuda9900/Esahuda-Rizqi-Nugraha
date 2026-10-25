import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { LoginPage } from '@/features/auth/LoginPage';
import { RequireAuth } from '@/features/auth/RequireAuth';
const OverviewPage = lazy(() => import('@/features/overview/OverviewPage').then(m => ({ default: m.OverviewPage })));
const ClaimsListPage = lazy(() => import('@/features/claims/ClaimsListPage').then(m => ({ default: m.ClaimsListPage })));
const ClaimDetailPage = lazy(() => import('@/features/claims/ClaimDetailPage').then(m => ({ default: m.ClaimDetailPage })));
const ParsePage = lazy(() => import('@/features/parse/ParsePage').then(m => ({ default: m.ParsePage })));
const MastersPage = lazy(() => import('@/features/masters/MastersPage').then(m => ({ default: m.MastersPage })));
const Unit360Page = lazy(() => import('@/features/unit/Unit360Page').then(m => ({ default: m.Unit360Page })));
const DataQualityPage = lazy(() => import('@/features/quality/DataQualityPage').then(m => ({ default: m.DataQualityPage })));
const SdlgHelperPage = lazy(() => import('@/features/sdlg-helper/SdlgHelperPage').then(m => ({ default: m.SdlgHelperPage })));
const ExportBackupPage = lazy(() => import('@/features/export/ExportBackupPage').then(m => ({ default: m.ExportBackupPage })));
const AdminCenterPage = lazy(() => import('@/features/admin/AdminCenterPage').then(m => ({ default: m.AdminCenterPage })));
const BulkStatusPage = lazy(() => import('@/features/admin/BulkStatusPage').then(m => ({ default: m.BulkStatusPage })));
import { AppShell } from './AppShell';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter basename={basename}>
          <Suspense fallback={<div className="center-state" role="status">Memuat halaman…</div>}><Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<AppShell />}>
                <Route index element={<OverviewPage />} />
                <Route path="claims" element={<ClaimsListPage />} />
                <Route path="claims/:claimId" element={<ClaimDetailPage />} />
                <Route path="claims/:claimId/sdlg" element={<SdlgHelperPage />} />
                <Route path="parse" element={<ParsePage />} />
                <Route path="masters" element={<MastersPage />} />
                <Route path="unit" element={<Unit360Page />} />
                <Route path="quality" element={<DataQualityPage />} />
                <Route path="export" element={<ExportBackupPage />} />
                <Route path="admin" element={<AdminCenterPage />} />
                <Route path="admin/bulk-status" element={<BulkStatusPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes></Suspense>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
