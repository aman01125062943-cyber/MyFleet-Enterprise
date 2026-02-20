import React, { useEffect, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import { Loader2 } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/ToastProvider';
import { db } from './lib/db';
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute';
import { performGlobalLogout } from './lib/authUtils';
import { WhatsAppButton } from './components/WhatsAppButton';

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
const Financials = React.lazy(() => import('./components/Financials'));
const LandingPage = React.lazy(() => import('./components/LandingPage'));
const PricingPage = React.lazy(() => import('./components/PricingPage'));
const SubscriptionRoute = React.lazy(() => import('./components/SubscriptionRoute'));
const MaintenancePage = React.lazy(() => import('./components/MaintenancePage'));
const UpdateRequiredPage = React.lazy(() => import('./components/UpdateRequiredPage'));

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
// Version Comparison Helper
// ====================================================================
/**
 * Compare two version strings (e.g., "1.2.3" vs "1.2.4")
 * Returns: -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2
 */
const compareVersions = (v1: string, v2: string): number => {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;

    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }

  return 0;
};

// Current app version (should match package.json)
const CURRENT_APP_VERSION = '1.0.0';

// ====================================================================
// Helper Functions for Cache Management & Auth Logic
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

/**
 * Fetch system configuration from Supabase
 */
const fetchSystemConfig = async () => {
  let systemConfig = {
    maintenance_mode: false,
    default_entry_page: 'login' as 'landing' | 'pricing' | 'login',
    min_app_version: '1.0.0' as string
  };

  try {
    const { data: configData } = await supabase
      .from('public_config')
      .select('maintenance_mode, default_entry_page, min_app_version')
      .maybeSingle();

    if (configData) {
      systemConfig = {
        maintenance_mode: configData.maintenance_mode || false,
        default_entry_page: configData.default_entry_page || 'login',
        min_app_version: configData.min_app_version || '1.0.0'
      };
    }
    console.log('🔧 System config loaded:', systemConfig);
  } catch (e) {
    console.warn('Failed to fetch system config, using defaults:', e);
  }
  return systemConfig;
};

/**
 * Validates user status and maintenance mode, then navigates
 * Returns true if navigation was handled (user is valid or redirected due to maintenance/disabled)
 */
const validateAndNavigateUser = (user: any, config: any, navigate: any) => {
  // SECURITY: Check if account is disabled
  if (!user || user.status === 'disabled') {
    console.warn('⛔ Account is disabled, signing out');
    clearCache();
    performGlobalLogout({ reason: 'account_disabled' });
    return true; // Handled (logged out)
  }

  // MAINTENANCE MODE: Block non-admin users
  if (config.maintenance_mode &&
      user.role !== 'admin' &&
      user.role !== 'super_admin' &&
      user.role !== 'owner') {
    console.warn('🔧 Maintenance mode active, blocking non-admin user');
    navigate('/maintenance', { replace: true });
    return true; // Handled (redirected)
  }

  // Session verified - update cache and proceed
  updateCache(user);
  navigate(user.role === 'admin' && !user.org_id ? '/admin' : '/dashboard', { replace: true });
  return true; // Handled (redirected)
};

/**
 * Check for a valid cached session
 */
const checkCachedSession = async () => {
  const cachedSession = localStorage.getItem(CACHE_KEY);
  const cacheTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);

  if (cachedSession && cacheTimestamp) {
    try {
      const user = JSON.parse(cachedSession);
      const cacheAge = Date.now() - Number.parseInt(cacheTimestamp, 10);

      if (user?.id && cacheAge < MAX_CACHE_AGE) {
        // Cache is fresh enough for quick load, BUT verify with server
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          // SECURITY: Verify server session matches cached data
          const { data: profile } = await supabase.from('profiles')
            .select('role, org_id, status')
            .eq('id', session.user.id)
            .maybeSingle();
          
          return profile;
        }
      }

      // Cache is stale or invalid - clear it
      console.log('🔄 Cache is stale or invalid, clearing...');
      clearCache();
    } catch (e) {
      // Invalid JSON - clear cache
      console.warn('⚠️ Invalid cache format, clearing...', e);
      clearCache();
    }
  }
  return null;
};

