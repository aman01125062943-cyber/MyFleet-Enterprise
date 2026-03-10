import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { supabase } from './lib/supabaseClient';
import { initSessionWatcher } from './lib/sessionWatcher';
import { initCrossTabSync } from './lib/authUtils';

// ====================================================================
// GLOBAL AUTH STATE LISTENER
// Must be registered BEFORE React app mounts for early auth handling
// ====================================================================

supabase.auth.onAuthStateChange((event, session) => {
    // Log auth events for debugging (remove in production if desired)
    console.log('🔐 [Global Auth Listener] Event:', event, session ? 'Session exists' : 'No session');

    switch (event) {
        case 'INITIAL_SESSION':
            // First session check on app load
            // Session is restored from storage if available
            console.log('🔐 Initial session restored');
            break;

        case 'SIGNED_IN':
            // User just signed in successfully
            console.log('✅ User signed in:', session?.user?.email);
            // Clear any stale cached session data
            localStorage.removeItem('securefleet_session');
            localStorage.removeItem('securefleet_session_ts');
            break;

        case 'SIGNED_OUT': {
            // User signed out - clear all local data and redirect
            console.log('👋 User signed out, clearing local data');

            // Clear all auth-related localStorage items
            const itemsToClear = [
                'securefleet_session',
                'securefleet_session_ts',
                'securefleet_device_id',
                'securefleet_sync_event'
            ];
            itemsToClear.forEach(key => {
                try {
                    localStorage.removeItem(key);
                } catch (e) {
                    console.warn('Failed to clear', key, e);
                }
            });

            // Clear sessionStorage
            try {
                sessionStorage.clear();
            } catch (e) {
                console.warn('Failed to clear sessionStorage', e);
            }

            // Force redirect to login if not already there
            const isLoginPage = window.location.hash.includes('/login') || window.location.pathname.includes('/login');
            const isLandingPage = window.location.hash.includes('/landing') || window.location.pathname.includes('/landing');

            if (!isLoginPage && !isLandingPage) {
                // Check if using HashRouter (based on current URL or config)
                // Since App.tsx uses HashRouter, we should force hash navigation
                window.location.replace('/#/login');
                // Force reload to clear all in-memory application state
                window.location.reload();
            }
            break;
        }

        case 'TOKEN_REFRESHED':
            // Access token was automatically refreshed
            console.log('🔄 Token refreshed successfully at:', new Date().toISOString());
            // Token refresh happens automatically - no action needed
            break;

        case 'USER_UPDATED':
            // User profile or metadata was updated
            console.log('👤 User profile updated');
            // You may want to refresh user data here
            break;

        default:
            // Handle any unknown auth events
            console.log('⚠️ Unknown auth event:', event);
    }
});

// ====================================================================
// GLOBAL SESSION HEALTH WATCHER
// Monitors session validity and triggers logout on expiration/disabled accounts
// Must be initialized AFTER auth listener for proper coordination
// ====================================================================

initSessionWatcher();

// ====================================================================
// CROSS-TAB AUTHENTICATION SYNCHRONIZATION
// Propagates logout events across all open tabs using BroadcastChannel API
// Must be initialized AFTER session watcher for proper coordination
// ====================================================================

initCrossTabSync();

// ====================================================================
// REACT APP MOUNTING
// ====================================================================

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("Could not find root element to mount to");
}

console.log('🚀 Starting application mounting...');
const root = ReactDOM.createRoot(rootElement);
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
console.log('✅ Application mounted successfully');
