/**
 * @file permissionGuard.ts
 * @description Centralized role and permission guard system
 *
 * This module provides:
 * - assertPermission(): Enforce permission checks before sensitive operations
 * - checkPermission(): Non-throwing permission query
 * - PermissionError: Custom error type for permission denials
 * - Role-based access control helpers
 *
 * Usage:
 * - Import assertPermission before sensitive RPC/API calls
 * - Import checkPermission for conditional logic
 * - Permission denials throw descriptive errors for user feedback
 *
 * @example
 * ```typescript
 * import { assertPermission } from './lib/permissionGuard';
 *
 * // Before a sensitive operation
 * assertPermission(userProfile, 'inventory', 'delete');
 * await supabase.from('cars').delete().eq('id', carId);
 *
 * // Check without throwing
 * import { checkPermission } from './lib/permissionGuard';
 * if (checkPermission(userProfile, 'team', 'manage')) {
 *   // Show manage team button
 * }
 * ```
 */

import { supabase } from './supabaseClient';
import { Profile, UserPermissions } from '../types';

// ====================================================================
// Types
// ====================================================================

/**
 * Permission action types
 * Maps to the structure of UserPermissions
 */
export type PermissionModule = keyof UserPermissions;
export type PermissionAction = string; // 'view', 'add', 'edit', 'delete', 'manage', etc.

/**
 * Permission assertion options
 */
export interface AssertPermissionOptions {
  /**
   * Custom error message when permission is denied
   * If not provided, a default message will be generated
   */
  errorMessage?: string;

  /**
   * Whether to fetch fresh user profile from server
   * Use this for critical operations to ensure permissions haven't changed
   */
  validateWithServer?: boolean;
}

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  granted: boolean;
  reason?: string;
  module?: PermissionModule;
  action?: PermissionAction;
}

// ====================================================================
// Custom Error Types
// ====================================================================

/**
 * Custom error thrown when permission is denied
 * Includes details about what permission was required and why it was denied
 */
export class PermissionError extends Error {
  public readonly code: string;
  public readonly module?: PermissionModule;
  public readonly action?: PermissionAction;
  public readonly userId?: string;
  public readonly userRole?: string;

  constructor(
    message: string,
    options: {
      code?: string;
      module?: PermissionModule;
      action?: PermissionAction;
      userId?: string;
      userRole?: string;
    } = {}
  ) {
    super(message);
    this.name = 'PermissionError';
    this.code = options.code || 'PERMISSION_DENIED';
    this.module = options.module;
    this.action = options.action;
    this.userId = options.userId;
    this.userRole = options.userRole;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PermissionError);
    }
  }

  /**
   * Get a user-friendly error message in Arabic
   */
  toArabicMessage(): string {
    const messages: Record<string, string> = {
      PERMISSION_DENIED: 'ليس لديك صلاحية للقيام بهذا الإجراء',
      MODULE_ACCESS_DENIED: 'ليس لديك صلاحية للوصول إلى هذا القسم',
      ACTION_NOT_ALLOWED: 'ليس لديك صلاحية للقيام بهذا الإجراء',
      NO_PROFILE: 'لم يتم العثور على ملف المستخدم',
      PROFILE_DISABLED: 'تم تعطيل حسابك',
      ROLE_REQUIRED: 'هذا الإجراء يتطلب صلاحية مسؤول',
    };

    return messages[this.code] || messages.PERMISSION_DENIED;
  }

  /**
   * Convert to a plain object for API responses
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      arabicMessage: this.toArabicMessage(),
      module: this.module,
      action: this.action,
      userId: this.userId,
      userRole: this.userRole,
    };
  }
}

// ====================================================================
// Private Helper Functions
// ====================================================================

/**
 * Check if a value is a valid permission object (has boolean properties)
 */
function isPermissionObject(value: unknown): value is Record<string, boolean> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value as Record<string, unknown>).every(
      v => typeof v === 'boolean' || typeof v === 'undefined'
    )
  );
}

/**
 * Check if the user has a specific permission
 */
