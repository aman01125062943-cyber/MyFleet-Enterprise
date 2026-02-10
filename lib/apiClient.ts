/**
 * @file apiClient.ts
 * @description Centralized authenticated API layer with automatic token management
 *
 * This module provides secure API wrappers that:
 * - Automatically attach access tokens to requests
 * - Handle 401 responses by refreshing the session and retrying
 * - Provide consistent error handling for Supabase RPC calls
 * - Log auth-related events for debugging
 * - Use centralized auth utilities for logout (authUtils.ts)
 * - Support permission guards for sensitive operations
 */

import { supabase } from './supabaseClient';
import { performGlobalLogout } from './authUtils';
import { Profile, UserPermissions } from '../types';

// ====================================================================
// Configuration
// ====================================================================

/**
 * Maximum number of retry attempts for failed requests
 */
const MAX_RETRY_ATTEMPTS = 1;

/**
 * HTTP status codes that indicate auth failures
 */
const AUTH_FAILURE_STATUSES = [401, 403];

/**
 * Error messages that indicate auth failures in Supabase
 */
const AUTH_ERROR_PATTERNS = [
    'JWT',
    'auth',
    'authorization',
    'token',
    'credentials'
];

// ====================================================================
// Type Definitions
// ====================================================================

interface AuthenticatedFetchOptions extends RequestInit {
    skipAuth?: boolean;
    skipRetry?: boolean;
}

interface ApiError extends Error {
    status?: number;
    code?: string;
    isAuthError?: boolean;
}

// ====================================================================
// Helper Functions
// ====================================================================

/**
 * Check if an error is authentication-related
 */
function isAuthError(error: unknown): boolean {
    if (error instanceof Error) {
        const message = error.message.toLowerCase();
        return AUTH_ERROR_PATTERNS.some(pattern => message.includes(pattern));
    }
    return false;
}

/**
 * Create an ApiError object with additional properties
 */
function createApiError(message: string, status?: number, code?: string): ApiError {
    const error = new Error(message) as ApiError;
    error.status = status;
    error.code = code;
    error.isAuthError = status === 401 || AUTH_ERROR_PATTERNS.some(p =>
        message.toLowerCase().includes(p)
    );
    return error;
}

// ====================================================================
// Authenticated Fetch Wrapper
// ====================================================================

/**
 * Enhanced fetch wrapper with automatic auth header injection and retry logic
 *
 * Features:
 * - Automatically attaches Bearer token from current session
 * - On 401: refreshes session and retries the request once
 * - Handles Supabase token refresh automatically
 * - Provides consistent error handling
 *
 * @param url - The URL to fetch
 * @param options - Request options (can include skipAuth, skipRetry)
 * @returns Promise<Response> - The fetch response
 *
 * @example
 * ```typescript
 * // Basic usage
 * const response = await authenticatedFetch('/api/user/profile');
 * const data = await response.json();
 *
 * // With custom options
 * const response = await authenticatedFetch('/api/data', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ foo: 'bar' })
 * });
 *
 * // Skip auth for public endpoints
 * const response = await authenticatedFetch('/api/public/data', {
 *   skipAuth: true
 * });
 *
 * // Skip retry for idempotent operations
 * const response = await authenticatedFetch('/api/logs', {
 *   skipRetry: true
 * });
 * ```
 */
