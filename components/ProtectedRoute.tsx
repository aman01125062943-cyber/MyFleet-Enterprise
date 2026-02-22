/**
 * @file ProtectedRoute.tsx
 * @description Strict route guard that enforces authentication and profile validation
 *
 * This component:
 * - Prevents rendering of protected routes until full session validation
 * - Checks Supabase session from server (not just cache)
 * - Validates user profile and checks for disabled status
 * - Eliminates UI flicker by showing loading state during validation
 * - Forces logout if session is invalid or account is disabled
 * - Uses centralized auth utilities for logout (authUtils.ts)
 */

import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Loader2 } from 'lucide-react';
import { performGlobalLogout } from '../lib/authUtils';

// ====================================================================
// Types
// ====================================================================

interface ProtectedRouteProps {
  children: React.ReactNode;
}

interface ValidationResult {
  isAuthenticated: boolean;
  isDisabled: boolean;
  isLoading: boolean;
}

// ====================================================================
// Loading Component
// ====================================================================

const AuthLoader: React.FC = () => (
  <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
    <div className="text-center">
      <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
      <p className="text-gray-400 text-sm">Verifying session...</p>
    </div>
  </div>
);

// ====================================================================
// Protected Route Component
// ====================================================================

/**
 * Strict authentication guard for protected routes
 *
 * Security features:
 * - Waits for complete server-side validation before rendering children
 * - Checks both Supabase session AND user profile status
 * - Redirects disabled users to login with logout
 * - Prevents cache-only access (always validates with server)
 * - Shows loading state to prevent UI flicker
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const [validation, setValidation] = useState<ValidationResult>({
    isAuthenticated: false,
    isDisabled: false,
    isLoading: true,
  });

  useEffect(() => {
    let isMounted = true;

    /**
     * Perform strict authentication validation
     * - Checks Supabase session from server
     * - Validates user profile exists and is not disabled
     * - Only allows access when both conditions are met
     */
    const validateAuthentication = async () => {
      console.log('🔐 ProtectedRoute: Starting authentication validation...');

      try {
        // ====================================================================
        // Step 1: Check Supabase Session (server-side, not cache)
        // ====================================================================
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session || !session.user) {
          console.warn('⛔ ProtectedRoute: No valid Supabase session');
          if (isMounted) {
            setValidation({
              isAuthenticated: false,
              isDisabled: false,
              isLoading: false,
            });
          }
          return;
        }

        console.log('✅ ProtectedRoute: Supabase session valid');

        // ====================================================================
        // Step 2: Validate User Profile (server-side, with status check)
        // ====================================================================
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, role, org_id, status, full_name, email, username, permissions')
          .eq('id', session.user.id)
          .maybeSingle();

        // ====================================================================
        // Step 3: Check for Disabled Account
        // ====================================================================
        if (!profile || profileError || profile.status === 'disabled') {
          console.warn('⛔ ProtectedRoute: Account is disabled or profile not found');
          // Use centralized logout for disabled account
          performGlobalLogout({ reason: 'account_disabled' });

          if (isMounted) {
            setValidation({
              isAuthenticated: false,
              isDisabled: true,
              isLoading: false,
            });
          }
          return;
        }

        console.log('✅ ProtectedRoute: User profile validated, not disabled');

        // ====================================================================
        // Step 4: Authentication Successful - Allow Access
        // ====================================================================
        if (isMounted) {
          setValidation({
            isAuthenticated: true,
            isDisabled: false,
            isLoading: false,
          });
        }

      } catch (error) {
        console.error('❌ ProtectedRoute: Validation error:', error);
        // On error, deny access for safety
        if (isMounted) {
          setValidation({
            isAuthenticated: false,
            isDisabled: false,
            isLoading: false,
          });
        }
      }
    };

    validateAuthentication();

    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, []); // Run validation once on mount

  // ====================================================================
  // Render Logic
  // ====================================================================

  // Show loading state while validating
  if (validation.isLoading) {
    return <AuthLoader />;
  }

  // Redirect to login if not authenticated
  if (!validation.isAuthenticated) {
    console.log('🔒 ProtectedRoute: Redirecting to login');
    return <Navigate to="/login" replace />;
  }

  // Render protected content
  console.log('✅ ProtectedRoute: Access granted, rendering children');
  return <>{children}</>;
};

// ====================================================================
// Export for Admin Routes (includes role check)
// ====================================================================

interface AdminRouteProps extends ProtectedRouteProps {
  requiredRole?: 'admin' | 'owner';
}

/**
 * Protected route for admin-only pages
 * Extends ProtectedRoute with role-based access control
 */
export const AdminRoute: React.FC<AdminRouteProps> = ({ children, requiredRole = 'admin' }) => {
  const [validation, setValidation] = useState<{
    isAuthenticated: boolean;
    hasAccess: boolean;
    isLoading: boolean;
  }>({
    isAuthenticated: false,
    hasAccess: false,
    isLoading: true,
  });

  useEffect(() => {
    let isMounted = true;

    const validateAdminAccess = async () => {
      console.log('🔐 AdminRoute: Starting validation...');

      try {
        // Check Supabase session
        const { data: { session } } = await supabase.auth.getSession();

        if (!session || !session.user) {
          if (isMounted) {
            setValidation({ isAuthenticated: false, hasAccess: false, isLoading: false });
          }
          return;
        }

        // Check profile and role
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, role, org_id, status')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!profile || profile.status === 'disabled') {
          // Use centralized logout for disabled account
          performGlobalLogout({ reason: 'account_disabled' });
          if (isMounted) {
            setValidation({ isAuthenticated: false, hasAccess: false, isLoading: false });
          }
          return;
        }

        // Check role-based access
        // super_admin and owner have access to all admin routes (aligned with SuperAdminDashboard)
        const hasRequiredRole = profile.role === requiredRole || profile.role === 'super_admin' || profile.role === 'owner';

        if (isMounted) {
          setValidation({
            isAuthenticated: true,
            hasAccess: hasRequiredRole,
            isLoading: false,
          });
        }

      } catch (error) {
        console.error('❌ AdminRoute validation error:', error);
        if (isMounted) {
          setValidation({ isAuthenticated: false, hasAccess: false, isLoading: false });
        }
      }
    };

    validateAdminAccess();

    return () => {
      isMounted = false;
    };
  }, [requiredRole]);

  if (validation.isLoading) {
    return <AuthLoader />;
  }

  if (!validation.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!validation.hasAccess) {
    // Admin without access goes to dashboard
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
