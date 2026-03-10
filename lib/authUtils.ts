/* eslint-env browser */
/* global BroadcastChannel, MessageEvent, StorageEvent */
/// <reference lib="dom" />

/**
 * @file authUtils.ts
 * @description Centralized authentication state synchronization and logout utilities
 *
 * This module provides a SINGLE SOURCE OF TRUTH for all authentication-related
 * cleanup operations. It ensures that logout, token refresh failure, or disabled
 * account scenarios all trigger the same global logout flow.
 *
 * Cross-Tab Synchronization:
 * - Uses BroadcastChannel API to propagate logout events across all open tabs
 * - Falls back to localStorage events for browsers without BroadcastChannel support
 * - Any tab logging out will trigger logout in all other tabs
 *
 * Usage:
 * - Import performGlobalLogout anywhere you need to log out the user
 * - Import initCrossTabSync to set up cross-tab listeners
 * - Import performStateReset to reset local storage without signOut
 * - Import getCurrentAuthState to get current auth status
 */

import { supabase } from './supabaseClient';
import { db } from './db';

// ====================================================================
// Types
// ====================================================================

export type LogoutReason =
  | 'user_initiated'      // User clicked logout button
  | 'session_expired'     // Token refresh failed
  | 'account_disabled'    // Account was disabled by admin
  | 'auth_error'          // Generic auth error
  | 'force_logout';       // Forced logout from another source (cross-tab)

export interface LogoutOptions {
  reason?: LogoutReason;
  skipServerSignOut?: boolean;  // For when server session is already invalid
  onError?: (error: Error) => void;
  broadcast?: boolean;          // Whether to broadcast to other tabs (default: true)
}

// ====================================================================
// Cross-Tab Communication Types
// ====================================================================

/**
 * Broadcast channel message types for cross-tab auth synchronization
 */
export interface AuthBroadcastMessage {
  type: 'logout' | 'sync_request';
  reason?: LogoutReason;
  timestamp: number;
  sourceTabId: string;
}

/**
 * Channel name for cross-tab authentication events
 */
const BROADCAST_CHANNEL_NAME = 'securefleet_auth_events';

/**
 * Storage event key for fallback cross-tab communication
 */
const STORAGE_EVENT_KEY = 'securefleet_broadcast_event';

// ====================================================================
// Cross-Tab Communication State
// ====================================================================

/**
 * Unique identifier for this tab (generated once per session)
 */
const generateTabId = () => {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return `tab_${Date.now()}_${array[0].toString(36)}`;
  }
  // eslint-disable-next-line sonarjs/pseudo-random
  return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const tabId = generateTabId();

/**
 * BroadcastChannel instance (null if not supported)
 */
let broadcastChannel: BroadcastChannel | null = null;

/**
 * Whether cross-tab sync has been initialized
 */
let crossTabSyncInitialized = false;

/**
 * Whether this logout originated from another tab (prevents echo)
 */
let isRemoteLogout = false;

// ====================================================================
// Cross-Tab Communication - Private Helpers
// ====================================================================

/**
 * Initialize BroadcastChannel with fallback support
 */
const initBroadcastChannel = () => {
  // Try BroadcastChannel API first (modern browsers)
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      console.log('✅ [authUtils] BroadcastChannel initialized');
    } catch (e) {
      console.warn('⚠️ [authUtils] BroadcastChannel failed to initialize, using localStorage fallback:', e);
    }
  } else {
    console.log('ℹ️ [authUtils] BroadcastChannel not supported, using localStorage fallback');
  }
};

/**
 * Broadcast a message to all other tabs
 * Uses BroadcastChannel API with localStorage fallback
 */
const broadcastToOtherTabs = (message: AuthBroadcastMessage) => {
  // Method 1: BroadcastChannel API (preferred, modern browsers)
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(message);
      console.log(`📢 [authUtils] Broadcasted via BroadcastChannel: ${message.type}`);
    } catch (e) {
      console.warn('⚠️ [authUtils] BroadcastChannel postMessage failed:', e);
    }
  }

  // Method 2: localStorage fallback (works in all browsers, even old ones)
  // Using a random value ensures the storage event fires even with same value
  try {
    const eventData = JSON.stringify(message);
    const randomKey = `${STORAGE_EVENT_KEY}_${Date.now()}`;
    localStorage.setItem(randomKey, eventData);
    // Clean up immediately after setting (event has already fired)
    setTimeout(() => {
      localStorage.removeItem(randomKey);
    }, 100);
    console.log(`📢 [authUtils] Broadcasted via localStorage fallback: ${message.type}`);
  } catch (e) {
    console.warn('⚠️ [authUtils] localStorage fallback failed:', e);
  }
};

