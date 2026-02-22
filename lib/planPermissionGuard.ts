/**
 * 🛡️ Plan Permission Guard System
 *
 * هذا النظام يضمن أن صلاحيات المستخدم لا تتجاوز صلاحيات الباقة
 * القاعدة: المستخدم = Subset من الباقة (لا يمكن أن يكون أكبر)
 *
 * Created: 2026-02-09
 * Purpose: Enforce plan-based permission limits across the entire system
 */

import type { UserPermissions, PlanFeatures } from '../types';

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// ============================================
// 1. خريطة الصلاحيات المسموحة لكل باقة
// ============================================

/**
 * الصلاحيات الفارغة (كل شيء معطل)
 */
export const EMPTY_PERMISSIONS: UserPermissions = {
  dashboard: { view: false },
  inventory: { view: false, add: false, edit: false, delete: false, manage_status: false },
  assets: { view: false, add: false, edit: false, delete: false },
  finance: { view: false, add_income: false, add_expense: false, export: false },
  team: { view: false, manage: false },
  reports: { view: false },
  subscription: {
    view_requests: false,
    approve_requests: false,
    reject_requests: false,
    manage_plans: false,
    manage_discounts: false,
    view_reports: false,
    manage_notifications: false
  }
};

/**
 * الصلاحيات القصوى المسموحة لكل باقة
 * لا يمكن للمستخدم تجاوز هذه الصلاحيات مهما كانت صلاحياته المحددة
 */
export const PLAN_MAX_PERMISSIONS: Record<string, UserPermissions> = {
  // باقة تجريبية - صلاحيات أساسية (بدون إدارة الخطط والخصومات)
  trial: {
    dashboard: { view: true },
    inventory: { view: true, add: true, edit: true, delete: true, manage_status: true },
    assets: { view: true, add: true, edit: true, delete: true },
    finance: { view: true, add_income: true, add_expense: true, export: true },
    team: { view: true, manage: true },
    reports: { view: true },
    subscription: {
      view_requests: true,
      approve_requests: false,
      reject_requests: false,
      manage_plans: false,
      manage_discounts: false,
      view_reports: false,
      manage_notifications: false
    }
  },

  // باقة منتهية - صفر صلاحيات (ماعدا الاشتراك للتجديد)
  expired: {
    dashboard: { view: false },
    inventory: { view: false, add: false, edit: false, delete: false, manage_status: false },
    assets: { view: false, add: false, edit: false, delete: false },
    finance: { view: false, add_income: false, add_expense: false, export: false },
    team: { view: false, manage: false },
    reports: { view: false },
    subscription: {
      view_requests: true,
      approve_requests: false,
      reject_requests: false,
      manage_plans: false,
      manage_discounts: false,
      view_reports: false,
      manage_notifications: false
    }
  },

  // باقة البداية - أساسية جداً
  starter: {
    dashboard: { view: true },
    inventory: { view: true, add: true, edit: false, delete: false, manage_status: false },
    assets: { view: true, add: true, edit: false, delete: false },
    finance: { view: true, add_income: true, add_expense: true, export: false },
    team: { view: false, manage: false },
    reports: { view: false },
    subscription: {
      view_requests: false,
      approve_requests: false,
      reject_requests: false,
      manage_plans: false,
      manage_discounts: false,
      view_reports: false,
      manage_notifications: false
    }
  },

  // باقة محترف - متوسطة
  pro: {
    dashboard: { view: true },
    inventory: { view: true, add: true, edit: true, delete: false, manage_status: true },
    assets: { view: true, add: true, edit: true, delete: true },
    finance: { view: true, add_income: true, add_expense: true, export: false },
    team: { view: true, manage: false },
    reports: { view: true },
    subscription: {
      view_requests: false,
      approve_requests: false,
      reject_requests: false,
      manage_plans: false,
      manage_discounts: false,
      view_reports: false,
      manage_notifications: false
    }
  },

  // باقة الأعمال - كل شيء
  business: {
    dashboard: { view: true },
    inventory: { view: true, add: true, edit: true, delete: true, manage_status: true },
    assets: { view: true, add: true, edit: true, delete: true },
    finance: { view: true, add_income: true, add_expense: true, export: true },
    team: { view: true, manage: true },
    reports: { view: true },
    subscription: {
      view_requests: true,
      approve_requests: true,
      reject_requests: true,
      manage_plans: true,
      manage_discounts: true,
      view_reports: true,
      manage_notifications: true
    }
  }
};

/**
 * خريطة الميزات (Features) للصلاحيات
 * تربط ميزات الباقة بالصلاحيات المسموحة
 */