export const authenticatedFetch = async (
    url: string,
    options: AuthenticatedFetchOptions = {}
): Promise<Response> => {
    const { skipAuth = false, skipRetry = false, ...fetchOptions } = options;

    // ====================================================================
    // Step 1: Prepare Request with Auth Headers
    // ====================================================================

    let headers = new Headers(fetchOptions.headers || {});

    // Set Content-Type if not a multipart form (which handles its own boundary)
    if (!headers.has('Content-Type') &&
        fetchOptions.body &&
        !(fetchOptions.body instanceof FormData) &&
        !(fetchOptions.body instanceof Blob) &&
        !(fetchOptions.body instanceof ReadableStream)) {
        headers.set('Content-Type', 'application/json');
    }

    // Add auth header if not explicitly skipped
    if (!skipAuth) {
        const session = await supabase.auth.getSession();
        const { data: { session: authSession } } = session;

        if (authSession?.access_token) {
            headers.set('Authorization', `Bearer ${authSession.access_token}`);
        } else {
            // No active session - fail fast
            throw createApiError('No active session. Please log in.', 401);
        }
    }

    // Add X-Client-Info header for debugging
    headers.set('X-Client-Info', 'myfleet-pro-web');

    // ====================================================================
    // Step 2: Make Initial Request
    // ====================================================================

    let response = await fetch(url, {
        ...fetchOptions,
        headers
    });

    // ====================================================================
    // Step 3: Handle Auth Failures with Refresh + Retry (unless skipped)
    // ====================================================================

    const needsAuthRetry =
        !skipRetry &&
        AUTH_FAILURE_STATUSES.includes(response.status) &&
        response.status === 401;

    if (needsAuthRetry) {
        console.log('🔄 Received 401, attempting token refresh and retry...');

        // Attempt to refresh the session
        const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();

        if (refreshError || !newSession) {
            // Refresh failed - session is truly expired
            console.error('❌ Session refresh failed, triggering global logout');

            // Use centralized logout (skip server signOut since session is already invalid)
            performGlobalLogout({
                reason: 'session_expired',
                skipServerSignOut: true
            });

            throw createApiError('Session expired. Please log in again.', 401);
        }

        // ====================================================================
        // Step 4: Retry with New Token
        // ====================================================================

        console.log('✅ Token refreshed, retrying request...');

        // Update headers with new token
        headers.set('Authorization', `Bearer ${newSession.access_token}`);

        // Retry the exact same request with new token
        response = await fetch(url, {
            ...fetchOptions,
            headers
        });

        // Log retry result
        if (response.ok) {
            console.log('✅ Request succeeded after token refresh');
        } else {
            console.warn(`⚠️ Request still failed after refresh: ${response.status}`);
        }
    }

    return response;
};

// ====================================================================
// Supabase RPC Wrapper with Auth Error Handling
// ====================================================================

/**
 * Secure wrapper for Supabase RPC calls with enhanced error handling
 *
 * Features:
 * - Automatic token refresh on auth failures
 * - Detailed error logging
 * - Type-safe parameter passing
 * - Consistent error throwing
 *
 * @param functionName - The name of the RPC function to call
 * @param params - Parameters to pass to the RPC function
 * @returns Promise with the RPC function result
 *
 * @example
 * ```typescript
 * // Simple RPC call
 * const result = await secureRpcCall('toggle_user_status', {
 *   p_target_user_id: 'user-123',
 *   p_status: 'disabled',
 *   p_admin_id: 'admin-456'
 * });
 *
 * // RPC call that returns data
 * const profile = await secureRpcCall('get_user_profile', {
 *   p_user_id: 'user-123'
 * });
 *
 * // Error handling
 * try {
 *   await secureRpcCall('some_function', { foo: 'bar' });
 * } catch (error) {
 *   if (error.isAuthError) {
 *     // Handle auth errors
 *   } else {
 *     // Handle other errors
 *   }
 * }
 * ```
 */