function hasPermission(
  permissions: UserPermissions | undefined,
  module: PermissionModule,
  action?: PermissionAction
): PermissionCheckResult {
  // No permissions object
  if (!permissions) {
    return {
      granted: false,
      reason: 'No permissions object found',
      module,
      action,
    };
  }

  // Get the module permissions
  const modulePermissions = permissions[module];

  // Module not found in permissions
  if (modulePermissions === undefined) {
    return {
      granted: false,
      reason: `Module '${module}' not found in permissions`,
      module,
      action,
    };
  }

  // Module permissions should be an object with boolean values
  if (!isPermissionObject(modulePermissions)) {
    return {
      granted: false,
      reason: `Invalid permissions structure for module '${module}'`,
      module,
      action,
    };
  }

  // If action is specified, check that specific action
  if (action) {
    const hasAction = modulePermissions[action] === true;
    return {
      granted: hasAction,
      reason: hasAction ? undefined : `Action '${action}' not granted for module '${module}'`,
      module,
      action,
    };
  }

  // If no action specified, check 'view' permission by default
  const hasView = modulePermissions.view === true;
  return {
    granted: hasView,
    reason: hasView ? undefined : `View permission not granted for module '${module}'`,
    module,
  };
}

/**
 * Validate user profile status
 */
function validateProfileStatus(profile: Profile | null): PermissionCheckResult {
  // No profile
  if (!profile) {
    return {
      granted: false,
      reason: 'No user profile found',
    };
  }

  // Disabled account
  if (profile.status === 'disabled') {
    return {
      granted: false,
      reason: 'User account is disabled',
    };
  }

  return { granted: true };
}

/**
 * Validate role-based access
 */
function validateRoleAccess(
  profile: Profile,
  requiredRoles?: string[]
): PermissionCheckResult {
  if (!requiredRoles || requiredRoles.length === 0) {
    return { granted: true };
  }

  const userRole = profile.role;
  if (!userRole) {
    return {
      granted: false,
      reason: `User has no role assigned`,
    };
  }

  const hasRequiredRole = requiredRoles.includes(userRole);
  if (!hasRequiredRole) {
    return {
      granted: false,
      reason: `Role '${userRole}' not in required roles: ${requiredRoles.join(', ')}`,
    };
  }

  return { granted: true };
}

// ====================================================================
// Public API - Permission Assertion (Throws)
// ====================================================================

/**
 * Assert that the user has the specified permission
 *
 * This function ENFORCES permission checks by throwing a PermissionError
 * if the user doesn't have the required permission.
 *
 * Use this before sensitive operations to ensure security.
 *
 * @param profile - User profile to check permissions against
 * @param module - The module/feature to check (e.g., 'inventory', 'team')
 * @param action - The specific action (e.g., 'add', 'edit', 'delete')
 * @param options - Additional options (custom error message, server validation)
 *
 * @throws {PermissionError} If permission is denied
 *
 * @example
 * ```typescript
 * import { assertPermission } from './lib/permissionGuard';
 * import { supabase } from './lib/supabaseClient';
 *
 * async function deleteCar(carId: string, userProfile: Profile) {
 *   // Enforce permission before proceeding
 *   assertPermission(userProfile, 'inventory', 'delete');
 *
 *   // Permission granted, proceed with operation
 *   await supabase.from('cars').delete().eq('id', carId);
 * }
 * ```
 */