/**
 * Handle incoming broadcast message from another tab
 */
const handleBroadcastMessage = (event: MessageEvent | StorageEvent) => {
  // Prevent echo - ignore messages from this tab
  if ('data' in event && event.data?.sourceTabId === tabId) {
    return;
  }

  // Parse message from different event types
  let message: AuthBroadcastMessage | null = null;

  if (event instanceof MessageEvent && event.data) {
    // BroadcastChannel API
    message = event.data as AuthBroadcastMessage;
  } else if (event instanceof StorageEvent && event.newValue) {
    // localStorage fallback
    try {
      // Only process events with our broadcast key prefix
      if (event.key && event.key.startsWith(STORAGE_EVENT_KEY)) {
        message = JSON.parse(event.newValue) as AuthBroadcastMessage;
      }
    } catch (e) {
      console.warn('⚠️ [authUtils] Failed to parse storage event:', e);
    }
  }

  if (!message) return;

  console.log(`📨 [authUtils] Received broadcast: ${message.type} from tab ${message.sourceTabId?.substr(0, 20)}...`);

  // Handle logout message from another tab
  if (message.type === 'logout' && message.reason) {
    console.log(`⚠️ [authUtils] Logout triggered by another tab, reason: ${message.reason}`);

    // Mark this as a remote logout to prevent echo
    isRemoteLogout = true;

    // Trigger local logout with force_logout reason
    performGlobalLogout({
      reason: message.reason || 'force_logout',
      skipServerSignOut: false  // Server session already revoked by originating tab
    }).catch(err => {
      console.error('❌ [authUtils] Remote logout failed:', err);
    });
  }
};

// ====================================================================
// Global Logout State (Idempotency Protection)
// ====================================================================

/**
 * Global flag to prevent multiple concurrent logout operations
 * This is stored on window object to persist across hot module reloads in dev
 */
let isLoggingOut = false;

/**
 * Check if a logout operation is currently in progress
 */
export const isLogoutInProgress = () => isLoggingOut;

/**
 * Get the current logout state (for debugging/testing)
 */
export const getLogoutState = () => ({
  isLoggingOut,
  canLogout: !isLoggingOut
});

// ====================================================================
// Storage Keys Configuration
// ====================================================================

/**
 * All localStorage keys related to authentication
 * Keeping this in one place ensures we clear everything consistently
 */
const AUTH_STORAGE_KEYS = [
  'securefleet_session',
  'securefleet_session_ts',
  'securefleet_device_id',
  'securefleet_supabase_auth',
  'securefleet_sync_event'
] as const;

// ====================================================================
// Private Helper Functions
// ====================================================================

/**
 * Clear all localStorage auth-related items
 */
const clearAuthLocalStorage = () => {
  AUTH_STORAGE_KEYS.forEach(key => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`⚠️ Failed to clear localStorage key: ${key}`, e);
    }
  });
  console.log('✅ [authUtils] localStorage cleared');
};

/**
 * Clear all sessionStorage
 */
const clearAuthSessionStorage = () => {
  try {
    sessionStorage.clear();
    console.log('✅ [authUtils] sessionStorage cleared');
  } catch (e) {
    console.warn('⚠️ Failed to clear sessionStorage:', e);
  }
};

/**
 * Clear all IndexedDB/Dexie tables
 */
const clearAuthIndexedDB = async () => {
  try {
    await db.sessions.clear();
    await db.cars.clear();
    await db.transactions.clear();
    await db.profiles.clear();
    await db.expenseTemplates.clear();
    await db.syncQueue.clear();
    console.log('✅ [authUtils] IndexedDB cleared');
  } catch (e) {
    console.warn('⚠️ Failed to clear IndexedDB:', e);
  }
};

/**
 * Perform Supabase server-side signOut with a timeout safety
 */
const performSupabaseSignOut = async () => {
  console.log('📡 [authUtils] Attempting Supabase signOut...');

  try {
    // Create a timeout promise to prevent hanging forever
    const TIMEOUT_MS = 5000;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Supabase signOut timeout')), TIMEOUT_MS)
    );

    // Race the actual signOut against the timeout
    await Promise.race([
      supabase.auth.signOut(),
      timeoutPromise
    ]);

    console.log('✅ [authUtils] Supabase session cleared');
  } catch (e) {
    console.error('⚠️ [authUtils] Supabase signOut failed or timed out:', e);
    // We continue anyway to ensure local state is cleared
  }
};

/**
 * Hard redirect to login page
 * Using window.location.assign ensures complete page reload and state reset
 */
