
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
      const features = plan.features as Record<string, any>;
      if (features[module] === false) return false;
    }
    return true;
  };

  const checkUserPermissions = (module: keyof UserPermissions, action?: string): boolean => {
    if (!userProfile?.permissions) return false;
    const mod = (userProfile.permissions as Record<string, any>)[module];
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
    { id: 'dashboard', label: 'الرئيسية', icon: Home, path: '/dashboard', show: true },
    { id: 'inventory', label: 'السيارات والحركات', icon: Car, path: '/inventory', show: can('inventory') },
    { id: 'calculator', label: 'حاسبة الرحلات', icon: Calculator, path: '/calculator', show: true },
    { id: 'team', label: 'فريق العمل', icon: Users, path: '/team', show: can('team') },
    { id: 'assets', label: 'الأصول', icon: Database, path: '/assets', show: can('assets') },
    { id: 'subscription', label: 'ترقية الباقة', icon: Crown, path: '/subscription', show: true },
    { id: 'settings', label: 'الإعدادات', icon: Settings, path: '/settings', show: true },
  ];

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
          {/* Super Admin Link - Visible for Super Admin and Owners */}
          {(userProfile?.role === 'super_admin' || userProfile?.role === 'owner') && (
            <Link to="/admin" className="flex items-center gap-2 text-purple-500 hover:text-purple-400 mb-4 px-2 text-xs font-bold bg-purple-500/10 p-2 rounded-lg">
              <Crown className="w-3 h-3" /> لوحة الإدارة العليا
            </Link>
          )}

          {/* User Profile Mini Card */}
          <div className="bg-slate-50 dark:bg-slate-800_ p-3 rounded-xl border border-gray-100 dark:border-slate-700">
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

          {/* Mobile Super Admin Shortcut - ALWAYS VISIBLE FOR OWNERS */}
          {(userProfile?.role === 'super_admin' || userProfile?.role === 'owner') && (
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

      {/* BLOCKING TRIAL EXPIRATION MODAL */ }
  {
    org?.subscription_plan === 'trial' && isExpired && (
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
    )
  }
    </div >
  );
};

export default Layout;
