/**
 * 🎯 React Hook for Plan-Based Permission Guard
 *
 * يوفر طرق سهلة للتحقق من الصلاحيات مع مراعاة حدود الباقة
 * Created: 2026-02-09
 */

import { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { LayoutContextType } from '../components/Layout';
import type { UserPermissions } from '../types';
import {
  checkPermission,
  sanitizePermissionsByPlan,
  validatePermissionsAgainstPlan,
  PLAN_MAX_PERMISSIONS,
  getDefaultPermissionsForPlan,
  getRestrictedPermissionsForPlan,
  PLAN_NAMES_AR,
  type SupportedPlan
} from './planPermissionGuard';

// ============================================
// Types
// ============================================

export interface UsePlanPermissionsResult {
  // البيانات الأساسية
  planId: string | null;
  planName: string;
  userPermissions: UserPermissions | null;
  maxPermissions: UserPermissions | null;
  isSuperAdmin: boolean;

  // التحقق من الصلاحيات
  can: (module: keyof UserPermissions, action?: string) => boolean;
  cannot: (module: keyof UserPermissions, action?: string) => boolean;

  // التحقق من الوحدات
  canViewInventory: boolean;
  canAddInventory: boolean;
  canEditInventory: boolean;
  canDeleteInventory: boolean;
  canViewAssets: boolean;
  canManageTeam: boolean;
  canViewReports: boolean;
  canExportFinance: boolean;
  canManageSubscription: boolean;

  // الصلاحيات القصوى المسموحة
  isModuleAllowedInPlan: (module: keyof UserPermissions) => boolean;
  isActionAllowedInPlan: (module: keyof UserPermissions, action: string) => boolean;

  // التحقق من التجاوزات
  hasPermissionViolations: boolean;
  violations: string[];

  // الصلاحيات المصفاة
  sanitizedPermissions: UserPermissions | null;

  // الحصول على الصلاحيات الافتراضية
  getDefaultPlanPermissions: () => UserPermissions;
  getRestrictedPlanPermissions: () => UserPermissions;
}

// ============================================
// Helper Functions
// ============================================


// ============================================
// Main Hook
// ============================================

export function usePlanPermissions(): UsePlanPermissionsResult {
  const context = useOutletContext<LayoutContextType | undefined>();
  const profile = context?.user || null;
  const org = context?.org || null;

  const planId = useMemo(() => {
    if (!org) return null;

    // 🔒 فحص انتهاء الباقة
    const subscriptionEnd = org?.subscription_end;
    const manualExtensionEnd = org?.manual_extension_end;

    if (subscriptionEnd) {
      const today = new Date();
      const endDate = new Date(subscriptionEnd);
      const manualEndDate = manualExtensionEnd ? new Date(manualExtensionEnd) : null;
      const effectiveEndDate = (manualEndDate && manualEndDate > endDate) ? manualEndDate : endDate;

      const daysDiff = Math.ceil((effectiveEndDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
      const graceDays = context?.systemConfig?.grace_period_days ?? 7;

      if (daysDiff < -graceDays && org.is_active !== false && profile?.role !== 'super_admin') {
        console.warn('⏰ [Plan] Subscription fully expired:', subscriptionEnd);
        return 'expired';
      }
    }

    if (org.is_active === false && profile?.role !== 'super_admin') return 'expired';

    return org?.subscription_plan || 'trial';
  }, [org, profile?.role, context?.systemConfig]);

  const userPermissions = useMemo(() => {
    return profile?.permissions || null;
  }, [profile]);

  const maxPermissions = useMemo(() => {
    if (!planId) return null;
    return PLAN_MAX_PERMISSIONS[planId as SupportedPlan] || PLAN_MAX_PERMISSIONS.trial;
  }, [planId]);

  const isSuperAdmin = useMemo(() => {
    return profile?.role === 'super_admin';
  }, [profile]);

  const planName = useMemo(() => {
    if (!planId) return 'غير محدد';
    return PLAN_NAMES_AR[planId as SupportedPlan] || planId;
  }, [planId]);

  // التحقق من التجاوزات
  const { hasPermissionViolations, violations } = useMemo(() => {
    if (!userPermissions || !planId || isSuperAdmin) {
      return { hasPermissionViolations: false, violations: [] };
    }

    const validation = validatePermissionsAgainstPlan(userPermissions, planId);
    return {
      hasPermissionViolations: !validation.valid,
      violations: validation.violations
    };
  }, [userPermissions, planId, isSuperAdmin]);

  // الصلاحيات المصفاة
  const sanitizedPermissions = useMemo(() => {
    if (!userPermissions || !planId || isSuperAdmin) return userPermissions;
    return sanitizePermissionsByPlan(userPermissions, planId);
  }, [userPermissions, planId, isSuperAdmin]);

  // دالة التحقق الرئيسية
  const can = useMemo(() => {
    return (module: keyof UserPermissions, action?: string): boolean => {
      // Super admins have all permissions
      if (isSuperAdmin) return true;

      if (!userPermissions || !planId) return false;
      return checkPermission(userPermissions, planId, module, action);
    };
  }, [userPermissions, planId, isSuperAdmin]);

  const cannot = useMemo(() => {
    return (module: keyof UserPermissions, action?: string): boolean => {
      return !can(module, action);
    };
  }, [can]);

  // الصلاحيات الشائعة المختصرة
  const canViewInventory = can('inventory', 'view');
  const canAddInventory = can('inventory', 'add');
  const canEditInventory = can('inventory', 'edit');
  const canDeleteInventory = can('inventory', 'delete');
  const canViewAssets = can('assets', 'view');
  const canManageTeam = can('team', 'manage');
  const canViewReports = can('reports', 'view');
  const canExportFinance = can('finance', 'export');
  const canManageSubscription = can('subscription', 'view_requests');

  // التحقق من الصلاحيات في الباقة
  const isModuleAllowedInPlan = useMemo(() => {
    return (module: keyof UserPermissions): boolean => {
      if (!planId || isSuperAdmin) return true;
      const maxPerms = PLAN_MAX_PERMISSIONS[planId as SupportedPlan];
      return Object.values(maxPerms[module] || {}).some(v => v === true);
    };
  }, [planId, isSuperAdmin]);

  const isActionAllowedInPlan = useMemo(() => {
    return (module: keyof UserPermissions, action: string): boolean => {
      if (!planId || isSuperAdmin) return true;
      const maxPerms = PLAN_MAX_PERMISSIONS[planId as SupportedPlan];
      return maxPerms[module]?.[action] === true;
    };
  }, [planId, isSuperAdmin]);

  // الحصول على الصلاحيات الافتراضية
  const getDefaultPlanPermissions = useMemo(() => {
    return (): UserPermissions => {
      if (!planId) return getDefaultPermissionsForPlan('trial');
      return getDefaultPermissionsForPlan(planId);
    };
  }, [planId]);

  const getRestrictedPlanPermissions = useMemo(() => {
    return (): UserPermissions => {
      if (!planId) return getRestrictedPermissionsForPlan('trial');
      return getRestrictedPermissionsForPlan(planId);
    };
  }, [planId]);

  return {
    // البيانات الأساسية
    planId,
    planName,
    userPermissions,
    maxPermissions,
    isSuperAdmin,

    // التحقق من الصلاحيات
    can,
    cannot,

    // الصلاحيات الشائعة
    canViewInventory,
    canAddInventory,
    canEditInventory,
    canDeleteInventory,
    canViewAssets,
    canManageTeam,
    canViewReports,
    canExportFinance,
    canManageSubscription,

    // التحقق من الباقة
    isModuleAllowedInPlan,
    isActionAllowedInPlan,

    // التجاوزات
    hasPermissionViolations,
    violations,

    // الصلاحيات المصفاة
    sanitizedPermissions,

    // الصلاحيات الافتراضية
    getDefaultPlanPermissions,
    getRestrictedPlanPermissions
  };
}

// ============================================
// Utility Components
// ============================================

/**
 * مكون يعرض محتوى فقط إذا كانت الصلاحية ممنوحة
 */
export function IfCan({
  module,
  action,
  fallback = null,
  children
}: {
  module: keyof UserPermissions;
  action?: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { can } = usePlanPermissions();

  if (can(module, action)) {
    return <>{children} </>;
  }

  return <>{fallback} </>;
}

/**
 * مكون يعرض محتوى فقط إذا كانت الصلاحية غير ممنوحة
 */
export function UnlessCan({
  module,
  action,
  fallback = null,
  children
}: {
  module: keyof UserPermissions;
  action?: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { can } = usePlanPermissions();

  if (!can(module, action)) {
    return <>{children} </>;
  }

  return <>{fallback} </>;
}

/**
 * مكون يعرض رسالة عندما تكون الصلاحية مفقودة
 */
export function RequirePermission({
  module,
  action,
  message = 'ليس لديك صلاحية للوصول إلى هذا الجزء',
  children
}: {
  module: keyof UserPermissions;
  action?: string;
  message?: string;
  children: React.ReactNode;
}) {
  const { can } = usePlanPermissions();

  if (!can(module, action)) {
    return (
      <div className="flex items-center justify-center p-8 bg-amber-500/10 border border-amber-500/20 rounded-xl" >
        <div className="text-center" >
          <svg className="w-12 h-12 mx-auto mb-3 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          < p className="text-amber-200 font-medium" > {message} </p>
          < p className="text-amber-300/60 text-sm mt-1" >
            هذه الميزة غير متاحة في باقتك الحالية
          </p>
        </div>
      </div>
    );
  }

  return <>{children} </>;
}

/**
 * مكون يعرض شارة "ميزة Premium" للميزات غير المتاحة في الباقة
 */
export function PlanFeatureBadge({
  module,
  action,
  planRequired,
  children
}: {
  module: keyof UserPermissions;
  action?: string;
  planRequired?: SupportedPlan;
  children: React.ReactElement;
}) {
  const { isActionAllowedInPlan } = usePlanPermissions();
  const isAllowed = isActionAllowedInPlan(module, action || 'view');

  if (!isAllowed) {
    return (
      <div className="relative group" >
        {children}
        < div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm rounded-lg flex items-center justify-center" >
          <div className="text-center p-4" >
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full text-sm font-bold shadow-lg" >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {planRequired ? `ميزة باقة ${PLAN_NAMES_AR[planRequired]}` : 'ميزة متقدمة'}
            </span>
            < p className="text-white/80 text-sm mt-2" > رقِّ اشتراكك للوصول إلى هذه الميزة </p>
          </div>
        </div>
      </div>
    );
  }

  return children;
}

export default usePlanPermissions;