const redirectToLogin = () => {
  console.log('🔐 [authUtils] Redirecting to login...');

  // Support for HashRouter
  const isLoginPage = window.location.hash.includes('#/login') || window.location.pathname === '/login';
  const isLandingPage = window.location.hash.includes('#/landing') || window.location.pathname === '/landing';

  if (!isLoginPage && !isLandingPage) {
    // Use assign() to navigate to login
    window.location.assign('/#/login');
  }

  // Force reload ALWAYS to clear all React/memory state
  // Even if we are already on login page, a reload ensures a fresh start
  console.log('🔄 [authUtils] Triggering hard page reload...');
  setTimeout(() => {
    window.location.reload();
  }, 100);
};

// ====================================================================
// Public API - Global Logout Function
// ====================================================================

/**
 * GLOBAL LOGOUT FUNCTION - Single Source of Truth
 *
 * This is the ONLY function that should be used to log out a user.
 * It handles all cleanup operations in the correct order and is idempotent.
 *
 * Features:
 * - Idempotent: Safe to call multiple times (subsequent calls are no-ops)
 * - Comprehensive: Clears Supabase session, localStorage, sessionStorage, IndexedDB
 * - Error-resilient: Continues cleanup even if some operations fail
 * - Observable: Logs each step for debugging
 * - Configurable: Can skip server signOut if session is already invalid
 *
 * @param options - Logout configuration options
 *
 * @example
 * ```typescript
 * import { performGlobalLogout } from './lib/authUtils';
 *
 * // User-initiated logout (full cleanup)
 * await performGlobalLogout({ reason: 'user_initiated' });
 *
 * // Session expired (skip server signOut since it's already invalid)
 * await performGlobalLogout({
 *   reason: 'session_expired',
 *   skipServerSignOut: true
 * });
 *
 * // Account disabled
 * await performGlobalLogout({ reason: 'account_disabled' });
 * ```
 */
export const performGlobalLogout = async (options: LogoutOptions = {}) => {
  const { reason = 'user_initiated', skipServerSignOut = false, onError, broadcast = true } = options;

  // ====================================================================
  // SECURITY: Idempotency Check - Prevent double-execution
  // ====================================================================
  if (isLoggingOut) {
    console.log(`⚠️ [authUtils] Logout already in progress (reason: ${reason}), skipping duplicate call`);
    return;
  }

  isLoggingOut = true;
  console.log(`🔒 [authUtils] Starting global logout process...`);
  console.log(`📋 [authUtils] Logout reason: ${reason}`);

  try {
    // ====================================================================
    // Step 0: Broadcast to other tabs (before clearing local state)
    // ====================================================================
    if (broadcast && !isRemoteLogout) {
      const message: AuthBroadcastMessage = {
        type: 'logout',
        reason,
        timestamp: Date.now(),
        sourceTabId: tabId
      };
      broadcastToOtherTabs(message);
    }

    // Reset remote logout flag after broadcasting
    isRemoteLogout = false;

    // ====================================================================
    // Step 1: Clear Supabase Session (server-side revocation)
    // ====================================================================
    if (!skipServerSignOut) {
      await performSupabaseSignOut();
    } else {
      console.log('⏭️ [authUtils] Skipping server signOut');
    }

    // ====================================================================
    // Step 2 & 3: Clear all client Storage
    // ====================================================================
    clearAuthLocalStorage();
    clearAuthSessionStorage();

    // ====================================================================
    // Step 4: Clear IndexedDB
    // ====================================================================
    await clearAuthIndexedDB();

    // ====================================================================
    // Step 5: Hard redirect to login
    // ====================================================================
    redirectToLogin();

  } catch (error) {
    console.error('❌ [authUtils] Logout process error:', error);

    if (onError && error instanceof Error) {
      onError(error);
    }

    // Fallback: Ensure we at least try to get to login
    redirectToLogin();
  } finally {
    // We DON'T reset isLoggingOut here because redirectToLogin triggers a reload.
    // If for some reason reload fails, we might want a manual reset capability.
    // But generally, the lock stays until the page dies.
  }
};

// ====================================================================
// Public API - State Reset Without Redirect
// ====================================================================

/**
 * Reset local auth state without redirecting or signing out from server
 * Useful for state cleanup while keeping user logged in
 */
export const performStateReset = async () => {
  console.log('🔄 [authUtils] Resetting local auth state...');

  clearAuthLocalStorage();
  clearAuthSessionStorage();
  await clearAuthIndexedDB();

  console.log('✅ [authUtils] Local state reset complete');
};

// ====================================================================
// Public API - Auth State Query
// ====================================================================

