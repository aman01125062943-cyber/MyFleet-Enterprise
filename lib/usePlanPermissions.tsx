import React, { ReactNode } from 'react';
import { useOutletContext } from 'react-router-dom';
import { LayoutContextType } from '../components/Layout';

// Define the plan levels and their corresponding features
export type PlanLevel = 'free' | 'basic' | 'pro' | 'enterprise';

export interface PlanPermissions {
  max_cars: number;
  can_add_expenses: boolean;
  can_view_reports: boolean;
  can_export_data: boolean;
  can_manage_users: boolean;
  can_use_reminders: boolean;
  can_use_analytics: boolean;
  has_white_label: boolean;
  support_level: 'email' | 'priority' | 'dedicated';
  retention_days: number;
}

export const PLAN_PERMISSIONS: Record<PlanLevel, PlanPermissions> = {
  free: {
    max_cars: 2,
    can_add_expenses: true,
    can_view_reports: true,
    can_export_data: false,
    can_manage_users: false,
    can_use_reminders: false,
    can_use_analytics: false,
    has_white_label: false,
    support_level: 'email',
    retention_days: 30,
  },
  basic: {
    max_cars: 10,
    can_add_expenses: true,
    can_view_reports: true,
    can_export_data: true,
    can_manage_users: false,
    can_use_reminders: true,
    can_use_analytics: false,
    has_white_label: false,
    support_level: 'email',
    retention_days: 90,
  },
  pro: {
    max_cars: 50,
    can_add_expenses: true,
    can_view_reports: true,
    can_export_data: true,
    can_manage_users: true,
    can_use_reminders: true,
    can_use_analytics: true,
    has_white_label: false,
    support_level: 'priority',
    retention_days: 365,
  },
  enterprise: {
    max_cars: 1000,
    can_add_expenses: true,
    can_view_reports: true,
    can_export_data: true,
    can_manage_users: true,
    can_use_reminders: true,
    can_use_analytics: true,
    has_white_label: true,
    support_level: 'dedicated',
    retention_days: 9999,
  },
};

export const PLAN_NAMES_AR: Record<PlanLevel, string> = {
  free: 'المجانية',
  basic: 'الأساسية',
  pro: 'المتقدمة',
  enterprise: 'المؤسسات',
};

const usePlanPermissions = () => {
  const { org } = useOutletContext<LayoutContextType>();

  const currentPlan: PlanLevel = (org?.subscription_plan as PlanLevel) || 'free';
  const permissions = PLAN_PERMISSIONS[currentPlan];

  const checkPermission = (feature: keyof PlanPermissions) => {
    return permissions[feature];
  };

  const getLimitStatus = (current: number, feature: 'max_cars') => {
    const limit = permissions[feature];
    return {
      current,
      limit,
      isExceeded: current >= limit,
      percentage: Math.min((current / limit) * 100, 100),
    };
  };

  return {
    currentPlan,
    permissions,
    checkPermission,
    getLimitStatus,
    PLAN_NAMES_AR,
  };
};

interface PlanGuardProps {
  feature?: keyof PlanPermissions;
  planRequired?: PlanLevel;
  children: ReactNode;
  fallback?: ReactNode;
}

export const PlanGuard: React.FC<PlanGuardProps> = ({ 
  feature, 
  planRequired, 
  children, 
  fallback 
}) => {
  const { currentPlan, checkPermission } = usePlanPermissions();

  let isAllowed = true;

  if (feature) {
    isAllowed = !!checkPermission(feature);
  }

  if (planRequired && isAllowed) {
    const planLevels: PlanLevel[] = ['free', 'basic', 'pro', 'enterprise'];
    const currentIdx = planLevels.indexOf(currentPlan);
    const requiredIdx = planLevels.indexOf(planRequired);
    isAllowed = currentIdx >= requiredIdx;
  }

  if (!isAllowed) {
    if (fallback) return <>{fallback}</>;
    
    return (
      <div className="relative group">
        <div className="opacity-50 pointer-events-none">
          {children}
        </div>
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] rounded-xl flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl text-center max-w-xs border border-amber-200 dark:border-amber-900/30">
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m11 3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">
              {planRequired ? `ميزة باقة ${PLAN_NAMES_AR[planRequired]}` : 'ميزة مقيدة'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              يرجى ترقية اشتراكك للوصول إلى هذه الميزة المتقدمة
            </p>
            <button className="w-full bg-slate-800 dark:bg-slate-700 text-white font-bold py-2 rounded-xl text-sm transition hover:bg-slate-700">
              عرض الباقات
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default usePlanPermissions;

