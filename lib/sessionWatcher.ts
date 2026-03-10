/**
 * @file sessionWatcher.ts
 * @description Global Session Health Watcher - Centralized session validity monitoring
 *
 * This module provides a SINGLE, centralized session health watcher that:
 * - Monitors session validity using Supabase (never cache-only)
 * - Reacts to page visibility and focus events
 * - Triggers performGlobalLogout on session expiration or invalidation
 * - Is idempotent, safe, and minimal
 *
 * Usage:
 * Call initSessionWatcher() once during app initialization (e.g., in main.tsx or index.tsx)
 */

import { supabase } from './supabaseClient';
import { performGlobalLogout, isLogoutInProgress } from './authUtils';

// ====================================================================
// Configuration
// ====================================================================

/**
 * How often to validate the session (in milliseconds)
 * - Only validates when tab is visible to save resources
 * - 5 minutes balance between security and performance
 */
const SESSION_VALIDATE_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Debounce delay for visibility/focus events (in milliseconds)
 * - Prevents rapid validations when user switches tabs quickly
 */
const VISIBILITY_DEBOUNCE_MS = 1000;

// ====================================================================
// State
// ====================================================================

/**
 * Flag to ensure only one watcher is running
 */
let isInitialized = false;

/**
 * The interval ID for the periodic validation timer
 */
let validateIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Timeout ID for visibility change debounce
 */
let visibilityTimeoutId: ReturnType<typeof setTimeout> | null = null;

/**
 * Timestamp of last successful validation
 */
let lastValidationTime = 0;

/**
 * Flag to track whether we ever had a valid session in this page load
 * This prevents triggering logout on initial app load when user hasn't logged in yet
 */
let hasHadValidSession = false;

// ====================================================================
// Core Validation Logic
// ====================================================================

/**
 * Validate the current session with Supabase (server-side, never cache)
 *
 * This function:
 * 1. Checks if Supabase session exists
 * 2. Validates user profile from database
 * 3. Checks if account is disabled
 * 4. Triggers logout if any check fails
 *
 * @returns Promise<boolean> - true if session is valid, false otherwise
 */
const validateSession = async (): Promise<boolean> => {
  // SECURITY: Prevent validation if logout is already in progress
  if (isLogoutInProgress()) return false;

  console.log('🔍 [SessionWatcher] Validating session...');

  try {
    // ====================================================================
    // Step 1: Check Supabase Session (server-side)
    // ====================================================================
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session || !session.user) {
      // Only trigger logout if we previously had a valid session
      // If we never had a session, this is normal (user not logged in yet)
      if (hasHadValidSession) {
        console.warn('⚠️ [SessionWatcher] Session expired after being valid');
        await performGlobalLogout({
          reason: 'session_expired',
          skipServerSignOut: true  // Session already invalid/missing
        });
      } else {
        console.log('ℹ️ [SessionWatcher] No session found (user not logged in yet)');
      }
      return false;
    }

    // ====================================================================
    // Step 2: Validate User Profile (server-side, with status check)
    // ====================================================================
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, status, role, org_id')
      .eq('id', session.user.id)
      .maybeSingle();

    // ====================================================================
    // Step 3: Check for Disabled Account or Missing Profile
    // ====================================================================
    if (!profile || profileError || profile.status === 'disabled') {
      console.warn('⚠️ [SessionWatcher] Account disabled or profile not found');
      await performGlobalLogout({
        reason: 'account_disabled',
        skipServerSignOut: false  // Need to revoke server session
      });
      return false;
    }

    // ====================================================================
    // Step 4: Session is Valid - Mark that we've had a valid session
    // ====================================================================
    hasHadValidSession = true;
    lastValidationTime = Date.now();
    console.log('✅ [SessionWatcher] Session validated successfully');
    return true;

  } catch (error) {
    console.error('❌ [SessionWatcher] Validation error:', error);
    // On error, for safety, trigger logout
    await performGlobalLogout({
      reason: 'auth_error',
      skipServerSignOut: true
    });
    return false;
  }
};

// ====================================================================
// Visibility & Focus Handlers
// ====================================================================

/**
 * Debounced handler for visibility change events
 * Triggers validation when tab becomes visible
 */
const handleVisibilityChange = () => {
  // Clear any pending debounce timeout
  if (visibilityTimeoutId) {
    clearTimeout(visibilityTimeoutId);
  }

  // Only validate when tab BECOMES visible (not when hidden)
  if (!document.hidden) {
    console.log('👁️ [SessionWatcher] Tab became visible, scheduling validation...');
    visibilityTimeoutId = setTimeout(() => {
      validateSession();
    }, VISIBILITY_DEBOUNCE_MS);
  }
};

/**
 * Handler for window focus events
 * Triggers validation when window gains focus
 */
const handleWindowFocus = () => {
  // Clear any pending debounce timeout
  if (visibilityTimeoutId) {
    clearTimeout(visibilityTimeoutId);
  }

  console.log('🎯 [SessionWatcher] Window gained focus, scheduling validation...');
  visibilityTimeoutId = setTimeout(() => {
    validateSession();
  }, VISIBILITY_DEBOUNCE_MS);
};