/**
 * Get current authentication state
 * @returns Object with isAuthenticated, userId, and session info
 */
export const getCurrentAuthState = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    return {
      isAuthenticated: !!session,
      userId: session?.user?.id || null,
      userEmail: session?.user?.email || null,
      hasLocalSession: AUTH_STORAGE_KEYS.some(key => localStorage.getItem(key)),
      hasIndexedDBSession: (await db.sessions.toArray()).length > 0,
    };
  } catch (error) {
    console.error('❌ [authUtils] Failed to get auth state:', error);
    return {
      isAuthenticated: false,
      userId: null,
      userEmail: null,
      hasLocalSession: false,
      hasIndexedDBSession: false,
    };
  }
};

// ====================================================================
// Public API - Idempotency Reset (for testing)
// ====================================================================

/**
 * Reset the logout flag (for testing purposes only)
 * WARNING: Do not use in production code
 */
export const resetLogoutFlag = () => {
  isLoggingOut = false;
  console.log('⚠️ [authUtils] Logout flag reset (testing only)');
};

// ====================================================================
// Public API - Cross-Tab Synchronization
// ====================================================================

/**
 * Initialize cross-tab authentication synchronization
 *
 * This function sets up listeners for logout events from other tabs:
 * - BroadcastChannel API (preferred, modern browsers)
 * - localStorage fallback (works in all browsers)
 *
 * Call this once during app initialization (e.g., in index.tsx or main entry point)
 *
 * IMPORTANT: This function is idempotent - calling it multiple times
 * will NOT create duplicate listeners.
 *
 * @example
 * ```typescript
 * import { initCrossTabSync } from './lib/authUtils';
 *
 * // Call once during app initialization
 * initCrossTabSync();
 * ```
 */
export const initCrossTabSync = () => {
  // Idempotency check
  if (crossTabSyncInitialized) {
    console.log('⚠️ [authUtils] Cross-tab sync already initialized, skipping duplicate init');
    return;
  }

  console.log('🚀 [authUtils] Initializing cross-tab authentication sync...');
  crossTabSyncInitialized = true;

  // Initialize BroadcastChannel
  initBroadcastChannel();

  // Listen for BroadcastChannel messages
  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', handleBroadcastMessage);
    console.log('✅ [authUtils] BroadcastChannel listener registered');
  }

  // Listen for storage events (fallback for browsers without BroadcastChannel)
  window.addEventListener('storage', handleBroadcastMessage);
  console.log('✅ [authUtils] Storage event listener registered (fallback)');

  console.log(`✅ [authUtils] Cross-tab sync initialized for tab: ${tabId.substr(0, 20)}...`);
};

/**
 * Stop cross-tab synchronization and clean up resources
 *
 * This function removes all event listeners and closes the BroadcastChannel
 *
 * @example
 * ```typescript
 * import { destroyCrossTabSync } from './lib/authUtils';
 *
 * // Call when app is unmounting (if needed)
 * destroyCrossTabSync();
 * ```
 */
export const destroyCrossTabSync = () => {
  console.log('🛑 [authUtils] Destroying cross-tab sync...');

  // Remove BroadcastChannel listener
  if (broadcastChannel) {
    broadcastChannel.removeEventListener('message', handleBroadcastMessage);
    broadcastChannel.close();
    broadcastChannel = null;
  }

  // Remove storage event listener
  window.removeEventListener('storage', handleBroadcastMessage);

  // Reset initialization state
  crossTabSyncInitialized = false;

  console.log('✅ [authUtils] Cross-tab sync destroyed');
};

/**
 * Get the current cross-tab sync status
 * Useful for debugging and monitoring
 *
 * @returns Object with cross-tab sync status information
 *
 * @example
 * ```typescript
 * import { getCrossTabSyncStatus } from './lib/authUtils';
 *
 * const status = getCrossTabSyncStatus();
 * console.log('Sync active:', status.isInitialized);
 * console.log('Tab ID:', status.tabId);
 * ```
 */
export const getCrossTabSyncStatus = () => {
  return {
    isInitialized: crossTabSyncInitialized,
    tabId,
    hasBroadcastChannel: broadcastChannel !== null,
    broadcastChannelName: BROADCAST_CHANNEL_NAME,
    storageEventKey: STORAGE_EVENT_KEY,
  };
};

// ====================================================================
// Export configuration constants
// ====================================================================

export const AUTH_UTILS_CONFIG = {
  STORAGE_KEYS: AUTH_STORAGE_KEYS,
  BROADCAST_CHANNEL_NAME,
  VERSION: '1.1.0',  // Updated for cross-tab sync feature
};
