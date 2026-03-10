import { createClient } from '@supabase/supabase-js';

// ------------------------------------------------------------------
// إعدادات الاتصال بـ Supabase
// ------------------------------------------------------------------

// قراءة من المتغيرات البيئية (Runtime أولاً، ثم Build time)
const SUPABASE_URL = (window as any)._env_?.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = (window as any)._env_?.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase environment variables');
}

// Create Supabase client with security-enhanced configuration
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        // SECURITY: Use PKCE (Proof Key for Code Exchange) flow
        // More secure than implicit grant flow, prevents authorization code interception
        flowType: 'pkce',

        // SECURITY: Store session in localStorage for cross-tab synchronization
        // This allows auth state changes to propagate across browser tabs
        storage: window.localStorage,
        storageKey: 'securefleet_supabase_auth',

        // SECURITY: Enable automatic token refresh before expiration
        // Prevents sudden logout due to expired access tokens
        autoRefreshToken: true,

        // Detect and handle URL fragments for magic links, email confirmations, etc.
        detectSessionInUrl: true,

        // Persist session across page reloads
        persistSession: true,

        // Skip session fetch during SSR (not needed for SPA)
        skipSessionFetch: false
    },
    // Global request options for debugging and tracking
    global: {
        headers: {
            'X-Client-Info': 'myfleet-pro-web'
        }
    },
    // Database schema
    db: {
        schema: 'public'
    }
});

// ------------------------------------------------------------------
// Helper Functions for Session Management
// ------------------------------------------------------------------

/**
 * Get the current authenticated session
 * @returns The current session or null if not authenticated
 */
export const getCurrentSession = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
        console.error('Error getting session:', error);
        return null;
    }
    return data.session;
};

/**
 * Manually refresh the current session
 * Useful before critical operations to ensure fresh token
 * @returns The refreshed session or null if refresh failed
 */
export const refreshSession = async () => {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
        console.error('Error refreshing session:', error);
        return null;
    }
    return data.session;
};

/**
 * Get the current authenticated user
 * @returns The current user or null if not authenticated
 */
export const getCurrentUser = async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
        console.error('Error getting user:', error);
        return null;
    }
    return data.user;
};

// ------------------------------------------------------------------
// Global Auth State Change Listener
// ------------------------------------------------------------------

// Listen for auth state changes and log them for debugging
supabase.auth.onAuthStateChange((event, session) => {
    switch (event) {
        case 'INITIAL_SESSION':
            console.log('🔐 Initial session loaded', session ? 'User logged in' : 'No session');
            break;
        case 'SIGNED_IN':
            console.log('✅ User signed in:', session?.user?.email);
            break;
        case 'SIGNED_OUT':
            console.log('👋 User signed out');
            // Clear local session cache
            localStorage.removeItem('securefleet_session');
            break;
        case 'TOKEN_REFRESHED':
            console.log('🔄 Token refreshed successfully at:', new Date().toISOString());
            break;
        case 'USER_UPDATED':
            console.log('👤 User profile updated');
            break;
        default:
            console.log('🔐 Auth event:', event);
    }
});