// ====================================================================
// Public API - Initialization
// ====================================================================

/**
 * Initialize the global session health watcher
 *
 * This function:
 * - Sets up visibility change listener
 * - Sets up window focus listener
 * - Starts periodic validation timer
 * - Performs initial validation
 *
 * IMPORTANT: This function is idempotent - calling it multiple times
 * will NOT create duplicate listeners or timers.
 *
 * @example
 * ```typescript
 * import { initSessionWatcher } from './lib/sessionWatcher';
 *
 * // Call once during app initialization
 * initSessionWatcher();
 * ```
 */
export const initSessionWatcher = () => {
  // ====================================================================
  // Idempotency Check - Prevent duplicate initialization
  // ====================================================================
  if (isInitialized) {
    console.log('⚠️ [SessionWatcher] Already initialized, skipping duplicate init');
    return;
  }

  console.log('🚀 [SessionWatcher] Initializing global session health watcher...');
  isInitialized = true;

  // ====================================================================
  // Set up visibility change listener
  // ====================================================================
  document.addEventListener('visibilitychange', handleVisibilityChange);
  console.log('✅ [SessionWatcher] Visibility change listener registered');

  // ====================================================================
  // Set up window focus listener
  // ====================================================================
  window.addEventListener('focus', handleWindowFocus);
  console.log('✅ [SessionWatcher] Window focus listener registered');

  // ====================================================================
  // Start periodic validation timer
  // ====================================================================
  validateIntervalId = setInterval(() => {
    // Only validate if tab is visible (don't waste resources on hidden tabs)
    if (!document.hidden) {
      validateSession();
    }
  }, SESSION_VALIDATE_INTERVAL_MS);
  console.log(`✅ [SessionWatcher] Periodic validation started (${SESSION_VALIDATE_INTERVAL_MS}ms interval)`);

  // ====================================================================
  // Perform initial validation
  // ====================================================================
  validateSession();

  console.log('✅ [SessionWatcher] Initialization complete');
};

// ====================================================================
// Public API - Manual Validation
// ====================================================================

/**
 * Manually trigger a session validation
 * Useful after critical operations or when you need immediate verification
 *
 * @example
 * ```typescript
 * import { validateSessionNow } from './lib/sessionWatcher';
 *
 * // After a sensitive operation
 * await someSensitiveOperation();
 * await validateSessionNow();
 * ```
 */
export const validateSessionNow = async () => {
  console.log('🔄 [SessionWatcher] Manual validation requested');
  return validateSession();
};

// ====================================================================
// Public API - Cleanup
// ====================================================================

/**
 * Stop the session watcher and clean up resources
 *
 * This function:
 * - Clears the periodic validation timer
 * - Removes event listeners
 * - Resets initialization state
 *
 * @example
 * ```typescript
 * import { destroySessionWatcher } from './lib/sessionWatcher';
 *
 * // Call when app is unmounting (if needed)
 * destroySessionWatcher();
 * ```
 */
export const destroySessionWatcher = () => {
  console.log('🛑 [SessionWatcher] Destroying session health watcher...');

  // Clear interval timer
  if (validateIntervalId) {
    clearInterval(validateIntervalId);
    validateIntervalId = null;
  }

  // Clear visibility debounce timeout
  if (visibilityTimeoutId) {
    clearTimeout(visibilityTimeoutId);
    visibilityTimeoutId = null;
  }

  // Remove event listeners
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('focus', handleWindowFocus);

  // Reset initialization state
  isInitialized = false;
  lastValidationTime = 0;
  hasHadValidSession = false;

  console.log('✅ [SessionWatcher] Destroyed successfully');
};

// ====================================================================
// Public API - Status Query
// ====================================================================

/**
 * Get the current status of the session watcher
 * Useful for debugging and monitoring
 *
 * @returns Object with watcher status information
 *
 * @example
 * ```typescript
 * import { getSessionWatcherStatus } from './lib/sessionWatcher';
 *
 * const status = getSessionWatcherStatus();
 * console.log('Watcher active:', status.isInitialized);
 * console.log('Last validation:', status.lastValidationTime);
 * ```
 */
export const getSessionWatcherStatus = () => {
  return {
    isInitialized,
    isActive: isInitialized && validateIntervalId !== null,
    lastValidationTime,
    timeSinceLastValidation: lastValidationTime ? Date.now() - lastValidationTime : null,
    validateInterval: SESSION_VALIDATE_INTERVAL_MS,
    visibilityDebounce: VISIBILITY_DEBOUNCE_MS,
    hasHadValidSession,
  };
};

// ====================================================================
// Export configuration constants
// ====================================================================

export const SESSION_WATCHER_CONFIG = {
  SESSION_VALIDATE_INTERVAL_MS,
  VISIBILITY_DEBOUNCE_MS,
  VERSION: '1.1.0',  // Added hasHadValidSession flag to prevent logout on initial load
};