export const secureRpcCall = async <T = unknown>(
    functionName: string,
    params: Record<string, unknown> = {}
): Promise<T> => {
    let attemptCount = 0;

    const executeRpc = async (): Promise<T> => {
        attemptCount++;

        try {
            console.log(`🔐 RPC Call [${functionName}] (Attempt ${attemptCount})`);

            // Execute the RPC call
            const { data, error } = await supabase.rpc(functionName, params);

            // ====================================================================
            // Handle Auth Errors
            // ====================================================================

            if (error) {
                console.error(`❌ RPC Error [${functionName}]:`, error);

                // Check if this is an auth-related error
                if (isAuthError(error)) {
                    // This might be a token expiration issue
                    if (attemptCount <= MAX_RETRY_ATTEMPTS) {
                        console.log(`🔄 Auth error detected, attempting token refresh...`);

                        // Try to refresh the session
                        const { data: { session: newSession }, error: refreshError } =
                            await supabase.auth.refreshSession();

                        if (refreshError) {
                            // Refresh failed - use centralized logout
                            console.error('❌ Session refresh failed during RPC call');

                            // Use centralized logout (skip server signOut since session is already invalid)
                            performGlobalLogout({
                                reason: 'session_expired',
                                skipServerSignOut: true
                            });

                            throw createApiError(
                                'Session expired during RPC call. Please log in again.',
                                401,
                                error.code
                            );
                        }

                        // Retry the RPC call with fresh session
                        console.log('✅ Session refreshed, retrying RPC call...');
                        return executeRpc();
                    } else {
                        // Max retries reached
                        throw createApiError(
                            `Auth error after ${MAX_RETRY_ATTEMPTS} retries: ${error.message}`,
                            401
                        );
                    }
                }

                // Non-auth error - throw immediately
                throw createApiError(
                    error.message || 'RPC call failed',
                    undefined,
                    error.code
                );
            }

            // ====================================================================
            // Validate Response
            // ====================================================================

            if (data === null || data === undefined) {
                // RPC functions can return null (e.g., no rows found)
                // This is valid, just return it
                return data as T;
            }

            return data as T;

        } catch (error) {
            // Handle fetch/network errors
            if (error instanceof TypeError && error.message.includes('fetch')) {
                console.error(`❌ Network error during RPC call [${functionName}]:`, error);
                throw createApiError(
                    'Network error. Please check your connection.',
                    undefined,
                    'NETWORK_ERROR'
                );
            }

            // Re-throw other errors
            throw error;
        }
    };

    return executeRpc();
};

// ====================================================================
// Batch Request Helper
// ====================================================================

/**
 * Execute multiple RPC calls in parallel with a single session refresh
 * Useful when multiple RPCs need to be called together
 *
 * @param calls - Array of { functionName, params } objects
 * @returns Promise with array of results
 *
 * @example
 * ```typescript
 * const results = await batchRpcCalls([
 *   { functionName: 'get_user_profile', params: { p_user_id: '123' } },
 *   { functionName: 'get_org_settings', params: { p_org_id: '456' } },
 *   { functionName: 'check_permissions', params: { p_user_id: '123' } }
 * ]);
 * ```
 */
export const batchRpcCalls = async <T = unknown>(
    calls: Array<{ functionName: string; params?: Record<string, unknown> }>
): Promise<T[]> => {
    console.log(`📦 Executing ${calls.length} RPC calls in batch...`);

    try {
        // Ensure we have a fresh session before batch
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            throw createApiError('No active session for batch RPC calls.', 401);
        }

        // Execute all RPC calls in parallel
        const results = await Promise.all(
            calls.map(call =>
                secureRpcCall<T>(call.functionName, call.params || {})
            )
        );

        console.log(`✅ Batch RPC calls completed successfully`);
        return results;

    } catch (error) {
        console.error('❌ Batch RPC calls failed:', error);
        throw error;
    }
};

// ====================================================================
// Permission-Aware RPC Wrapper
// ====================================================================

