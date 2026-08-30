/**
 * 🛡️ Permission Toggle Component with Plan Enforcement
 *
 * مكون تحكم في الصلاحيات مع مراعاة حدود الباقة
 * - يمنع تفعيل صلاحية غير موجودة في الباقة
 * - يعرض مؤشراً بصرياً للصلاحيات المغلقة
 * - يسمح بتقليل الصلاحيات فقط (لا زيادة)
 *
 * Created: 2026-02-09
 */

import React from 'react';
import { Lock, Crown, Info } from 'lucide-react';
import type { UserPermissions } from '../types';
import { PLAN_NAMES_AR } from '../lib/planPermissionGuard';

interface PermissionToggleProps {
  label: string;
  module: keyof UserPermissions;
  action: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  planId?: string;
  maxPermissions?: UserPermissions;
}

/**
 * زر تحكم واحد في صلاحية مع مراعاة حدود الباقة
 */
export function PermissionToggle({
  label,
  module,
  action,
  checked,
  onChange,
  disabled = false,
  planId,
  maxPermissions
}: PermissionToggleProps) {
  // التحقق من أن الصلاحية مسموحة في الباقة
  const isAllowedInPlan = maxPermissions?.[module]?.[action] === true;
  const isLocked = !isAllowedInPlan;
  const isDisabled = disabled || isLocked;

  return (
    <label
      className={`flex items-center gap-3 cursor-pointer transition-opacity ${
        isDisabled ? 'opacity-60 cursor-not-allowed' : ''
      }`}
    >
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={isDisabled}
          className={`w-4 h-4 accent-blue-600 rounded ${
            isLocked ? 'opacity-50' : ''
          }`}
        />
        {isLocked && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-slate-700 rounded-full flex items-center justify-center">
            <Lock className="w-2 h-2 text-slate-300" />
          </div>
        )}
      </div>
      <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
      {isLocked && (
        <Info
          className="w-4 h-4 text-amber-500"
          aria-label={`غير متاح في باقة ${planId ? PLAN_NAMES_AR[planId as keyof typeof PLAN_NAMES_AR] : 'الحالية'}`}
        />
      )}
    </label>
  );
}

/**
 * مجموعة صلاحيات لوحدة كاملة
 */
interface PermissionModuleProps {
  title: string;
  icon: string;
  module: keyof UserPermissions;
  permissions: Record<string, boolean>;
  onToggle: (action: string) => void;
  disabled?: boolean;
  planId?: string;
  maxPermissions?: UserPermissions;
  labels: Record<string, string>;
}

export function PermissionModule({
  title,
  icon,
  module,
  permissions,
  onToggle,
  disabled = false,
  planId,
  maxPermissions,
  labels
}: PermissionModuleProps) {
  // التحقق من أن الوحدة مسموحة في الباقة
  const isModuleAllowed = maxPermissions?.[module];
  const hasAnyAllowedPermission = isModuleAllowed
    ? Object.values(isModuleAllowed).some(v => v === true)
    : false;

  return (
    <div
      className={`bg-slate-50 dark:bg-[#1e293b] p-4 rounded-xl border transition-all ${
        hasAnyAllowedPermission
          ? 'border-gray-200 dark:border-slate-700'
          : 'border-amber-200 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-900/10'
      }`}
    >
      <div className="flex items-center justify-between mb-3 border-b border-gray-200 dark:border-slate-700 pb-2">
        <div className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <span>{icon}</span>
          <span>{title}</span>
        </div>
        {!hasAnyAllowedPermission && (
          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <Lock className="w-3 h-3" />
            غير متاح
          </span>
        )}
      </div>
      <div className="space-y-3">
        {Object.entries(labels).map(([key, label]) => (
          <PermissionToggle
            key={key}
            label={label}
            module={module}
            action={key}
            checked={permissions[key] || false}
            onChange={() => onToggle(key)}
            disabled={disabled}
            planId={planId}
            maxPermissions={maxPermissions}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * شريط معلومات الباقة
 */
interface PlanInfoBarProps {
  planId: string;
  maxPermissions: UserPermissions;
}

export function PlanInfoBar({ planId, maxPermissions }: PlanInfoBarProps) {
  const planName = PLAN_NAMES_AR[planId as keyof typeof PLAN_NAMES_AR] || planId;

  // حساب الصلاحيات المتاحة
  const availableModules = Object.entries(maxPermissions)
    .filter(([_, perms]) => Object.values(perms ?? {}).some(v => v === true))
    .map(([module]) => module)
    .length;

  const totalModules = Object.keys(maxPermissions).length;

  return (
    <div className="mb-6 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-200 dark:border-blue-900/30 rounded-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg">
            <Crown className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-slate-800 dark:text-white">
              باقة {planName}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {availableModules} من {totalModules} وحدات متاحة
            </div>
          </div>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
            <span>متاح في الباقة</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-3 h-3 bg-slate-300 dark:bg-slate-600 rounded-full"></div>
            <span>غير متاح</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * رسالة تحذير عند تجاوز الصلاحيات
 */
interface PermissionWarningProps {
  violations: string[];
  onFix?: () => void;
}

export function PermissionWarning({ violations, onFix }: PermissionWarningProps) {
  if (violations.length === 0) return null;

  return (
    <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <Lock className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <div className="font-bold text-amber-200 mb-1">
            تنبيه: صلاحيات تتجاوز حدود الباقة
          </div>
          <div className="text-sm text-amber-300/80 mb-3">
            المستخدم لديه صلاحيات غير متاحة في الباقة الحالية. سيتم إزالتها
            تلقائياً عند الحفظ.
          </div>
          <ul className="text-xs text-amber-200/60 space-y-1 mb-3">
            {violations.map((v, i) => (
              <li key={i}>• {v}</li>
            ))}
          </ul>
          {onFix && (
            <button
              onClick={onFix}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-bold transition"
            >
              إصلاح تلقائي
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * ملخص الصلاحيات بالأرقام
 */
interface PermissionSummaryProps {
  userPermissions: UserPermissions;
  maxPermissions: UserPermissions;
}

export function PermissionSummary({
  userPermissions,
  maxPermissions
}: PermissionSummaryProps) {
  // حساب النسب
  let userEnabled = 0;
  let userTotal = 0;
  let planEnabled = 0;
  let planTotal = 0;

  Object.entries(maxPermissions).forEach(([module, perms]) => {
    Object.entries(perms ?? {}).forEach(([action, allowed]) => {
      planTotal++;
      if (allowed) planEnabled++;

      userTotal++;
      if (userPermissions[module]?.[action]) userEnabled++;
    });
  });

  const usagePercentage = planTotal > 0 ? (userEnabled / planEnabled) * 100 : 0;

  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      <div className="bg-slate-50 dark:bg-[#1e293b] p-4 rounded-xl border border-gray-200 dark:border-slate-700 text-center">
        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
          {userEnabled}/{userTotal}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          صلاحيات مفعلة
        </div>
      </div>
      <div className="bg-slate-50 dark:bg-[#1e293b] p-4 rounded-xl border border-gray-200 dark:border-slate-700 text-center">
        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
          {Math.round(usagePercentage)}%
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          استخدام الباقة
        </div>
      </div>
      <div className="bg-slate-50 dark:bg-[#1e293b] p-4 rounded-xl border border-gray-200 dark:border-slate-700 text-center">
        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
          {planEnabled}/{planTotal}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          صلاحيات الباقة
        </div>
      </div>
    </div>
  );
}

export default PermissionToggle;
