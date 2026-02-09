import React, { useEffect, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import { Loader2 } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/ToastProvider';
import { db } from './lib/db';
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute';
import { performGlobalLogout } from './lib/authUtils';

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
const MaintenancePage = React.lazy(() => import('./components/MaintenancePage'));

// Loading Fallback Component
const PageLoader = () => (
  <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
    <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
  </div>
);

// ====================================================================
// SECURITY: Cache Configuration
// ====================================================================
const MAX_CACHE_AGE = 5 * 60 * 1000; // 5 minutes maximum cache age
const CACHE_TIMESTAMP_KEY = 'securefleet_session_ts';
const CACHE_KEY = 'securefleet_session';

// ====================================================================
// The "Traffic Controller" Component - Enhanced with Cache Validation
// ====================================================================

const RootRedirect: React.FC = () => {
  const navigate = useNavigate();
  const hasNavigated = React.useRef(false);

  useEffect(() => {
    if (hasNavigated.current) return;

    const decideRoute = async () => {
      // ====================================================================
      // 0. Fetch System Config FIRST (needed for all decisions)
      // ====================================================================
      let systemConfig = {
        maintenance_mode: false,
        default_entry_page: 'login' as 'landing' | 'pricing' | 'login'
      };

      try {
        const { data: configData } = await supabase
          .from('public_config')
          .select('maintenance_mode, default_entry_page')
          .maybeSingle();

        if (configData) {
          systemConfig = {
            maintenance_mode: configData.maintenance_mode || false,
            default_entry_page: configData.default_entry_page || 'login'
          };
        }
        console.log('🔧 System config loaded:', systemConfig);
      } catch (e) {
        console.warn('Failed to fetch system config, using defaults:', e);
      }

      // ====================================================================
      // 1. Check localStorage first (FAST PATH) - with validation
      // ====================================================================
      const cachedSession = localStorage.getItem(CACHE_KEY);
      const cacheTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);

      if (cachedSession) {
        try {
          const user = JSON.parse(cachedSession);

          // SECURITY: Validate cache isn't stale
          if (cacheTimestamp) {
            const cacheAge = Date.now() - parseInt(cacheTimestamp, 10);

            if (user?.id && cacheAge < MAX_CACHE_AGE) {
              // Cache is fresh enough for quick load, BUT verify with server
              const { data: { session } } = await supabase.auth.getSession();

              if (session && session.user) {
                // SECURITY: Verify server session matches cached data
                const { data: profile } = await supabase.from('profiles')
                  .select('role, org_id, status')
                  .eq('id', session.user.id)
                  .maybeSingle();

                // SECURITY: Check if account is disabled
                if (!profile || profile.status === 'disabled') {
                  console.warn('⛔ Account is disabled, signing out');
                  clearCache();
                  performGlobalLogout({ reason: 'account_disabled' });
                  return;
                }

                // MAINTENANCE MODE: Block non-admin users
                if (systemConfig.maintenance_mode &&
                    profile.role !== 'admin' &&
                    profile.role !== 'super_admin' &&
                    profile.role !== 'owner') {
                  console.warn('🔧 Maintenance mode active, blocking non-admin user');
                  hasNavigated.current = true;
                  navigate('/maintenance', { replace: true });
                  return;
                }

                if (profile) {
                  // Session verified - update cache and proceed
                  updateCache(profile);
                  hasNavigated.current = true;
                  navigate(profile.role === 'admin' && !profile.org_id ? '/admin' : '/dashboard', { replace: true });
                  return;
                }
              }
            }

            // Cache is stale or invalid - clear it
            console.log('🔄 Cache is stale or invalid, clearing...');
            clearCache();
          }
        } catch (e) {
          // Invalid JSON - clear cache
          console.warn('⚠️ Invalid cache format, clearing...', e);
          clearCache();
        }
      }

      // ====================================================================
      // 2. Online Check with Server Validation (PRIMARY PATH)
      // ====================================================================
      if (navigator.onLine) {
        try {
          const { data: { session } } = await supabase.auth.getSession();

          if (session && session.user) {
            // Fetch full profile with status check
            const { data: user } = await supabase.from('profiles')
              .select('role, org_id, status, full_name, email, username, permissions')
              .eq('id', session.user.id)
              .maybeSingle();

            // SECURITY: Check if account is disabled
            if (!user || user.status === 'disabled') {
              console.warn('⛔ Account is disabled, signing out');
              clearCache();
              performGlobalLogout({ reason: 'account_disabled' });
              return;
            }

            // MAINTENANCE MODE: Block non-admin users
            if (systemConfig.maintenance_mode &&
                user.role !== 'admin' &&
                user.role !== 'super_admin' &&
                user.role !== 'owner') {
              console.warn('🔧 Maintenance mode active, blocking non-admin user');
              hasNavigated.current = true;
              navigate('/maintenance', { replace: true });
              return;
            }

            // SECURITY: Update cache with fresh data and timestamp
            updateCache(user);

            hasNavigated.current = true;
            navigate(user.role === 'admin' && !user.org_id ? '/admin' : '/dashboard', { replace: true });
            return;
          }

          // No valid session - proceed to offline check or default page
        } catch (e) {
          console.error("Auth Check Failed", e);
        }
      }

      // ====================================================================
      // 3. Offline Fallback Check (INDEXEDDB)
      // ====================================================================
      try {
        const sessions = await db.sessions.toArray();

        if (sessions.length > 0) {
          const s = sessions[0];

          // Check if offline session hasn't expired
          if (Date.now() < s.expires_at) {
            console.log('📱 Using offline session');

            // MAINTENANCE MODE: Check offline session too
            if (systemConfig.maintenance_mode &&
                s.role !== 'admin' &&
                s.role !== 'super_admin' &&
                s.role !== 'owner') {
              console.warn('🔧 Maintenance mode active, blocking offline non-admin user');
              hasNavigated.current = true;
              navigate('/maintenance', { replace: true });
              return;
            }

            hasNavigated.current = true;
            navigate(s.role === 'admin' && !s.profile.org_id ? '/admin' : '/dashboard', { replace: true });
            return;
          } else {
            console.log('⏰ Offline session expired');
            // Clear expired offline sessions
            await db.sessions.clear();
          }
        }
      } catch (e) {
        console.error("Offline check failed", e);
      }

      // ====================================================================
      // 4. No Session - Use Default Entry Page Setting
      // ====================================================================
      console.log(`📍 No valid session found, redirecting to: ${systemConfig.default_entry_page}`);
      hasNavigated.current = true;

      // Route based on default_entry_page setting
      if (systemConfig.default_entry_page === 'landing') {
        navigate('/landing', { replace: true });
      } else if (systemConfig.default_entry_page === 'pricing') {
        navigate('/pricing', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    };

    decideRoute();
  }, []); // Empty dependency array - run once

  return <PageLoader />;
};

// ====================================================================
// Helper Functions for Cache Management
// ====================================================================

/**
 * Clear all auth-related cache from localStorage
 */
const clearCache = () => {
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(CACHE_TIMESTAMP_KEY);
};

/**
 * Update cache with fresh data and current timestamp
 */
const updateCache = (user: any) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(user));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
  } catch (e) {
    console.warn('Failed to update cache:', e);
  }
};

// ====================================================================
// Main App Component
// ====================================================================

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
                <Route path="/maintenance" element={<MaintenancePage />} />

                {/* Super Admin Route - Protected with AdminRoute */}
                <Route
                  path="/admin"
                  element={
                    <AdminRoute requiredRole="admin">
                      <SuperAdminDashboard />
                    </AdminRoute>
                  }
                />

                {/* Protected App Routes - Wrapped with ProtectedRoute */}
                <Route
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
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