export async function assertPermission(
  profile: Profile | null,
  module: PermissionModule,
  action?: PermissionAction,
  options: AssertPermissionOptions = {}
): Promise<void> {
  const { errorMessage, validateWithServer = false } = options;

  // ====================================================================
  // Step 1: Validate profile status (always check)
  // ====================================================================
  const statusCheck = validateProfileStatus(profile);
  if (!statusCheck.granted) {
    throw new PermissionError(
      errorMessage || statusCheck.reason || 'Permission denied',
      {
        code: profile?.status === 'disabled' ? 'PROFILE_DISABLED' : 'NO_PROFILE',
        module,
        action,
        userId: profile?.id,
        userRole: profile?.role,
      }
    );
  }

  // ====================================================================
  // Step 2: Optional server-side validation
  // Fetch fresh profile to ensure permissions haven't changed
  // ====================================================================
  let validatedProfile = profile;

  if (validateWithServer && profile?.id) {
    try {
      const { data: freshProfile } = await supabase
        .from('profiles')
        .select('id, role, status, permissions')
        .eq('id', profile.id)
        .single();

      if (freshProfile) {
        validatedProfile = freshProfile as Profile;

        // Re-validate status with fresh data
        const freshStatusCheck = validateProfileStatus(validatedProfile);
        if (!freshStatusCheck.granted) {
          throw new PermissionError(
            errorMessage || freshStatusCheck.reason || 'Permission denied',
            {
              code: validatedProfile.status === 'disabled' ? 'PROFILE_DISABLED' : 'NO_PROFILE',
              module,
              action,
              userId: validatedProfile.id,
              userRole: validatedProfile.role,
            }
          );
        }
      }
    } catch (error) {
      // If server validation fails, proceed with cached profile
      // (better to allow with cached permissions than to block on error)
      console.warn('[permissionGuard] Server validation failed, using cached profile:', error);
    }
  }

  // ====================================================================
  // Step 3: Check module/action permission
  // ====================================================================
  const permissionCheck = hasPermission(validatedProfile.permissions, module, action);

  if (!permissionCheck.granted) {
    throw new PermissionError(
      errorMessage || `You don't have permission to ${action || 'access'} ${module}`,
      {
        code: action ? 'ACTION_NOT_ALLOWED' : 'MODULE_ACCESS_DENIED',
        module,
        action,
        userId: validatedProfile.id,
        userRole: validatedProfile.role,
      }
    );
  }

  // Permission granted - function completes without throwing
  console.log(`✅ [permissionGuard] Permission granted: ${module}${action ? '.' + action : ''}`);
}

/**
 * Assert that the user has one of the required roles
 *
 * Use this for role-based access control (e.g., admin-only operations)
 *
 * @param profile - User profile to check
 * @param requiredRoles - Array of roles that are allowed (e.g., ['admin', 'super_admin'])
 * @param errorMessage - Optional custom error message
 *
 * @throws {PermissionError} If user doesn't have any of the required roles
 *
 * @example
 * ```typescript
 * import { assertRole } from './lib/permissionGuard';
 *
 * // Only admins and super_admins can access this
 * assertRole(userProfile, ['admin', 'super_admin']);
 * await superAdminOperation();
 * ```
 */
export function assertRole(
  profile: Profile | null,
  requiredRoles: string[],
  errorMessage?: string
): void {
  const statusCheck = validateProfileStatus(profile);
  if (!statusCheck.granted) {
    throw new PermissionError(
      errorMessage || statusCheck.reason || 'Permission denied',
      {
        code: profile?.status === 'disabled' ? 'PROFILE_DISABLED' : 'NO_PROFILE',
        userId: profile?.id,
        userRole: profile?.role,
      }
    );
  }

  const roleCheck = validateRoleAccess(profile, requiredRoles);
  if (!roleCheck.granted) {
    throw new PermissionError(
      errorMessage || `This action requires one of the following roles: ${requiredRoles.join(', ')}`,
      {
        code: 'ROLE_REQUIRED',
        userId: profile?.id,
        userRole: profile?.role,
      }
    );
  }

  console.log(`✅ [permissionGuard] Role check passed: ${profile?.role} in ${requiredRoles.join(', ')}`);
}

// ====================================================================
// Public API - Permission Query (Non-Throwing)
// ====================================================================

/**
 * Check if the user has the specified permission (non-throwing)
 *
 * Use this for conditional logic where you don't want to throw an error
 *
 * @param profile - User profile to check permissions against
 * @param module - The module/feature to check
 * @param action - The specific action
 * @returns PermissionCheckResult with granted boolean and optional reason
 *
 * @example
 * ```typescript
 * import { checkPermission } from './lib/permissionGuard';
 *
 * const result = checkPermission(userProfile, 'inventory', 'delete');
 * if (result.granted) {
 *   // Show delete button
 * } else {
 *   console.log('Why not granted:', result.reason);
 * }
 * ```
 */