export const FEATURE_TO_PERMISSIONS: Record<keyof PlanFeatures, DeepPartial<UserPermissions>> = {
  // التقارير
  reports: {
    reports: { view: true }
  },
  // تصدير البيانات
  export: {
    finance: { export: true }
  },
  // دعم الأولوية
  priority_support: {}, // لا يوجد صلاحية محددة له
  // المخزون
  inventory: {
    inventory: { view: true, add: true, edit: true, delete: true, manage_status: true }
  },
  // المالية
  finance: {
    finance: { view: true, add_income: true, add_expense: true }
  },
  // الفريق
  team: {
    team: { view: true, manage: true }
  },
  // الصيانة
  maintenance: {
    inventory: { manage_status: true }
  },
  // الأصول
  assets: {
    assets: { view: true, add: true, edit: true, delete: true }
  },
  // التقارير المتقدمة
  advanced_reports: {
    reports: { view: true }
  },
  // التنبيهات
  alerts: {} // لا يوجد صلاحية محددة له
};

// ============================================
// 2. دوال التحقق والتحقق
// ============================================

/**
 * التحقق من أن الصلاحية مسموح بها في الباقة
 * @param permissionPath مسار الصلاحية (مثال: 'inventory.view')
 * @param planId معرف الباقة
 * @returns هل الصلاحية مسموح بها؟
 */
export function isPermissionAllowedInPlan(
  permissionPath: string,
  planId: string
): boolean {
  const maxPermissions = PLAN_MAX_PERMISSIONS[planId] || PLAN_MAX_PERMISSIONS.trial;

  // تحليل مسار الصلاحية
  const [module, action] = permissionPath.split('.');

  if (!module || !maxPermissions[module]) {
    return false;
  }

  if (!action) {
    // طلب الوصول للوحدة ككل
    return Object.values(maxPermissions[module] || {}).some(v => v === true);
  }

  return maxPermissions[module]?.[action] === true;
}

/**
 * تصفية الصلاحيات حسب الباقة
 * تُزيل أي صلاحية غير مسموحة في الباقة
 * @param userPermissions صلاحيات المستخدم الحالية
 * @param planId معرف الباقة
 * @returns الصلاحيات بعد التصفية (Subset من الباقة)
 */
export function sanitizePermissionsByPlan(
  userPermissions: UserPermissions,
  planId: string
): UserPermissions {
  const maxPermissions = PLAN_MAX_PERMISSIONS[planId] || PLAN_MAX_PERMISSIONS.trial;
  const sanitized: UserPermissions = { ...EMPTY_PERMISSIONS };

  // نسخ الصلاحيات مع ضمان عدم تجاوز حدود الباقة
  for (const module in maxPermissions) {
    if (!userPermissions[module]) {
      // إذا لم تكن الصلاحية موجودة للمسبوع، نعطي القيم الافتراضية للوحدة من الباقة
      sanitized[module] = { ...maxPermissions[module] };
      continue;
    }

    const modulePermissions: Record<string, boolean> = {};
    const maxModule = maxPermissions[module];

    if (maxModule) {
      for (const action in maxModule) {
        const userValue = userPermissions[module]?.[action] ?? false;
        const planValue = maxModule[action] ?? false;
        modulePermissions[action] = !!(userValue && planValue);
      }
    }
    sanitized[module] = modulePermissions;
  }

  return sanitized;
}

/**
 * التحقق من صلاحية محددة
 * @param userPermissions صلاحيات المستخدم
 * @param planId معرف الباقة
 * @param module الوحدة (مثال: 'inventory')
 * @param action الإجراء (مثال: 'add')
 * @returns هل الصلاحية ممنوحة؟
 */
export function checkPermission(
  userPermissions: UserPermissions,
  planId: string,
  module: keyof UserPermissions,
  action?: string
): boolean {
  // أولاً: التحقق من الباقة
  if (!isPermissionAllowedInPlan(action ? `${String(module)}.${action}` : String(module), planId)) {
    return false;
  }

  // ثانياً: التحقق من صلاحية المستخدم
  if (!action) {
    // طلب الوصول للوحدة ككل
    return Object.values(userPermissions[module] || {}).some(v => v === true);
  }

  return userPermissions[module]?.[action] === true;
}

/**
 * التحقق من أن الصلاحيات لا تتجاوز الباقة
 * @param userPermissions صلاحيات المستخدم
 * @param planId معرف الباقة
 * @returns { valid: boolean, violations: string[] }
 */
