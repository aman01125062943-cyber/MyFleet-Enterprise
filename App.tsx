import React, { useEffect, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import { Loader2 } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/ToastProvider';
import { db } from './lib/db';

// Lazy Load Components for Performance Optimization
const AuthScreen = React.lazy(() => import('./components/AuthScreen'));
const Layout = React.lazy(() => import('./components/Layout'));
const Dashboard = React.lazy(() => import('./components/Dashboard'));
const Inventory = React.lazy(() => import('./components/Inventory'));
const Team = React.lazy(() => import('./components/Team'));
const Settings = React.lazy(() => import('./components/Settings'));
const TripCalculator = React.lazy(() => import('./components/TripCalculator'));
const SuperAdminDashboard = React.lazy(() => import('./components/SuperAdminDashboard'));
const Assets = React.lazy(() => import('./components/Assets'));
const LandingPage = React.lazy(() => import('./components/LandingPage'));
const PricingPage = React.lazy(() => import('./components/PricingPage'));
const SubscriptionRoute = React.lazy(() => import('./components/SubscriptionRoute'));

// Loading Fallback Component
const PageLoader = () => (
  <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
    <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
  </div>
);

// The "Traffic Controller" Component
const RootRedirect: React.FC = () => {
  const navigate = useNavigate();
  const hasNavigated = React.useRef(false);

  useEffect(() => {
    if (hasNavigated.current) return;

    const decideRoute = async () => {
      // 1. Check localStorage first (FAST)
      const cachedSession = localStorage.getItem('securefleet_session');
      if (cachedSession) {
        try {
          const user = JSON.parse(cachedSession);
          if (user?.id) {
            hasNavigated.current = true;
            navigate(user.role === 'admin' && !user.org_id ? '/admin' : '/dashboard', { replace: true });
            return;
          }
        } catch (e) { /* Invalid cache, continue */ }
      }

      // 2. Online Check
      if (navigator.onLine) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const { data: user } = await supabase.from('profiles').select('role, org_id').eq('id', session.user.id).maybeSingle();
            if (user) {
              hasNavigated.current = true;
              navigate(user.role === 'admin' && !user.org_id ? '/admin' : '/dashboard', { replace: true });
              return;
            }
          }
        } catch (e) {
          console.error("Auth Check Failed", e);
        }
      } else {
        // 3. Offline Fallback Check
        try {
          const sessions = await db.sessions.toArray();
          if (sessions.length > 0) {
            const s = sessions[0];
            if (Date.now() < s.expires_at) {
              hasNavigated.current = true;
              navigate(s.role === 'admin' && !s.profile.org_id ? '/admin' : '/dashboard', { replace: true });
              return;
            }
          }
        } catch (e) {
          console.error("Offline check failed", e);
        }
      }

      // Default to login
      hasNavigated.current = true;
      navigate('/login', { replace: true });
    };

    decideRoute();
  }, []); // Empty dependency array - run once

  return <PageLoader />;
};

import { ThemeProvider } from './components/ThemeProvider';

const AnnouncementModal = React.lazy(() => import('./components/AnnouncementModal'));

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          {/* <UpdateNotification /> Removed in favor of dashboard banner */}
          <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Suspense fallback={<PageLoader />}>
              <AnnouncementModal /> {/* Added globally */}
              <Routes>
                {/* The Traffic Controller */}
                <Route path="/" element={<RootRedirect />} />

                {/* Public Routes - Lazy Loaded */}
                <Route path="/landing" element={<LandingPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/login" element={<AuthScreen />} />

                {/* Super Admin Route - Lazy Loaded */}
                <Route path="/admin" element={<SuperAdminDashboard />} />

                {/* Protected App Routes (Nested under Layout for Context Access) */}
                <Route element={<Layout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/team" element={<Team />} />
                  <Route path="/assets" element={<Assets />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/subscription" element={<SubscriptionRoute />} />
                  <Route path="/calculator" element={<TripCalculator />} />
                </Route>

                {/* Catch all */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </HashRouter>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