export function checkPermission(
  profile: Profile | null,
  module: PermissionModule,
  action?: PermissionAction
): PermissionCheckResult {
  const statusCheck = validateProfileStatus(profile);
  if (!statusCheck.granted) {
    return statusCheck;
  }

  return hasPermission(profile?.permissions, module, action);
}

/**
 * Check if the user has one of the required roles (non-throwing)
 *
 * @param profile - User profile to check
 * @param requiredRoles - Array of roles that are allowed
 * @returns true if user has any of the required roles
 *
 * @example
 * ```typescript
 * import { checkRole } from './lib/permissionGuard';
 *
 * if (checkRole(userProfile, ['admin', 'super_admin'])) {
 *   // Show admin controls
 * }
 * ```
 */
export function checkRole(
  profile: Profile | null,
  requiredRoles: string[]
): boolean {
  const statusCheck = validateProfileStatus(profile);
  if (!statusCheck.granted) {
    return false;
  }

  const roleCheck = validateRoleAccess(profile, requiredRoles);
  return roleCheck.granted;
}

// ====================================================================
// Public API - Batch Permission Checks
// ====================================================================

/**
 * Check multiple permissions at once
 *
 * Useful for UI components that need to check several permissions
 *
 * @param profile - User profile to check against
 * @param permissions - Array of { module, action } objects to check
 * @returns Object mapping each permission check to granted boolean
 *
 * @example
 * ```typescript
 * import { checkPermissions } from './lib/permissionGuard';
 *
 * const permissions = checkPermissions(userProfile, [
 *   { module: 'inventory', action: 'add' },
 *   { module: 'inventory', action: 'edit' },
 *   { module: 'inventory', action: 'delete' },
 * ]);
 *
 * if (permissions['inventory.add']) {
 *   // Show add button
 * }
 * ```
 */
export function checkPermissions(
  profile: Profile | null,
  permissions: Array<{ module: PermissionModule; action?: PermissionAction }>
): Record<string, boolean> {
  const results: Record<string, boolean> = {};

  for (const { module, action } of permissions) {
    const key = action ? `${module}.${action}` : module;
    const result = checkPermission(profile, module, action);
    results[key] = result.granted;
  }

  return results;
}

// ====================================================================
// Public API - Utility Functions
// ====================================================================

/**
 * Get all permissions for a user as a flat object
 * Useful for debugging or permission inspection
 *
 * @param profile - User profile
 * @returns Flat object with all permissions as booleans
 *
 * @example
 * ```typescript
 * import { getFlatPermissions } from './lib/permissionGuard';
 *
 * const perms = getFlatPermissions(userProfile);
 * console.log(perms); // { 'inventory.view': true, 'inventory.add': false, ... }
 * ```
 */
export function getFlatPermissions(profile: Profile | null): Record<string, boolean> {
  const flat: Record<string, boolean> = {};

  if (!profile?.permissions) {
    return flat;
  }

  for (const [module, modulePerms] of Object.entries(profile.permissions)) {
    if (isPermissionObject(modulePerms)) {
      for (const [action, granted] of Object.entries(modulePerms)) {
        flat[`${module}.${action}`] = granted === true;
      }
    }
  }

  return flat;
}

/**
 * Check if user is a super admin
 *
 * @param profile - User profile
 * @returns true if user is a super admin
 */
export function isSuperAdmin(profile: Profile | null): boolean {
  return profile?.role === 'super_admin' && profile?.status === 'active';
}

/**
 * Check if user is an org admin (owner or admin role)
 *
 * @param profile - User profile
 * @returns true if user is an org admin
 */
export function isOrgAdmin(profile: Profile | null): boolean {
  if (!profile || profile.status !== 'active') {
    return false;
  }
  return profile.role === 'owner' || profile.role === 'admin';
}

// ====================================================================
// Export configuration constants
// ====================================================================

export const PERMISSION_GUARD_CONFIG = {
  VERSION: '1.0.0',
  DEFAULT_PERMISSION_ACTION: 'view',
};

// Re-export PermissionError for convenience
export { PermissionError };
