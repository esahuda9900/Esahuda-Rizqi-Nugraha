import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { LoginPage } from '@/features/auth/LoginPage';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { OverviewPage } from '@/features/overview/OverviewPage';
import { ClaimsListPage } from '@/features/claims/ClaimsListPage';
import { ClaimDetailPage } from '@/features/claims/ClaimDetailPage';
import { ParsePage } from '@/features/parse/ParsePage';
import { AppShell } from './AppShell';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Must match vite base for GitHub Project Pages
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
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
