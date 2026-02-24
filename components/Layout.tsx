
import React, { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate, Outlet } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import {
  Car, Home, Users, Settings, LogOut,
  ShieldCheck, Calculator, Crown, Sun, Moon, AlertTriangle, Lock, ArrowRight,
  Wifi, WifiOff, Database, ChevronLeft, Menu, DollarSign, Wrench
} from 'lucide-react';
import { seedLocalDB, syncData } from '../lib/syncManager';
import { Profile, Organization, UserPermissions, SystemConfig } from '../types';
import { db } from '../lib/db';
import { useTheme } from '../components/ThemeProvider';
import { performGlobalLogout, isLogoutInProgress } from '../lib/authUtils';
import { checkPermission as checkPlanPermission } from '../lib/planPermissionGuard';

export interface LayoutContextType {
  user: Profile | null;
  org: Organization | null;
  isExpired: boolean;
  isReadOnly: boolean;
  systemConfig: SystemConfig | null;
  refreshProfile: () => Promise<void>;
}

const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isDarkMode = theme === 'dark';

  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncData(); // Restore syncData logic
    };
    const handleOffline = () => setIsOnline(false);

    // ====================================================================
    // SECURITY: Refresh session when tab becomes visible
    // Catches auth changes that occurred while tab was hidden:
    // - User signed out in another tab
    // - Account was disabled by admin
    // - Session expired
    // ====================================================================
    const validateAndRefreshSession = async () => {
      try {
        // Check current session with Supabase
        const { data: { session } } = await supabase.auth.getSession();

        if (session && session.user) {
          // Session exists - verify with server
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, role, org_id, status, full_name, email, username, permissions')
            .eq('id', session.user.id)
            .maybeSingle();

          // SECURITY: Check if account is disabled
          if (!profile || profile.status === 'disabled') {
            console.warn('⛔ Account is disabled, forcing logout');
            await handleLogout();
            return;
          }

          // Session is valid - update local state
          console.log('✅ Session validated, updating profile data');
          setUserProfile(profile);

          if (profile.org_id) {
            const { data: orgData } = await supabase
              .from('organizations')
              .select('*')
              .eq('id', profile.org_id)
              .maybeSingle();

            setOrg(orgData);

            // Update cache with fresh data
            if (orgData) {
              localStorage.setItem('securefleet_session', JSON.stringify(profile));
              localStorage.setItem('securefleet_session_ts', Date.now().toString());
            }
          } else {
            setOrg(null);
          }
        } else {
          // No session - user was signed out while tab was hidden
          console.warn('⚠️ No session found, forcing logout');
          await handleLogout();
        }
      } catch (error) {
        console.error('❌ Session refresh failed:', error);
        // On error, for safety, redirect to login
        if (!userProfile) {
          navigate('/login');
        }
      }
    };

    const handleVisibilityChange = async () => {
      // Only refresh when tab BECOMES visible (not when hidden)
      if (!document.hidden && navigator.onLine && !isLogoutInProgress()) {
        console.log('📱 Tab became visible, refreshing session...');
        await validateAndRefreshSession();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    fetchUserData();
    fetchSystemConfig();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Sync Local DB when Org and Online state changes
  useEffect(() => {
    if (org?.id && isOnline) {
      seedLocalDB(org.id); // Restore seedLocalDB logic
    }
  }, [org?.id, isOnline]);

  const fetchSystemConfig = async () => {
    const { data } = await supabase.from('public_config').select('*').single();
    if (data) setSystemConfig(data);
  };

  const fetchUserDataOnline = async (userId: string) => {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      console.error("Profile Fetch Error", error);
      return;
    }

    if (profile.status === 'disabled') {
      // Use centralized logout for disabled account
      performGlobalLogout({ reason: 'account_disabled' });
      return;
    }

    if (profile.org_id) {
      const { data: orgData } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', profile.org_id)
        .single();

      setOrg(orgData);

      if (orgData) {
        localStorage.setItem('securefleet_session', JSON.stringify(profile));
      }
    } else {
      setOrg(null);
    }
    setUserProfile(profile);
  };

  const fetchUserData = async () => {
    try {
      const cachedSession = localStorage.getItem('securefleet_session');
      if (cachedSession) {
        setUserProfile(JSON.parse(cachedSession));
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await fetchUserDataOnline(session.user.id);
      } else {
        if (!navigator.onLine) {
          const sessions = await db.sessions.toArray();
          if (sessions.length > 0) {
            setUserProfile(sessions[0].profile);
            setOrg(sessions[0].org || null);
          }
        } else {
          navigate('/login');
        }
      }
    } catch (e) {
      console.error("Auth Load Error", e);
      if (!userProfile) navigate('/login');
    }
  };

  // ====================================================================
  // SECURITY: Logout Handler - Uses Centralized Auth Utility
  // ====================================================================
  const handleLogout = async () => {
    // SECURITY: Prevent redundant logout calls
    if (isLogoutInProgress()) return;

    // Clear in-memory state first (component-specific)
    setUserProfile(null);
    setOrg(null);
    setSystemConfig(null);

    // Call centralized global logout function
    await performGlobalLogout({ reason: 'user_initiated' });
  };

  // Date Logic
  const today = new Date();
  const endDate = org?.subscription_end ? new Date(org.subscription_end) : new Date();
  const manualExtensionEnd = org?.manual_extension_end ? new Date(org.manual_extension_end) : null;
  const effectiveEndDate = (manualExtensionEnd && manualExtensionEnd > endDate) ? manualExtensionEnd : endDate;

  const daysDiff = Math.ceil((effectiveEndDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
  const daysLeft = org ? daysDiff : 999;

  const graceDays = systemConfig?.grace_period_days ?? 7;
  const isExpired = org ? daysLeft < 0 : false;

  // 🔒 تحديد ما إذا كان النظام محظوراً تماماً
  // يتم الحظر إذا:
  // 1. تجاوز المستخدم فترة السماح (daysLeft < -graceDays)
  // 2. أو تم تعطيل المنظمة يدوياً (is_active === false)
  // 3. يستثنى المدير العام (super_admin) من الحظر لضمان قدرته على الإدارة
  const isFullyBlocked = org
    ? (daysLeft < -graceDays || org.is_active === false) && userProfile?.role !== 'super_admin'
    : false;

  const isInGracePeriod = isExpired && !isFullyBlocked;
  const daysInGraceLeft = graceDays + daysLeft;
  const isNearExpiry = org ? (daysLeft >= 0 && daysLeft <= 3) : false;
  const isReadOnly = isFullyBlocked;

  const checkPlanLimits = (module: keyof UserPermissions): boolean => {
    if (!org || !systemConfig?.available_plans) return true;
    const plan = systemConfig.available_plans.find(p => p.id === org.subscription_plan)
      || systemConfig.available_plans.find(p => p.id === 'trial');

    if (plan?.features) {
      const feature = plan.features[module];
      if (typeof feature === 'boolean' && feature === false) return false;
    }
    return true;
  };

  const checkUserPermissions = (module: keyof UserPermissions, action?: string): boolean => {
    if (!userProfile?.permissions) return false;
    const mod = userProfile.permissions[module];
    if (typeof mod === 'object' && mod !== null) {
      if (action) return (mod as Record<string, boolean>)[action] === true;
      return (mod as Record<string, boolean>).view === true;
    }
    return false;
  };

  const can = (module: keyof UserPermissions, action?: string) => {
    if (isFullyBlocked) return false;
    if (isInGracePeriod) {
      const allowedInGrace = systemConfig?.grace_period_allowed_modules || ['inventory'];
      if (!allowedInGrace.includes(module)) return false;
    }

    // ✅ استخدام planPermissionGuard للتحقق من حدود الباقة
    const planId = org?.subscription_plan || 'trial';
    if (!checkPlanPermission(userProfile?.permissions || {} as any, planId, module, action)) {
      return false;
    }

    return checkUserPermissions(module, action);
  };

  const navItems = [
    { id: 'dashboard', label: 'الرئيسية', icon: Home, path: '/dashboard', show: true },
    { id: 'inventory', label: 'السيارات والحركات', icon: Car, path: '/inventory', show: can('inventory') },
    { id: 'finance', label: 'الإدارة المالية', icon: DollarSign, path: '/financials', show: can('finance') },
    { id: 'calculator', label: 'حاسبة الرحلات', icon: Calculator, path: '/calculator', show: true },
    { id: 'maintenance', label: 'الصيانة الدورية', icon: Wrench, path: '/maintenance', show: can('inventory', 'manage_status') },
    { id: 'team', label: 'فريق العمل', icon: Users, path: '/team', show: can('team') },
    { id: 'assets', label: 'الأصول', icon: Database, path: '/assets', show: can('assets') },
    { id: 'subscription', label: 'ترقية الباقة', icon: Crown, path: '/subscription', show: true },
    { id: 'settings', label: 'الإعدادات', icon: Settings, path: '/settings', show: true },
    { id: 'super_admin', label: 'لوحة الإدارة الشاملة', icon: Crown, path: '/admin', show: userProfile?.role === 'super_admin' },
  ];

  const contextValue: LayoutContextType = {
    user: userProfile,
    org,
    isExpired,
    isReadOnly,
    systemConfig,
    refreshProfile: async () => {
      if (userProfile?.id) await fetchUserDataOnline(userProfile.id);
    }
  };

  return (
    <div className="flex h-screen bg-white dark:bg-[#0f172a] font-[Cairo]" dir="rtl">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 border-l border-gray-100 dark:border-slate-800 bg-white dark:bg-[#1e293b]">
        {/* Logo Area */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-gray-100 dark:border-slate-800">
          <div className="bg-blue-600 p-1.5 rounded-lg">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg text-slate-900 dark:text-white">MyFleet Pro</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navItems.filter(item => item.show).map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
              >
                <Icon className={`w-5 h-5 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} />
                <span className="font-medium text-sm">{item.label}</span>
                {isActive && <ChevronLeft className="w-4 h-4 mr-auto opacity-50" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100 dark:border-slate-800">
          {/* User Profile Mini Card */}
          <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-gray-100 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
                {userProfile?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {userProfile?.full_name || 'مستخدم'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {userProfile?.email}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 py-1.5 rounded-lg text-xs font-bold transition"
            >
              <LogOut className="w-3 h-3" /> تسجيل خروج
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50 dark:bg-[#0f172a]">
        {/* Mobile Header */}
        <header className="lg:hidden h-16 bg-white dark:bg-[#1e293b] border-b border-gray-100 dark:border-slate-800 flex items-center justify-between px-4 sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileMenuOpen(true)} className="p-2 -mr-2 text-slate-600 dark:text-slate-300">
              <Menu className="w-6 h-6" />
            </button>
            <span className="font-bold text-lg text-slate-900 dark:text-white">MyFleet</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">
              {isOnline ? (
                <><Wifi className="w-3 h-3 text-emerald-500" /> <span className="text-emerald-500">متصل</span></>
              ) : (
                <><WifiOff className="w-3 h-3 text-red-500" /> <span className="text-red-500">أوفلاين</span></>
              )}
            </div>

            {/* Mobile Super Admin Shortcut - ONLY FOR SUPER ADMINS */}
            {userProfile?.role === 'super_admin' && (
              <Link to="/admin" className="p-2 rounded-full bg-purple-600 text-white shadow-lg shadow-purple-500/30 border border-purple-400 animate-pulse">
                <Crown className="w-5 h-5" />
              </Link>
            )}

            <button onClick={toggleTheme} className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 active:scale-95 transition">
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={handleLogout} className="p-2 active:scale-95 transition"><LogOut className="w-5 h-5 text-red-500" /></button>
          </div>
        </header>

        {/* Global Alerts (Blocking Mode, Grace Period etc) */}
        {isFullyBlocked && (
          <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[100] flex flex-col items-center justify-center text-center p-6 space-y-6 animate-in fade-in duration-500">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-10 h-10 text-red-500 animate-pulse" />
            </div>
            <h2 className="text-3xl font-bold text-white uppercase tracking-tight">نظام معطل تماماً</h2>
            <p className="text-slate-400 max-w-md text-lg">
              عذراً، الوصول للنظام معطل حالياً لهذه المنظمة. قد يكون ذلك بسبب انتهاء فترة السماح أو تم تعطيل الحساب من قبل الإدارة.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs">
              <a
                href={`https://wa.me/${systemConfig?.whatsapp_number || '201066284516'}?text=السلام عليكم، أرغب في تجديد الاشتراك لمركز: ${org?.name} (معرف: ${org?.id})`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition"
              >
                <Wifi className="w-5 h-5" /> تحدث معنا للتجديد
              </a>
              <button
                onClick={handleLogout}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition"
              >
                <LogOut className="w-5 h-5" /> تسجيل الخروج
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-4">معرف الوكالة: {org?.id}</p>
          </div>
        )}
        {!isFullyBlocked && isInGracePeriod && (
          <div className="bg-red-600 text-white px-4 py-3 text-sm font-bold flex items-center justify-center gap-2 shadow-md z-30 animate-in slide-in-from-top-full print:hidden">
            <AlertTriangle className="w-4 h-4" />
            <span>فترة سماح (صلاحيات محدودة): اشتراكك منتهٍ. سيتوقف النظام تماماً خلال {daysInGraceLeft} أيام.</span>
          </div>
        )}
        {!isFullyBlocked && !isInGracePeriod && !isExpired && isNearExpiry && systemConfig?.show_subscription_banner !== false && (
          <div className="bg-orange-500 text-white px-4 py-2 text-sm font-bold flex items-center justify-center gap-2 shadow-md z-30 print:hidden">
            <AlertTriangle className="w-4 h-4" />
            <span>تنبيه: اشتراكك سينتهي خلال {daysLeft} يوم.</span>
          </div>
        )}

        <div className="flex-1 overflow-auto p-4 lg:p-6 print:p-0">
          <Outlet context={contextValue} />
        </div>

        {/* Mobile Bottom Nav */}
        <div className="lg:hidden bg-white dark:bg-[#1e293b] border-t border-gray-100 dark:border-slate-800 flex justify-around p-2 pb-safe sticky bottom-0 z-20">
          {navItems.slice(0, 5).map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            if (!item.show) return null;
            return (
              <Link
                key={item.id}
                to={item.path}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}
              >
                <Icon className={`w-6 h-6 ${isActive ? 'fill-current' : ''}`} />
                <span className="text-[10px] font-bold">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Mobile Slide-over Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative bg-white dark:bg-[#1e293b] w-72 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center">
              <span className="font-bold text-lg text-slate-900 dark:text-white">القائمة</span>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <ChevronLeft className="w-5 h-5 rotate-180" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-4 space-y-2">
              {navItems.filter(item => item.show).map(item => (
                <Link
                  key={item.id}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-bold"
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Unified Block Modal for Trials and Legacy Blocking */}
      {
        org?.subscription_plan === 'trial' && isExpired && !isFullyBlocked && (
          <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#1e293b] w-full max-w-md p-8 rounded-3xl shadow-2xl text-center border border-slate-700 animate-in zoom-in-95 duration-300">
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Lock className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">انتهت الفترة التجريبية</h2>
              <p className="text-slate-500 dark:text-slate-400 mb-8">
                أمل أن تكون قد استمتعت بتجربة النظام. لمتابعة استخدام النظام والاحتفاظ ببياناتك، يرجى ترقية باقتك الآن.
              </p>

              <a
                href={`https://wa.me/${systemConfig?.whatsapp_number || '201066284516'}?text=السلام عليكم، انتهت الفترة التجريبية لمنظمة ${org?.name} وارغب في الاشتراك في الباقة المدفوعة`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl transition-all hover:scale-[1.02] shadow-lg shadow-emerald-500/20"
              >
                <span>تواصل معنا للتفعيل</span>
                <ArrowRight className="w-5 h-5 rtl:rotate-180" />
              </a>

              <p className="text-xs text-slate-500 mt-6">
                معرف الوكالة: <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">{org.id}</span>
              </p>
            </div>
          </div>
        )
      }
    </div>
  );
};

export default Layout;
