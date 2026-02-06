
import React, { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate, Outlet } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import {
  Car, Home, Users, Settings as SettingsIcon, LogOut,
  ShieldCheck, Calculator, Crown, Sun, Moon, AlertTriangle, Lock, ArrowRight,
  Wifi, WifiOff, Database
} from 'lucide-react';
import { seedLocalDB, syncData } from '../lib/syncManager';
import { Profile, Organization, UserPermissions, SystemConfig } from '../types';
import { db } from '../lib/db';

// Context Interface for Child Components
export interface LayoutContextType {
  user: Profile | null;
  org: Organization | null;
  isExpired: boolean;
  isReadOnly: boolean;
  systemConfig: SystemConfig | null;
  refreshProfile: () => Promise<void>;
}

import { useTheme } from '../components/ThemeProvider';

const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme(); // Use Global Theme
  const isDarkMode = theme === 'dark'; // Computed for backward compatibility
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  // Unused loading variable removed
  // Removed local isDarkMode state
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Security: Logout Helper
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      await db.sessions.clear(); // Important: Clear local sessions on logout
    } catch (e) {
      console.warn("Logout error", e);
      // Proceed even if signOut fails to ensure redirection
    }
    localStorage.removeItem('securefleet_session');
    navigate('/login');
  };

  useEffect(() => {
    // 0. Fetch System Config (Online Only)
    const fetchConfig = async () => {
      if (!navigator.onLine) return;
      const { data: configData } = await supabase.from('public_config').select().single();
      if (configData) setSystemConfig(configData);
    };
    fetchConfig();

    if (navigator.onLine) {
      // Realtime Subscription
      const configSub = supabase
        .channel('public_config_changes')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'public_config' }, (payload) => {
          setSystemConfig(payload.new as SystemConfig);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(configSub);
      };
    }
  }, []);

  const fetchUserDataOnline = async (userId: string) => {
    try {
      const { data: user, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (error || !user || user.status === 'disabled') {
        await handleLogout();
        return;
      }
      setUserProfile(user);

      // Fetch Org
      let orgData = null;
      if (user.org_id) {
        const { data } = await supabase.from('organizations').select('*').eq('id', user.org_id).maybeSingle();
        orgData = data;
        if (orgData) {
          setOrg(orgData);
        }
      }

      // Cache session/profile for offline fallback
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await db.sessions.put({
          id: user.id,
          token: session.access_token,
          role: user.role,
          profile: user,
          org: orgData,
          expires_at: Date.now() + (session.expires_in * 1000)
        });
      }

      // Realtime Subscription fOR Org changes
      if (user.org_id) {
        supabase
          .channel(`org_${user.org_id}`)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'organizations', filter: `id=eq.${user.org_id}` }, (payload) => {
            setOrg(payload.new as Organization);
          })
          .subscribe();
      }

      // Realtime Subscription for Profile Changes
      supabase
        .channel(`profile_${user.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, (payload) => {
          setUserProfile(payload.new as Profile);
        })
        .subscribe();

    } catch (e) {
      console.error("Session Fetch Error", e);
      // Fail silently to allow offline mode to take over if possible
    }
  };

  useEffect(() => {
    const initSession = async () => {
      // 1. Supabase Auth Session Handling
      const { data: { session } } = await supabase.auth.getSession();

      // Check offline session first for speed
      const offlineSession = await db.sessions.toArray();

      if (session) {
        await fetchUserDataOnline(session.user.id);
      } else if (offlineSession.length > 0) {
        // Offline Mode
        const s = offlineSession[0];
        if (s.expires_at > Date.now()) {
          setUserProfile(s.profile);
          setOrg(s.org);
        } else {
          await db.sessions.clear();
          navigate('/login');
        }
      } else {
        navigate('/login');
      }
    };

    initSession();

    // Listener for Auth Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (_event === 'SIGNED_OUT') {
        navigate('/login');
      } else if (session) {
        // Re-fetch only if user changed or was null
        if (!userProfile) fetchUserDataOnline(session.user.id);
      }
    });

    // Theme Logic Removed (Handled globally by ThemeProvider)

    // Online/Offline Listeners
    const handleOnline = () => {
      setIsOnline(true);
      syncData();
    };
    const handleOffline = () => setIsOnline(false);

    globalThis.addEventListener('online', handleOnline);
    globalThis.addEventListener('offline', handleOffline);

    return () => {
      subscription.unsubscribe();
      globalThis.removeEventListener('online', handleOnline);
      globalThis.removeEventListener('offline', handleOffline);
    };
  }, [navigate, userProfile]); // Added userProfile to dependencies for the if (!userProfile) check

  useEffect(() => {
    if (org?.id && isOnline) {
      seedLocalDB(org.id);
    }
  }, [org?.id, isOnline]);

  // toggleTheme is now from Context

  // Calculate expiration logic
  const today = new Date();
  const endDate = org?.subscription_end ? new Date(org.subscription_end) : new Date();
  const manualExtensionEnd = org?.manual_extension_end ? new Date(org.manual_extension_end) : null;

  // Use the furthest date (subscription or manual override)
  const effectiveEndDate = (manualExtensionEnd && manualExtensionEnd > endDate) ? manualExtensionEnd : endDate;

  const daysDiff = Math.ceil((effectiveEndDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
  const daysLeft = org ? daysDiff : 999;

  // Grace Period Logic
  const graceDays = systemConfig?.grace_period_days ?? 7;
  const isExpired = org ? daysLeft < 0 : false;
  const isFullyBlocked = org ? (daysLeft < -graceDays) : false;
  const isInGracePeriod = isExpired && !isFullyBlocked;

  const daysInGraceLeft = graceDays + daysLeft; // e.g. 7 + (-2) = 5 days left in grace
  const isNearExpiry = org ? (daysLeft >= 0 && daysLeft <= 3) : false;

  // Read Only Mode is active if fully blocked
  const isReadOnly = isFullyBlocked;

  // Safe permission check helper
  const checkPlanLimits = (module: keyof UserPermissions): boolean => {
    if (!org || !systemConfig?.available_plans) return true;
    const plan = systemConfig.available_plans.find(p => p.id === org.subscription_plan)
      || systemConfig.available_plans.find(p => p.id === 'trial');

    if (plan?.features) {
      const features = plan.features as any;
      if (features[module] === false) return false;
    }
    return true;
  };

  const checkUserPermissions = (module: keyof UserPermissions, action?: string): boolean => {
    if (!userProfile?.permissions) return false;
    const mod = (userProfile.permissions as any)[module];
    if (action && mod) return mod[action] === true;
    return mod?.view === true;
  };

  const can = (module: keyof UserPermissions, action?: string) => {
    if (isFullyBlocked) return false;

    if (isInGracePeriod) {
      const allowedInGrace = systemConfig?.grace_period_allowed_modules || ['inventory'];
      if (!allowedInGrace.includes(module)) return false;
    }

    if (!checkPlanLimits(module)) return false;
    return checkUserPermissions(module, action);
  };

  const navItems = [
    { label: 'الرئيسية', path: '/dashboard', icon: Home, show: true },
    { label: 'السيارات والحركات', path: '/inventory', icon: Car, show: userProfile && can('inventory') },
    { label: 'حاسبة الرحلات', path: '/calculator', icon: Calculator, show: true },
    { label: 'فريق العمل', path: '/team', icon: Users, show: userProfile && can('team') },
    { label: 'الأصول', path: '/assets', icon: Database, show: userProfile && can('assets') },
    { label: 'ترقية الباقة', path: '/subscription', icon: Crown, show: true },
    { label: 'الإعدادات', path: '/settings', icon: SettingsIcon, show: true },
  ];

  const isActive = (path: string) => location.pathname === path;



  // Context to pass to Outlet
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
    <div className="min-h-screen md:min-h-0 md:h-screen bg-gray-50 dark:bg-slate-900 flex font-[Cairo] overflow-hidden print:overflow-visible print:h-auto transition-colors duration-300">

      {/* ... Sidebar ... */}
      <aside className="w-64 flex-col shadow-xl z-30 hidden md:flex border-l border-gray-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] print:hidden">
        {/* ... existing sidebar content ... */}
        <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <span className="text-slate-800 dark:text-white font-bold text-lg">MyFleet Pro</span>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.filter(item => item.show).map((item) => {
            const active = isActive(item.path);
            return (
              <Link key={item.path} to={item.path} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-bold ${active ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-white'}`}>
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100 dark:border-slate-800">
          {/* Super Admin Link - Always visible for super_admin, or for owners without org */}
          {(userProfile?.role === 'super_admin' || (!userProfile?.org_id && (userProfile?.role === 'owner' || userProfile?.role === 'admin'))) && (
            <Link to="/admin" className="flex items-center gap-2 text-purple-500 hover:text-purple-400 mb-4 px-2 text-xs font-bold bg-purple-500/10 p-2 rounded-lg">
              <Crown className="w-3 h-3" /> لوحة الإدارة العليا
            </Link>
          )}

          <div className="mb-4 px-2">
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${userProfile?.role === 'owner' ? 'bg-purple-500' : 'bg-blue-500'}`}></span>
              <span className="text-xs text-slate-400 uppercase">{userProfile?.role}</span>
            </div>
            <div className="text-sm font-bold text-slate-800 dark:text-white truncate">{userProfile?.full_name}</div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 w-full px-4 py-2 rounded-lg transition font-bold text-sm">
            <LogOut className="w-4 h-4" /> <span>تسجيل خروج</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-[100dvh] md:h-screen overflow-hidden print:overflow-visible print:h-auto relative">

        {/* GLOBAL ALERT BANNERS - HIDDEN ON PRINT */}
        {isFullyBlocked && (
          <div className="bg-slate-900 text-white px-4 py-3 text-sm font-bold flex items-center justify-center gap-2 shadow-md z-[60] fixed inset-x-0 top-0 print:hidden backdrop-blur-md">
            <Lock className="w-5 h-5 text-red-500 animate-pulse" />
            <span>نظام معطل تماماً: انتهت فترة السماح. يرجى التجديد لاستعادة إمكانية الوصول.</span>
            <a href={`https://wa.me/${systemConfig?.whatsapp_number || ''}`} target="_blank" className="bg-blue-600 px-3 py-1 rounded-lg text-xs hover:bg-blue-500 transition">تحدث معنا للتفعيل</a>
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

        {/* Mobile Header - HIDDEN ON PRINT */}
        <header className="sticky top-0 h-16 bg-white/80 dark:bg-[#1e293b]/90 backdrop-blur-md border-b border-gray-200 dark:border-slate-700 md:hidden flex items-center justify-between px-4 z-40 shrink-0 print:hidden transition-all duration-300">
          <span className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            MyFleet Pro
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">
              {isOnline ? (
                <><Wifi className="w-3 h-3 text-emerald-500" /> <span className="text-emerald-500">متصل</span></>
              ) : (
                <><WifiOff className="w-3 h-3 text-red-500" /> <span className="text-red-500">أوفلاين</span></>
              )}
            </div>
            <button onClick={toggleTheme} className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 active:scale-95 transition">
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={handleLogout} className="p-2 active:scale-95 transition"><LogOut className="w-5 h-5 text-red-500" /></button>
          </div>
        </header>

        {/* Desktop Header - HIDDEN ON PRINT */}
        <header className="h-20 bg-gray-50 dark:bg-[#0f172a] hidden md:flex items-center justify-between px-8 z-20 print:hidden">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
            {navItems.find(i => isActive(i.path))?.label || 'لوحة القيادة'}
          </h2>
          <button onClick={toggleTheme} className="p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 hover:text-blue-600 transition shadow-sm">
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8 pb-24 relative print:overflow-visible print:p-0 print:pb-0">
          <Outlet context={contextValue} />
        </div>

        {/* Mobile Bottom Nav - HIDDEN ON PRINT */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-[#0f172a]/90 backdrop-blur-lg border-t border-gray-200 dark:border-slate-800 pb-safe pt-1 px-2 z-50 flex justify-around shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] print:hidden">
          {navItems.filter(item => item.show).slice(0, 5).map((item) => {
            const active = isActive(item.path);
            return (
              <Link key={item.path} to={item.path} className={`relative flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-300 ${active ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                {active && (
                  <span className="absolute -top-1 w-8 h-1 bg-blue-600 rounded-b-full shadow-blue-500/50 shadow-lg"></span>
                )}
                <item.icon className={`w-6 h-6 transition-transform duration-300 ${active ? 'scale-110' : ''}`} />
                <span className={`text-[10px] font-bold transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-80'}`}>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </main>

      {/* BLOCKING TRIAL EXPIRATION MODAL */}
      {org?.subscription_plan === 'trial' && isExpired && (
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
              href={`https://wa.me/${systemConfig?.whatsapp_number || '966500000000'}?text=السلام عليكم، انتهت الفترة التجريبية وارغب في الاشتراك في الباقة المدفوعة`}
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
      )}
    </div>
  );
};

export default Layout;
