import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { LoginPage } from '@/features/auth/LoginPage';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { OverviewPage } from '@/features/overview/OverviewPage';
import { ClaimsListPage } from '@/features/claims/ClaimsListPage';
import { ClaimDetailPage } from '@/features/claims/ClaimDetailPage';
import { ParsePage } from '@/features/parse/ParsePage';
import { MastersPage } from '@/features/masters/MastersPage';
import { Unit360Page } from '@/features/unit/Unit360Page';
import { DataQualityPage } from '@/features/quality/DataQualityPage';
import { ExportBackupPage } from '@/features/export/ExportBackupPage';
import { AppShell } from './AppShell';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter basename={basename}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<AppShell />}>
                <Route index element={<OverviewPage />} />
                <Route path="claims" element={<ClaimsListPage />} />
                <Route path="claims/:claimId" element={<ClaimDetailPage />} />
                <Route path="parse" element={<ParsePage />} />
                <Route path="masters" element={<MastersPage />} />
                <Route path="unit" element={<Unit360Page />} />
                <Route path="quality" element={<DataQualityPage />} />
                <Route path="export" element={<ExportBackupPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