/**
 * Secure RPC call with permission enforcement
 *
 * This function combines the security features of secureRpcCall with
 * client-side permission checks before executing sensitive operations.
 *
 * IMPORTANT: This is a DEFENSE IN DEPTH measure. Server-side RLS policies
 * and RPC function permission checks are the PRIMARY security mechanism.
 * Client-side checks provide better UX and fail-fast behavior.
 *
 * @param functionName - The name of the RPC function to call
 * @param params - Parameters to pass to the RPC function
 * @param options - Permission check options
 * @returns Promise with the RPC function result
 *
 * @example
 * ```typescript
 * import { secureRpcCallWithPermission } from './lib/apiClient';
 * import { assertPermission } from './lib/permissionGuard';
 *
 * // Before deleting a user
 * await secureRpcCallWithPermission(
 *   'toggle_user_status',
 *   { p_target_user_id: 'user-123', p_status: 'disabled', p_admin_id: 'admin-456' },
 *   { module: 'team', action: 'manage' }
 * );
 * ```
 */
export const secureRpcCallWithPermission = async <T = unknown>(
    functionName: string,
    params: Record<string, unknown> = {},
    options: {
        module?: keyof UserPermissions;
        action?: string;
        requiredRoles?: string[];
        userProfile?: Profile | null;
        validateWithServer?: boolean;
    } = {}
): Promise<T> => {
    const { module, action, requiredRoles, userProfile, validateWithServer } = options;

    // ====================================================================
    // Step 1: Client-side Permission Check (if profile provided)
    // ====================================================================
    if (userProfile) {
        // Dynamic import to avoid circular dependency
        const { assertPermission, assertRole } = await import('./permissionGuard');

        // Check role-based access first
        if (requiredRoles && requiredRoles.length > 0) {
            assertRole(userProfile, requiredRoles);
        }

        // Check module/action permissions
        if (module) {
            await assertPermission(userProfile, module, action, { validateWithServer });
        }

        console.log(`✅ [apiClient] Permission check passed for ${functionName}`);
    }

    // ====================================================================
    // Step 2: Execute RPC Call (server-side validation happens in RPC)
    // ====================================================================
    return secureRpcCall<T>(functionName, params);
};

// ====================================================================
// Health Check Helper
// ====================================================================

/**
 * Check if the current session is valid
 * Returns session info if valid, null otherwise
 */
export const checkSessionValidity = async (): Promise<{
    isValid: boolean;
    session: any | null;
    user: any | null;
}> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return { isValid: false, session: null, user: null };
        }

        // Verify session is actually valid by checking user profile
        const { data: user } = await supabase.auth.getUser();

        // Additional server-side validation
        if (user) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('status')
                .eq('id', user.id)
                .maybeSingle();

            if (profile?.status === 'disabled') {
                return { isValid: false, session: null, user: null };
            }
        }

        return {
            isValid: !!session && !!user,
            session,
            user
        };
    } catch (error) {
        console.error('Session validity check failed:', error);
        return { isValid: false, session: null, user: null };
    }
};

// ====================================================================
// Convenience Functions for Common Operations
// ====================================================================

/**
 * GET request with automatic auth
 */
export const apiGet = (url: string, options?: Omit<AuthenticatedFetchOptions, 'body'>) => {
    return authenticatedFetch(url, { ...options, method: 'GET' });
};

/**
 * POST request with automatic auth
 */
export const apiPost = <T = unknown>(url: string, data?: any, options?: Omit<AuthenticatedFetchOptions, 'body'>) => {
    return authenticatedFetch(url, {
        ...options,
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined
    });
};

/**
 * PUT request with automatic auth
 */
export const apiPut = <T = unknown>(url: string, data?: any, options?: Omit<AuthenticatedFetchOptions, 'body'>) => {
    return authenticatedFetch(url, {
        ...options,
        method: 'PUT',
        body: data ? JSON.stringify(data) : undefined
    });
};

/**
 * DELETE request with automatic auth
 */
export const apiDelete = (url: string, options?: Omit<AuthenticatedFetchOptions, 'body'>) => {
    return authenticatedFetch(url, { ...options, method: 'DELETE' });
};

// ====================================================================
// Export for testing and debugging
// ====================================================================

export const apiClientConfig = {
    MAX_RETRY_ATTEMPTS,
    AUTH_FAILURE_STATUSES,
    AUTH_ERROR_PATTERNS
};