/**
 * Check for a valid online session
 */
const checkOnlineSession = async () => {
  if (navigator.onLine) {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        // Fetch full profile with status check
        const { data: user } = await supabase.from('profiles')
          .select('role, org_id, status, full_name, email, username, permissions')
          .eq('id', session.user.id)
          .maybeSingle();
        
        return user;
      }
    } catch (e) {
      console.error("Auth Check Failed", e);
    }
  }
  return null;
};

/**
 * Check for offline session
 */
const checkOfflineSession = async (config: any, navigate: any) => {
  try {
    const sessions = await db.sessions.toArray();

    if (sessions.length > 0) {
      const s = sessions[0];

      // Check if offline session hasn't expired
      if (Date.now() < s.expires_at) {
        console.log('📱 Using offline session');

        // MAINTENANCE MODE: Check offline session too
        if (config.maintenance_mode &&
            s.role !== 'admin' &&
            s.role !== 'super_admin' &&
            s.role !== 'owner') {
          console.warn('🔧 Maintenance mode active, blocking offline non-admin user');
          navigate('/maintenance', { replace: true });
          return true;
        }

        navigate(s.role === 'admin' && !s.profile.org_id ? '/admin' : '/dashboard', { replace: true });
        return true;
      } else {
        console.log('⏰ Offline session expired');
        // Clear expired offline sessions
        await db.sessions.clear();
      }
    }
  } catch (e) {
    console.error("Offline check failed", e);
  }
  return false;
};

// ====================================================================
// The "Traffic Controller" Component - Enhanced with Cache Validation
// ====================================================================

const RootRedirect: React.FC = () => {
  const navigate = useNavigate();
  const hasNavigated = React.useRef(false);

  useEffect(() => {
    if (hasNavigated.current) return;

    const decideRoute = async () => {
      // 0. Fetch System Config
      const config = await fetchSystemConfig();

      // 0.1. Check Minimum App Version
      if (config.min_app_version && compareVersions(CURRENT_APP_VERSION, config.min_app_version) < 0) {
        console.warn(`⚠️ App version ${CURRENT_APP_VERSION} is below minimum required ${config.min_app_version}`);
        hasNavigated.current = true;
        navigate('/update-required', { replace: true });
        return;
      }

      // 1. Check localStorage first (FAST PATH)
      const cachedUser = await checkCachedSession();
      if (cachedUser) {
        if (validateAndNavigateUser(cachedUser, config, navigate)) {
          hasNavigated.current = true;
          return;
        }
      }

      // 2. Online Check with Server Validation (PRIMARY PATH)
      const onlineUser = await checkOnlineSession();
      if (onlineUser) {
        if (validateAndNavigateUser(onlineUser, config, navigate)) {
          hasNavigated.current = true;
          return;
        }
      }

      // 3. Offline Fallback Check (INDEXEDDB)
      if (await checkOfflineSession(config, navigate)) {
        hasNavigated.current = true;
        return;
      }

      // 4. No Session - Use Default Entry Page Setting
      console.log(`📍 No valid session found, redirecting to: ${config.default_entry_page}`);
      hasNavigated.current = true;

      // Route based on default_entry_page setting
      if (config.default_entry_page === 'landing') {
        navigate('/landing', { replace: true });
      } else if (config.default_entry_page === 'pricing') {
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
            <WhatsAppButton />
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
                <Route path="/update-required" element={<UpdateRequiredPage currentVersion={CURRENT_APP_VERSION} minVersion={undefined} updateUrl={undefined} />} />

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
                  <Route path="/financials" element={<Financials />} />
                  <Route path="/team" element={<Team />} />
                  <Route path="/assets" element={<Assets />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/subscription" element={<SubscriptionRoute />} />
                  <Route path="/calculator" element={<TripCalculator />} />
                  <Route path="/maintenance" element={<MaintenancePage />} />
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