export function validatePermissionsAgainstPlan(
  userPermissions: UserPermissions,
  planId: string
): { valid: boolean; violations: string[] } {
  const maxPermissions = PLAN_MAX_PERMISSIONS[planId] || PLAN_MAX_PERMISSIONS.trial;
  const violations: string[] = [];

  for (const module in userPermissions) {
    if (!maxPermissions[module]) {
      violations.push(`Module '${module}' not allowed in plan '${planId}'`);
      continue;
    }

    for (const action in userPermissions[module]) {
      const userValue = userPermissions[module][action];
      const planValue = maxPermissions[module][action];

      if (userValue === true && planValue !== true) {
        violations.push(`Permission '${module}.${action}' exceeds plan limits`);
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations
  };
}

// ============================================
// 3. إنشاء صلاحيات افتراضية حسب الباقة
// ============================================

/**
 * الحصول على الصلاحيات الافتراضية لباقة معينة
 * @param planId معرف الباقة
 * @returns الصلاحيات الافتراضية
 */
export function getDefaultPermissionsForPlan(planId: string): UserPermissions {
  const maxPermissions = PLAN_MAX_PERMISSIONS[planId] || PLAN_MAX_PERMISSIONS.trial;

  // نسخ عميق
  return JSON.parse(JSON.stringify(maxPermissions));
}

/**
 * الحصول على صلاحيات مخففة لباقة معينة
 * useful for creating staff users with limited permissions
 * @param planId معرف الباقة
 * @returns الصلاحيات المخففة
 */
export function getRestrictedPermissionsForPlan(planId: string): UserPermissions {
  const basePermissions = getDefaultPermissionsForPlan(planId);
  const restricted: UserPermissions = { ...EMPTY_PERMISSIONS };

  for (const moduleName in basePermissions) {
    const baseModule = basePermissions[moduleName];
    if (baseModule) {
      const moduleRestricted: Record<string, boolean> = {};
      for (const action in baseModule) {
        // إزالة صلاحيات الحذف والإدارة للمستخدمين المقيدين
        if (action === 'delete' || action === 'manage' || action === 'manage_plans' || action === 'manage_discounts') {
          moduleRestricted[action] = false;
        } else {
          // الاحتفاظ بـ view فقط
          moduleRestricted[action] = action === 'view';
        }
      }
      restricted[moduleName] = moduleRestricted;
    }
  }

  return restricted;
}

// ============================================
// 4. دمج الصلاحيات مع الحفاظ على حدود الباقة
// ============================================

/**
 * دمج صلاحيات المستخدم مع حدود الباقة
 * @param userPermissions صلاحيات المستخدم
 * @param planId معرف الباقة
 * @returns الصلاحيات المدمجة والمصفاة
 */
export function mergeWithPlanLimits(
  userPermissions: Partial<UserPermissions>,
  planId: string
): UserPermissions {
  const basePermissions = getDefaultPermissionsForPlan(planId);
  const sanitized: UserPermissions = { ...EMPTY_PERMISSIONS };

  for (const moduleName in basePermissions) {
    const moduleSanitized: Record<string, boolean> = {};
    const baseModule = basePermissions[moduleName];

    if (baseModule) {
      for (const action in baseModule) {
        const userValue = userPermissions[moduleName]?.[action];
        const planValue = baseModule[action];

        // userPermission OR planPermission، لكن لا يمكن تجاوز planPermission
        if (userValue !== undefined) {
          moduleSanitized[action] = !!(userValue && planValue);
        } else {
          moduleSanitized[action] = !!planValue;
        }
      }
      sanitized[moduleName] = moduleSanitized;
    }
  }

  return sanitized;
}

// ============================================
// 5. تصدير لتقارير التدقيق
// ============================================

export interface PermissionAuditReport {
  planId: string;
  planName: string;
  maxPermissions: UserPermissions;
  userCount: number;
  violations: {
    userId: string;
    userName: string;
    violations: string[];
  }[];
}

/**
 * إنشاء تقرير عن حالة الصلاحيات
 * @param users قائمة المستخدمين مع صلاحياتهم
 * @param planId معرف الباقة
 * @returns تقرير التدقيق
 */
export function generatePermissionAuditReport(
  users: Array<{ id: string; full_name: string; permissions: UserPermissions }>,
  planId: string
): PermissionAuditReport {
  const maxPermissions = PLAN_MAX_PERMISSIONS[planId];
  const violations: PermissionAuditReport['violations'] = [];

  for (const user of users) {
    const validation = validatePermissionsAgainstPlan(user.permissions, planId);
    if (!validation.valid) {
      violations.push({
        userId: user.id,
        userName: user.full_name,
        violations: validation.violations
      });
    }
  }

  return {
    planId,
    planName: planId.charAt(0).toUpperCase() + planId.slice(1),
    maxPermissions,
    userCount: users.length,
    violations
  };
}

// ============================================
// 6. الثوابت
// ============================================

/**
 * قائمة بأسماء الباقات المدعومة
 */
export const SUPPORTED_PLANS = ['trial', 'starter', 'pro', 'business', 'expired'] as const;
export type SupportedPlan = typeof SUPPORTED_PLANS[number];

/**
 * التحقق من أن الباقة مدعومة
 */
export function isValidPlan(planId: string): planId is SupportedPlan {
  return (SUPPORTED_PLANS as readonly string[]).includes(planId);
}

/**
 * الحصول على اسم الباقة بالعربية
 */
export const PLAN_NAMES_AR: Record<SupportedPlan, string> = {
  trial: 'تجريبي',
  starter: 'بداية',
  pro: 'محترف',
  business: 'أعمال',
  expired: 'منتهي'
};
