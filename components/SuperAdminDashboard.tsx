
// Force Update Trigger v1
import React, { useState, useEffect } from 'react';
import AnalyticsDashboard from './AnalyticsDashboard';
import { UpdateBanner } from './UpdateBanner';

console.log("🚀 Admin Dashboard v8 - Mobile Cards Added - Loaded Successfully! (Check 2026-02-07 00:30)");

import { Profile, Organization, SystemConfig, Plan, AuditLog, UserPermissions, PlanFeatures, DiscountCode, PaymentRequest } from '../types';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Bell, Menu, X, Users, Settings, Plus, Check, Save, Trash2, Eye, EyeOff, Building, Package, CreditCard, Lock, Loader2, Edit, UserPlus, Clock, Car, LayoutDashboard, Sparkles, ChevronLeft, Target, ArrowUpRight, PieChart, Power, UserCheck, UserX, Shield, FileText, AlertCircle, Search, Calendar, Tag, Receipt, CheckCircle2, XCircle, DollarSign, Percent, Image, ExternalLink, Activity } from 'lucide-react';
import WhatsAppSection from './WhatsAppSection';
import HealthMonitorSection from './whatsapp/HealthMonitorSection';

// Types
type OrgTab = 'info' | 'plan' | 'users' | 'permissions' | 'security' | 'whatsapp';

interface DashboardStats {
    totalOrgs: number;
    totalUsers: number;
    totalCars: number;
    activeSubscriptions: number;
    trialOrgs: number;
    proOrgs: number;
    starterOrgs: number;
    expiredOrgs: number;
    disabledOrgs: number;
}

interface OverviewSectionProps {
    stats: DashboardStats;
    loading: boolean;
}

// ==================== SUPER ADMIN DASHBOARD ====================

const getRoleBadgeClass = (role: string) => {
    switch (role) {
        case 'owner': return 'bg-purple-500/10 text-purple-400';
        case 'admin': return 'bg-blue-500/10 text-blue-400';
        default: return 'bg-slate-700 text-slate-400';
    }
};

const SuperAdminDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState<Profile | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [activeSection, setActiveSection] = useState<'overview' | 'users' | 'organizations' | 'announcements' | 'plans' | 'discounts' | 'payments' | 'logs' | 'settings' | 'analytics' | 'whatsapp' | 'health'>('overview');

    // RADICAL FIX: Start with FALSE to force render immediately. No more white screen.
    // Page loading state removed as it was unused and hardcoded to false

    // Data loading: for stats fetching (background)
    const [statsLoading, setStatsLoading] = useState(false);

    // Data states
    const [allOrgs, setAllOrgs] = useState<Organization[]>([]);

    // Stats
    const [stats, setStats] = useState({
        totalOrgs: 0,
        totalUsers: 0,
        totalCars: 0,
        activeSubscriptions: 0,
        trialOrgs: 0,
        proOrgs: 0,
        starterOrgs: 0,
        expiredOrgs: 0,
        disabledOrgs: 0
    });

    const isMounted = React.useRef(true);

    useEffect(() => {
        isMounted.current = true;
        checkAuthAndLoad();
        return () => { isMounted.current = false; };
    }, []);

    const checkAuthAndLoad = async () => {
        try {
            let user: Profile | null = null;
            const sessionStr = localStorage.getItem('securefleet_session');

            if (sessionStr) {
                user = JSON.parse(sessionStr);
            } else {
                // Fallback: Check Supabase directly (Prevent Infinite Redirect Loop)
                const { data: { user: authUser } } = await supabase.auth.getUser();
                if (authUser) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', authUser.id)
                        .single();
                    user = profile;
                }
            }

            if (!user) {
                if (isMounted.current) navigate('/');
                return;
            }

            // Security: Enforce Super Admin Role
            console.log('🔍 Checking Access. User Role:', user.role); // Debug Log

            if (user.role !== 'super_admin' && user.role !== 'admin' && user.role !== 'owner') {
                console.error('⛔ Access Denied. Redirecting... Role is:', user.role);
                if (isMounted.current) navigate('/dashboard');
                return;
            }

            console.log('✅ Access granted to:', user.role);

            if (isMounted.current) {
                setCurrentUser(user);
                // Data fetch starts in background
                fetchStats();
            }
        } catch (error) {
            console.error('Auth Check Error:', error);
            if (isMounted.current) navigate('/');
        }
    };

    const fetchStats = async () => {
        if (!isMounted.current) return;
        setStatsLoading(true);
        try {
            // Optimized: Fetch full orgs data ONCE here to pass down
            const [orgsRes, usersRes, carsRes] = await Promise.all([
                supabase.from('organizations').select('*').order('created_at', { ascending: false }),
                supabase.from('profiles').select('id', { count: 'exact', head: true }),
                supabase.from('cars').select('id', { count: 'exact', head: true })
            ]);

            if (!isMounted.current) return;

            const orgs = orgsRes.data || [];
            if (isMounted.current) setAllOrgs(orgs); // Store full data

            const now = new Date();

            setStats({
                totalOrgs: orgs.length,
                totalUsers: usersRes.count || 0,
                totalCars: carsRes.count || 0,
                activeSubscriptions: orgs.filter(o => o.is_active).length,
                trialOrgs: orgs.filter(o => o.subscription_plan === 'trial').length,
                proOrgs: orgs.filter(o => o.subscription_plan === 'pro').length,
                starterOrgs: orgs.filter(o => o.subscription_plan === 'starter').length,
                expiredOrgs: orgs.filter(o => o.subscription_end && new Date(o.subscription_end) < now).length,
                disabledOrgs: orgs.filter(o => !o.is_active).length
            });
        } catch (err) {
            console.error('Error fetching stats:', err);
        } finally {
            if (isMounted.current) setStatsLoading(false);
        }
    };

    const menuItems = [
        { id: 'overview', label: 'نظرة عامة', icon: LayoutDashboard },
        { id: 'analytics', label: 'التحليلات', icon: PieChart },
        { id: 'organizations', label: 'المنظمات', icon: Building },
        { id: 'announcements', label: 'الإعلانات', icon: Bell },
        { id: 'plans', label: 'الباقات', icon: Package },
        { id: 'discounts', label: 'أكواد الخصم', icon: Tag },
        { id: 'payments', label: 'طلبات الدفع', icon: Receipt },
        { id: 'whatsapp', label: 'واتساب', icon: ExternalLink },
        { id: 'health', label: 'مراقبة النظام', icon: Activity },
        { id: 'logs', label: 'سجل النشاطات', icon: Shield },
        { id: 'settings', label: 'إعدادات النظام', icon: Settings },
    ];


    // Security Flash Fix: Show Skeleton/Loading until user is confirmed
    // Keeps the sidebar visible (Immediate Render) but hides sensitive content
    const isAuthReady = !!currentUser;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex font-[Cairo]" dir="rtl">

            {/* Mobile Overlay - Improved */}
            {mobileMenuOpen && (
                <>
                    <button
                        type="button"
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden w-full h-full cursor-default"
                        onClick={() => setMobileMenuOpen(false)}
                        aria-label="إغلاق القائمة"
                    />
                    {/* Close button outside sidebar for better mobile UX */}
                    <button
                        onClick={() => setMobileMenuOpen(false)}
                        className="fixed top-4 left-4 z-50 p-2 bg-slate-800/90 backdrop-blur-sm rounded-lg lg:hidden"
                    >
                        <X className="w-6 h-6 text-white" />
                    </button>
                </>
            )}

            {/* Sidebar - Improved */}
            <aside className={`
        fixed lg:static inset-y-0 right-0 z-50
        ${sidebarOpen ? 'w-72 lg:w-72' : 'w-20'} 
        ${mobileMenuOpen ? 'translate-x-0 w-72' : 'translate-x-full lg:translate-x-0'}
bg-slate-900/95 backdrop-blur-md border-l border-slate-800/50 shadow-2xl lg:shadow-none
transition-all duration-300 ease-in-out
        flex flex-col
    `}>
                {/* Sidebar Header - Simplified */}
                <div className="p-4 lg:p-5 border-b border-slate-800/50 flex items-center justify-between">
                    {sidebarOpen && (
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                                <Sparkles className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="font-bold text-white text-base">لوحة الإدارة</h2>
                                <span className="text-xs text-slate-400">Super Admin</span>
                            </div>
                        </div>
                    )}

                    {/* Collapse button - Desktop only */}
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="hidden lg:flex p-2.5 hover:bg-slate-800 rounded-lg transition"
                    >
                        <ChevronLeft className={`w-5 h-5 text-slate-400 transition-transform ${sidebarOpen ? '' : 'rotate-180'} `} />
                    </button>

                    {/* Mobile close button - in header */}
                    <button
                        onClick={() => setMobileMenuOpen(false)}
                        className="lg:hidden p-2.5 hover:bg-slate-800/80 rounded-lg transition"
                    >
                        <X className="w-6 h-6 text-slate-300" />
                    </button>
                </div>

                {/* Menu Items - Improved spacing */}
                <nav className="flex-1 p-3 lg:p-4 space-y-1 lg:space-y-1.5 overflow-y-auto">
                    {menuItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => {
                                setActiveSection(item.id as 'overview' | 'users' | 'organizations' | 'announcements' | 'plans' | 'discounts' | 'payments' | 'logs' | 'settings' | 'analytics' | 'whatsapp' | 'health');
                                setMobileMenuOpen(false);
                            }}
                            className={`
w-full flex items-center gap-3 px-3 lg:px-4 py-3 lg:py-3.5 rounded-xl transition-all
                ${activeSection === item.id
                                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30'
                                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                                }
`}
                        >
                            <item.icon className={`w-5 h-5 lg:w-5 lg:h-5 flex-shrink-0 ${activeSection === item.id ? 'text-white' : 'text-slate-400'}`} />
                            {(sidebarOpen || mobileMenuOpen) && <span className="font-medium text-sm lg:text-base">{item.label}</span>}
                        </button>
                    ))}
                </nav>

                {/* Back to Dashboard - Improved */}
                <div className="p-3 lg:p-4 border-t border-slate-800/50">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="w-full flex items-center gap-3 px-3 lg:px-4 py-3 lg:py-3.5 rounded-xl text-slate-400 hover:bg-slate-800/80 hover:text-white transition group"
                    >
                        <ChevronLeft className="w-5 h-5 rotate-180 transition-transform group-hover:-translate-x-1" />
                        {(sidebarOpen || mobileMenuOpen) && <span className="font-medium text-sm lg:text-base">العودة للوحة التحكم</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 min-h-screen overflow-auto">
                {/* Top Bar */}
                <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800 px-4 lg:px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setMobileMenuOpen(true)}
                                className="lg:hidden p-2 hover:bg-slate-800 rounded-lg"
                            >
                                <Menu className="w-6 h-6 text-slate-400" />
                            </button>

                            <div>
                                <h1 className="text-xl lg:text-2xl font-bold text-white">
                                    {menuItems.find(m => m.id === activeSection)?.label}
                                </h1>
                                <p className="text-sm text-slate-400 hidden sm:block">
                                    {currentUser ? `مرحباً، ${currentUser.full_name} ` : '...'}
                                </p>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Content Area */}
                <div className="p-4 lg:p-6">
                    {isAuthReady ? (
                        <>
                            {activeSection === 'overview' && <OverviewSection stats={stats} loading={statsLoading} />}
                            {activeSection === 'analytics' && <AnalyticsDashboard />}
                            {activeSection === 'users' && <UsersSection />}
                            {activeSection === 'organizations' && <OrganizationsSection initialOrgs={allOrgs} onRefresh={fetchStats} />}
                            {activeSection === 'announcements' && <AnnouncementsSection />}
                            {activeSection === 'plans' && <PlansSection />}
                            {activeSection === 'discounts' && <DiscountCodesSection />}
                            {activeSection === 'payments' && <PaymentRequestsSection currentUser={currentUser} />}
                            {activeSection === 'whatsapp' && <WhatsAppSection />}
                            {activeSection === 'health' && <HealthMonitorSection />}
                            {activeSection === 'logs' && <AuditLogsSection />}
                            {activeSection === 'settings' && <SystemSettingsSection />}
                        </>
                    ) : (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-10 h-10 animate-spin text-slate-700" />
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

const OverviewSection: React.FC<OverviewSectionProps> = ({ stats, loading }) => {
    const colorClasses: Record<string, { bg: string; icon: string; text: string; border: string }> = {
        blue: { bg: 'bg-blue-500/10', icon: 'text-blue-500', text: 'text-blue-400', border: 'border-blue-500' },
        emerald: { bg: 'bg-emerald-500/10', icon: 'text-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500' },
        purple: { bg: 'bg-purple-500/10', icon: 'text-purple-500', text: 'text-purple-400', border: 'border-purple-500' },
        orange: { bg: 'bg-orange-500/10', icon: 'text-orange-500', text: 'text-orange-400', border: 'border-orange-500' },
        red: { bg: 'bg-red-500/10', icon: 'text-red-500', text: 'text-red-400', border: 'border-red-500' },
        slate: { bg: 'bg-slate-500/10', icon: 'text-slate-500', text: 'text-slate-400', border: 'border-slate-500' },
    };

    const mainStats = [
        { label: 'إجمالي المنظمات', value: stats.totalOrgs, icon: Building, color: 'blue', trend: '+12%' },
        { label: 'إجمالي المستخدمين', value: stats.totalUsers, icon: Users, color: 'emerald', trend: '+8%' },
        { label: 'إجمالي السيارات', value: stats.totalCars, icon: Target, color: 'purple', trend: '+15%' },
        { label: 'الاشتراكات النشطة', value: stats.activeSubscriptions, icon: CreditCard, color: 'orange', trend: '+5%' },
    ];

    const planStats = [
        { label: 'باقة Pro', value: stats.proOrgs, color: 'blue', icon: '💎' },
        { label: 'باقة Starter', value: stats.starterOrgs, color: 'emerald', icon: '🚀' },
        { label: 'تجريبي (Trial)', value: stats.trialOrgs, color: 'orange', icon: '⏱️' },
        { label: 'منتهية الصلاحية', value: stats.expiredOrgs, color: 'red', icon: '⚠️' },
        { label: 'معطلة', value: stats.disabledOrgs, color: 'slate', icon: '🚫' },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Update Notification Banner */}
            <UpdateBanner />

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {mainStats.map((stat) => (
                    <div
                        key={stat.label}
                        className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition group"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className={`w-12 h-12 ${colorClasses[stat.color]?.bg} rounded-xl flex items-center justify-center group-hover:scale-110 transition`}>
                                <stat.icon className={`w-6 h-6 ${colorClasses[stat.color]?.icon}`} />
                            </div>
                            <div className="flex items-center gap-1 text-emerald-500 text-xs font-bold">
                                <ArrowUpRight className="w-3 h-3" />
                                {stat.trend}
                            </div>
                        </div>
                        <div className="text-3xl font-bold text-white mb-1">
                            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : stat.value}
                        </div>
                        <div className="text-sm text-slate-400">{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Plans Distribution */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <PieChart className="w-5 h-5 text-purple-500" />
                        توزيع الباقات
                    </h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    {planStats.map((stat) => (
                        <div key={stat.label} className={`${colorClasses[stat.color]?.bg} border ${colorClasses[stat.color]?.border} rounded-xl p-4 text-center`}>
                            <div className="text-2xl mb-2">{stat.icon}</div>
                            <div className={`text-2xl font-bold ${colorClasses[stat.color]?.text}`}>{stat.value}</div>
                            <div className="text-xs text-slate-400 mt-1">{stat.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">الإجراءات السريعة</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <button className="flex items-center gap-3 p-4 bg-slate-800/50 hover:bg-slate-800 rounded-xl transition text-right group">
                        <Bell className="w-8 h-8 text-blue-500 group-hover:scale-110 transition" />
                        <div>
                            <div className="font-bold text-white">نشر إعلان</div>
                            <div className="text-xs text-slate-400">إعلام جميع المستخدمين</div>
                        </div>
                    </button>
                    <button className="flex items-center gap-3 p-4 bg-slate-800/50 hover:bg-slate-800 rounded-xl transition text-right group">
                        <Building className="w-8 h-8 text-emerald-500 group-hover:scale-110 transition" />
                        <div>
                            <div className="font-bold text-white">إضافة منظمة</div>
                            <div className="text-xs text-slate-400">تسجيل منظمة جديدة</div>
                        </div>
                    </button>
                    <button className="flex items-center gap-3 p-4 bg-slate-800/50 hover:bg-slate-800 rounded-xl transition text-right group">
                        <Package className="w-8 h-8 text-purple-500 group-hover:scale-110 transition" />
                        <div>
                            <div className="font-bold text-white">إدارة الباقات</div>
                            <div className="text-xs text-slate-400">تعديل خطط الاشتراك</div>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate a secure random secret key for an organization
 * @param orgId - Organization ID
 * @returns Secure secret key in format: sk_live_{orgPart}_{randomPart}
 */
const generateSecretKey = (orgId: string): string => {
  // Remove dashes and take first 12 characters of org ID
  const orgPart = orgId.replaceAll('-', '').substring(0, 12);

  // Generate 16 random bytes (32 hex characters) for the secret part
  const randomPart = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return `sk_live_${orgPart}_${randomPart}`;
};

// ==================== ORGANIZATIONS SECTION ====================

const OrganizationsSection: React.FC<{ initialOrgs: Organization[]; onRefresh: () => void }> = ({ initialOrgs, onRefresh }) => {
    // Props Sync
    const [orgs, setOrgs] = useState<Organization[]>(initialOrgs);
    const [filteredOrgs, setFilteredOrgs] = useState<Organization[]>(initialOrgs);
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;
    // Bulk selection state - reserved for future bulk actions UI
    // const [selectedOrgIds, setSelectedOrgIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        setOrgs(initialOrgs);
        setFilteredOrgs(initialOrgs);
    }, [initialOrgs]);

    type DashboardTab = 'info' | 'plan' | 'users' | 'permissions' | 'security';
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPlan, setFilterPlan] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
    const [selectedOrgTab, setSelectedOrgTab] = useState<DashboardTab>('info');

    useEffect(() => {
        applyFilters();
    }, [orgs, searchTerm, filterPlan, filterStatus]);

    const applyFilters = () => {
        let result = [...orgs];
        if (searchTerm) result = result.filter(o => o.name?.toLowerCase().includes(searchTerm.toLowerCase()));
        if (filterPlan !== 'all') result = result.filter(o => o.subscription_plan === filterPlan);
        if (filterStatus === 'active') result = result.filter(o => o.is_active);
        else if (filterStatus === 'disabled') result = result.filter(o => !o.is_active);
        else if (filterStatus === 'expired') {
            const now = new Date();
            result = result.filter(o => o.subscription_end && new Date(o.subscription_end) < now);
        }
        setFilteredOrgs(result);
        setCurrentPage(1); // Reset to first page when filters change
    };

    // Calculate paginated organizations
    const totalPages = Math.ceil(filteredOrgs.length / ITEMS_PER_PAGE);
    const paginatedOrgs = filteredOrgs.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const handleDelete = async (org: Organization) => {
        if (!confirm('هل أنت متأكد من حذف المنظمة "' + (org.name || '') + '"؟\nلن يتمكن المستخدمون من الوصول إلى حساباتهم.')) return;
        const { error } = await supabase.from('organizations').delete().eq('id', org.id);
        if (error) {
            alert('خطأ: ' + error.message);
        } else {
            setOrgs(orgs.filter(o => o.id !== org.id));
            onRefresh();
        }
    };

    const handleToggleStatus = async (org: Organization) => {
        const newActiveState = !org.is_active;
        const { error } = await supabase.from('organizations').update({ is_active: newActiveState }).eq('id', org.id);
        if (error) {
            alert('خطأ: ' + error.message);
        } else {
            setOrgs(orgs.map(o => o.id === org.id ? { ...o, is_active: newActiveState } : o));
            onRefresh();
        }
    };



    const getPlanBadge = (plan: string) => {
        const plans: Record<string, { bg: string, text: string, label: string }> = {
            pro: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Pro' },
            starter: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Starter' },
            trial: { bg: 'bg-orange-500/10', text: 'text-orange-400', label: 'Trial' },
        };
        const p = plans[plan] || plans.trial;
        return <span className={`px-2 py-1 rounded-full text-xs font-bold ${p.bg} ${p.text} `}>{p.label}</span>;
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            {/* Filters Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row gap-4 justify-between items-center">
                <div className="flex items-center gap-2 w-full lg:w-auto">
                    <div className="relative flex-1 lg:w-64">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="بحث عن منظمة..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pr-9 pl-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:border-blue-500 outline-none"
                        />
                    </div>
                </div>
                <div className="flex items-center gap-2 w-full lg:w-auto">
                    <select
                        value={filterPlan}
                        onChange={e => setFilterPlan(e.target.value)}
                        className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:border-blue-500 outline-none"
                    >
                        <option value="all">كل الباقات</option>
                        <option value="pro">Pro</option>
                        <option value="starter">Starter</option>
                        <option value="trial">Trial</option>
                    </select>
                    <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                        className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:border-blue-500 outline-none"
                    >
                        <option value="all">كل الحالات</option>
                        <option value="active">نشط</option>
                        <option value="disabled">معطل</option>
                        <option value="expired">منتهي</option>
                    </select>
                </div>
            </div>

            {/* Organizations Table (Desktop) */}
            <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-right">
                        <thead className="bg-slate-800/50 text-slate-400 text-xs font-bold uppercase">
                            <tr>
                                <th className="px-6 py-4">المنظمة</th>
                                <th className="px-6 py-4">الباقة</th>
                                <th className="px-6 py-4">الحالة</th>
                                <th className="px-6 py-4">تاريخ البداية</th>
                                <th className="px-6 py-4">تاريخ الانتهاء</th>
                                <th className="px-6 py-4 text-center">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {paginatedOrgs.map((org) => (
                                <tr key={org.id} className="hover:bg-slate-800/50 transition">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center font-bold text-white">
                                                {org.name?.charAt(0) || 'O'}
                                            </div>
                                            <div>
                                                <div className="font-bold text-white text-sm">{org.name}</div>
                                                <div className="text-xs text-slate-500 font-mono">{org.id.substring(0, 8)}...</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {getPlanBadge(org.subscription_plan)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${org.is_active === false
                                            ? 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                            } `}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${org.is_active === false ? 'bg-slate-400' : 'bg-emerald-400'} `} />
                                            {org.is_active === false ? 'معطل' : 'نشط'}
                                        </span>
                                    </td>

                                    <td className="px-6 py-4 text-sm text-slate-300">
                                        {org.subscription_start ? (
                                            <span className="flex items-center gap-1 font-mono text-xs">
                                                {new Date(org.subscription_start).toLocaleDateString('en-CA')}
                                            </span>
                                        ) : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-300">
                                        {org.subscription_end ? (
                                            <span className={`flex items-center gap-1 font-mono text-xs ${new Date(org.subscription_end) < new Date() ? 'text-red-400' : 'text-slate-300'
                                                }`}>
                                                {new Date(org.subscription_end).toLocaleDateString('en-CA')}
                                            </span>
                                        ) : '-'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => setSelectedOrg(org)}
                                                className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition"
                                                title="إدارة كاملة"
                                            >
                                                <Settings className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setSelectedOrgTab('users');
                                                    setSelectedOrg(org);
                                                }}
                                                className="p-2 text-purple-400 hover:bg-purple-500/10 rounded-lg transition"
                                                title="عرض المستخدمين"
                                            >
                                                <Users className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleToggleStatus(org)}
                                                className={`p-2 rounded-lg transition ${org.is_active === false ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-orange-400 hover:bg-orange-500/10'} `}
                                                title={org.is_active === false ? 'تفعيل' : 'تعطيل'}
                                            >
                                                <Power className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(org)}
                                                className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition"
                                                title="حذف نهائي"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {
                    filteredOrgs.length === 0 && (
                        <div className="p-12 text-center text-slate-500">
                            <Building className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>لا توجد بيانات للعرض</p>
                        </div>
                    )
                }
            </div>

            {/* Organizations Cards (Mobile) */}
            <div className="md:hidden space-y-4">
                {paginatedOrgs.map((org) => (
                    <div key={org.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-4">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center font-bold text-white text-lg shadow-lg shadow-blue-900/20">
                                    {org.name?.charAt(0) || 'O'}
                                </div>
                                <div>
                                    <div className="font-bold text-white">{org.name}</div>
                                    <div className="text-xs text-slate-500 font-mono mt-0.5">{org.id.substring(0, 8)}...</div>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                {getPlanBadge(org.subscription_plan)}
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${org.is_active === false
                                    ? 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    } `}>
                                    {org.is_active === false ? 'معطل' : 'نشط'}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/50 p-3 rounded-xl border border-slate-800/50">
                            <div className="text-slate-400">تاريخ البداية:</div>
                            <div className="text-slate-200 text-left font-mono">{org.subscription_start ? new Date(org.subscription_start).toLocaleDateString('en-CA') : '-'}</div>
                            <div className="text-slate-400">تاريخ الانتهاء:</div>
                            <div className={`text-left font-mono ${org.subscription_end && new Date(org.subscription_end) < new Date() ? 'text-red-400' : 'text-slate-200'}`}>
                                {org.subscription_end ? new Date(org.subscription_end).toLocaleDateString('en-CA') : '-'}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                            <button onClick={() => setSelectedOrg(org)} className="flex-1 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition">
                                <Settings className="w-3 h-3" /> إدارة
                            </button>
                            <button onClick={() => { setSelectedOrgTab('users'); setSelectedOrg(org); }} className="flex-1 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition">
                                <Users className="w-3 h-3" /> المستخدمين
                            </button>
                            <button onClick={() => handleToggleStatus(org)} className={`w-9 h-9 flex items-center justify-center rounded-lg transition ${org.is_active === false ? 'bg-emerald-500/10 text-emerald-400' : 'bg-orange-500/10 text-orange-400'}`}>
                                <Power className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(org)} className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}

                {filteredOrgs.length === 0 && (
                    <div className="p-8 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl">
                        <Building className="w-10 h-10 mx-auto mb-3 opacity-20" />
                        <p className="text-sm">لا توجد بيانات للعرض</p>
                    </div>
                )}
            </div>

            {/* Pagination Controls */}
            {filteredOrgs.length > 0 && (
                <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl p-4 mt-4">
                    <div className="text-sm text-slate-400">
                        عرض {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredOrgs.length)} من {filteredOrgs.length}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition"
                        >
                            السابق
                        </button>
                        <span className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-sm font-bold">
                            {currentPage} / {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition"
                        >
                            التالي
                        </button>
                    </div>
                </div>
            )}

            {/* Advanced Organization Management Modal */}
            {
                selectedOrg && (
                    <OrganizationDetailModal
                        org={selectedOrg}
                        initialTab={selectedOrgTab}
                        onClose={() => {
                            setSelectedOrg(null);
                            setSelectedOrgTab('info');
                        }}
                        onUpdate={() => {
                            onRefresh();
                            setSelectedOrg(null);
                            setSelectedOrgTab('info');
                        }}
                    />
                )
            }
        </div>
    );
};

// ==================== ORGANIZATION DETAIL MODAL ====================

const OrganizationDetailModal: React.FC<{ org: Organization; initialTab?: OrgTab; onClose: () => void; onUpdate: () => void }> = ({ org, initialTab = 'info', onClose, onUpdate }) => {
    const [activeTab, setActiveTab] = useState<OrgTab>(initialTab);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState<Organization & { owner_phone?: string }>({ ...org, owner_phone: '' });

    // Owner State
    const [ownerProfile, setOwnerProfile] = useState<Profile | null>(null);

    // Users Tab State
    const [orgUsers, setOrgUsers] = useState<Profile[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    // Add User State
    const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
    const [newUserForm, setNewUserForm] = useState({ fullName: '', email: '', password: '', role: 'staff' });
    const [addingUser, setAddingUser] = useState(false);

    // Password Reset State
    const [resetConfig, setResetConfig] = useState({ userId: '', newPassword: '' });
    const [resettingPass, setResettingPass] = useState(false);

    // Plans State
    const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
    useEffect(() => {
        if (activeTab === 'users' || activeTab === 'security') fetchOrgUsers();
        // Always fetch owner info for the Info tab
        fetchOwnerInfo();
        // Fetch plans if on plan tab
        if (activeTab === 'plan') {
            fetchPlans();
        }
    }, [activeTab]);

    // fetchSystemSession and systemSessionId are no longer needed locally
    // as notifications are now queued and sent by the backend worker.

    // Helper to format phone numbers (Egyptian & International)
    const formatPhoneNumber = (phone: string) => {
        if (!phone) return '';
        // Normalize Arabic/Persian digits
        const arabicMap: Record<string, string> = {'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9',
                                                   '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'};
        const normalized = phone.replaceAll(/[٠-٩۰-۹]/g, d => arabicMap[d]);
        let cleaned = normalized.replaceAll(/\D/g, ''); // Remove all non-digits

        // Egyptian number format: 01xxxxxxxxx -> 201xxxxxxxxx
        if (cleaned.length === 11 && cleaned.startsWith('01')) {
            return '20' + cleaned.substring(1);
        }
        // If it starts with 0 but length is 10 (e.g. 010...), add 2
        if (cleaned.startsWith('20') && cleaned.length === 12) {
            return cleaned;
        }
        return cleaned;
    };

    const fetchPlans = async () => {
        const { data } = await supabase.from('plans').select('*').eq('is_active', true);
        if (data) setAvailablePlans(data);
    };

    const fetchOwnerInfo = async () => {
        const { data } = await supabase.from('profiles').select('*').eq('org_id', org.id).eq('role', 'owner').single();
        if (data) {
            setOwnerProfile(data);
            setFormData(prev => ({ ...prev, owner_phone: data.whatsapp_number || '' }));
        }
    };

    const fetchOrgUsers = async () => {
        setLoadingUsers(true);
        const { data } = await supabase.from('profiles').select('*').eq('org_id', org.id);
        if (data) setOrgUsers(data);
        setLoadingUsers(false);
    };

    const sendSubscriptionNotification = async (opts: {
        oldPlan: string; newPlan: string; oldStatus: boolean; newStatus: boolean;
        ownerName: string; ownerPhone: string; orgName: string; subEnd: string;
    }) => {
        if ((opts.oldPlan === opts.newPlan && opts.oldStatus === opts.newStatus) || !opts.ownerPhone || !ownerProfile) return;

        try {
            const planNameAr = availablePlans.find(p => p.id === opts.newPlan)?.name_ar || opts.newPlan;
            
            let notificationType = '';
            
            // Case 1: Activation
            if (!opts.oldStatus && opts.newStatus) notificationType = 'subscription_activated';
            // Case 2: Deactivation
            else if (opts.oldStatus && !opts.newStatus) notificationType = 'subscription_deactivated';
            // Case 3: Plan Change
            else if (opts.oldPlan !== opts.newPlan) notificationType = 'plan_changed';

            if (!notificationType) return;
            
            const { error } = await supabase.from('whatsapp_notification_queue').insert({
                org_id: org.id,
                user_id: ownerProfile.id,
                phone_number: formatPhoneNumber(opts.ownerPhone),
                notification_type: notificationType,
                status: 'pending',
                variables: {
                    userName: opts.ownerName || 'العميل',
                    orgName: opts.orgName,
                    planName: opts.newPlan,
                    planNameAr: planNameAr,
                    expiryDate: opts.subEnd?.split('T')[0] || ''
                }
            });

            if (error) throw error;

            console.log(`[SuperAdmin] Queued ${notificationType} notification`);
            alert('تم تثبيت التغييرات وإضافة الإشعار لطابور الإرسال بنجاح! 🎉');

        } catch (err) {
            console.error('Failed to queue notification:', err);
            alert('حدث خطأ أثناء إضافة الإشعار للطابور: ' + (err instanceof Error ? err.message : String(err)));
        }
    };

    const handleSave = async () => {
        setSaving(true);

        // 1. Update Organization
        const { error: orgError } = await supabase.from('organizations').update({
            name: formData.name,
            subscription_plan: formData.subscription_plan,
            subscription_start: formData.subscription_start,
            subscription_end: formData.subscription_end,
            manual_extension_end: formData.manual_extension_end || null,
            is_active: formData.is_active,
            settings: formData.settings
        }).eq('id', org.id);

        if (orgError) {
            setSaving(false);
            return alert('خطأ أثناء حفظ المنظمة: ' + orgError.message);
        }

        // 2. Update Owner Profile (only from info tab)
        if (ownerProfile && activeTab === 'info') {
            const updateData: { full_name?: string; whatsapp_number?: string } = {
                full_name: ownerProfile.full_name
            };

            // Only update whatsapp_number if it has changed
            if (formData.owner_phone && formData.owner_phone !== ownerProfile.whatsapp_number) {
                // Check if the phone number already exists for another user
                const { data: existingUser, error: checkError } = await supabase
                    .from('profiles')
                    .select('id, full_name')
                    .eq('whatsapp_number', formData.owner_phone)
                    .single();

                if (existingUser && existingUser.id !== ownerProfile.id) {
                    // Phone number already belongs to another user - skip update
                    console.warn('Phone number already exists for another user:', existingUser.full_name);
                } else if (!checkError || checkError.code === 'PGRST116') {
                    // No existing user found (or not found error), safe to update
                    updateData.whatsapp_number = formData.owner_phone;
                }
            }

            const { error: profileError } = await supabase.from('profiles').update(updateData).eq('id', ownerProfile.id);

            if (profileError) {
                console.error('Error updating owner:', profileError);
                // We don't block success, just warn
                alert('تم حفظ المنظمة ولكن فشل تحديث بيانات المالك: ' + profileError.message);
            }
        }

        // 3. Send WhatsApp Notification
        await sendSubscriptionNotification({
            oldPlan: org.subscription_plan,
            newPlan: formData.subscription_plan,
            oldStatus: org.is_active,
            newStatus: formData.is_active,
            ownerName: ownerProfile?.full_name || 'العميل',
            ownerPhone: formData.owner_phone!,
            orgName: formData.name,
            subEnd: formData.subscription_end || ''
        });

        setSaving(false);
        onUpdate();
    };

    const handleBulkPermissions = async () => {
        if (!confirm('سيتم تطبيق الصلاحيات الافتراضية على جميع مستخدمي هذه المنظمة. هل أنت متأكد؟')) return;
        setSaving(true);
        // Default permissions JSON
        const defaultPerms = {
            dashboard: { view: true },
            inventory: { view: true, add: true, edit: false, delete: false, manage_status: true },
            assets: { view: true, add: false, edit: false, delete: false },
            finance: { view: false, add_income: false, add_expense: true, export: false },
            team: { view: true, manage: false },
            reports: { view: true }
        };

        const { error } = await supabase.from('profiles').update({ permissions: defaultPerms }).eq('org_id', org.id);
        setSaving(false);
        if (error) alert('فشل التحديث الجماعي: ' + error.message);
        else alert('تم تحديث صلاحيات جميع المستخدمين بنجاح ✅');
    };

    const handleUpdateUserRole = async (userId: string, newRole: string) => {
        setLoadingUsers(true);
        const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
        setLoadingUsers(false);
        if (error) {
            alert('فشل تحديث الدور: ' + error.message);
        } else {
            alert('تم تغيير دور المستخدم بنجاح ✅');
            fetchOrgUsers();
        }
    };

    const getAppClient = () => {
        const url = import.meta.env.VITE_SUPABASE_URL || 'https://necqtqhmnmcsjxcxgeff.supabase.co';
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lY3F0cWhtbm1jc2p4Y3hnZWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzODg1NTUsImV4cCI6MjA4NDk2NDU1NX0.vpSOLJbEN1JrASDLiZ1G6-yT_QUZo0JzEDKefKANAaQ';
        return createClient(url, key, { auth: { persistSession: false } });
    };

    const ensureAuthUser = async (client: SupabaseClient) => {
        const { data: authData, error: authError } = await client.auth.signUp({
            email: newUserForm.email,
            password: newUserForm.password,
        });

        if (authError) {
            if (authError.message.includes('already registered')) {
                const { data: loginData, error: loginError } = await client.auth.signInWithPassword({
                    email: newUserForm.email,
                    password: newUserForm.password,
                });
                if (loginError) throw new Error('المستخدم موجود بالفعل وكلمة المرور غير صحيحة');
                return loginData.session?.user.id;
            }
            throw authError;
        }

        // BUG FIX: Case where no error is returned but user object exists with empty identities
        if (authData.user?.identities?.length === 0) {
            const { data: loginData, error: loginError } = await client.auth.signInWithPassword({
                email: newUserForm.email,
                password: newUserForm.password,
            });
            if (loginError) throw new Error('هذا البريد الإلكتروني مسجل مسبقاً بكلمة مرور مختلفة.');
            return loginData.session?.user.id;
        }

        return authData.user?.id;
    };

    const handleDeleteUser = async (userId: string, userName: string | null) => {
        if (!confirm('هل أنت متأكد من تعطيل حساب المستخدم "' + (userName || '') + '"؟\nلن يتمكن من تسجيل الدخول بعد الآن.')) return;

        setLoadingUsers(true);
        // Soft Delete: Just Disable
        const { error } = await supabase.from('profiles').update({ status: 'disabled', org_id: null }).eq('id', userId);

        setLoadingUsers(false);
        if (error) alert('فشل تعطيل المستخدم: ' + error.message);
        else {
            alert('تم تعطيل المستخدم وإزالته من المنظمة بنجاح 🚫');
            fetchOrgUsers();
        }
    };

    const handleAddUser = async () => {
        if (newUserForm.password.length < 6) {
            alert('كلمة المرور يجب أن تكون 6 خانات على الأقل');
            return;
        }
        setAddingUser(true);

        try {
            const tempClient = getAppClient() as unknown as SupabaseClient;
            const userId = await ensureAuthUser(tempClient);
            if (!userId) throw new Error("فشل في إنشاء الحساب (No User ID)");

            const { error: rpcError } = await supabase.rpc('org_create_user', {
                p_user_id: userId,
                p_org_id: org.id,
                p_username: newUserForm.email,
                p_full_name: newUserForm.fullName,
                p_role: newUserForm.role,
                p_permissions: {
                    dashboard: { view: true },
                    inventory: { view: true, add: true, edit: false, delete: false, manage_status: true },
                    finance: { view: false },
                    assets: { view: false },
                    team: { view: false },
                    reports: { view: false }
                }
            });

            if (rpcError) throw rpcError;

            alert('تم إنشاء المستخدم وربطه بالمنظمة بنجاح ✅');
            setNewUserForm({ fullName: '', email: '', password: '', role: 'staff' });
            setIsAddUserModalOpen(false);
            fetchOrgUsers();
        } catch (error: unknown) {
            console.error('Add User Error:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            alert('خطأ أثناء إضافة المستخدم: ' + errorMessage);
        } finally {
            setAddingUser(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-0 md:p-4">
            <div className="bg-slate-900 w-full h-full md:h-auto md:max-h-[85vh] md:max-w-4xl md:rounded-2xl border-0 md:border border-slate-700 flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 relative">

                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">
                            {org.name.charAt(0)}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">{org.name}</h2>
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                                <span className="font-mono">{org.id}</span>
                                <span className="w-1 h-1 bg-slate-600 rounded-full" />
                                <span className={org.is_active ? 'text-emerald-400' : 'text-red-400'}>
                                    {org.is_active ? 'مفعل' : 'معطل'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition">
                        <X className="w-6 h-6 text-slate-400" />
                    </button>
                </div>

                {/* Mobile Tabs Navigation */}
                <div className="md:hidden border-b border-slate-800 bg-slate-950 overflow-x-auto">
                    <div className="flex p-2 gap-2 min-w-max">
                        {[
                            { id: 'info', label: 'المعلومات', icon: Building },
                            { id: 'plan', label: 'الاشتراك', icon: CreditCard },
                            { id: 'users', label: 'المستخدمين', icon: Users },
                            { id: 'permissions', label: 'الصلاحيات', icon: Shield },
                            { id: 'security', label: 'الأمان', icon: Lock },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as OrgTab)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition ${activeTab === tab.id
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                                    }`}
                            >
                                <tab.icon className="w-3.5 h-3.5" />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tabs & Content Wrapper */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Tabs */}
                    <div className="w-64 bg-slate-950 border-l border-slate-800 p-4 space-y-2 hidden md:block overflow-y-auto">
                        {[
                            { id: 'info', label: 'المعلومات الأساسية', icon: Building },
                            { id: 'plan', label: 'الباقة والاشتراك', icon: CreditCard },
                            { id: 'users', label: 'إدارة المستخدمين', icon: Users },
                            { id: 'permissions', label: 'الصلاحيات', icon: Shield },
                            { id: 'security', label: 'الأمان والمفاتيح', icon: Lock },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as 'info' | 'plan' | 'users' | 'permissions' | 'security')}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:bg-slate-800'} `}
                            >
                                <tab.icon className="w-5 h-5" />
                                <span className="font-medium">{tab.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-900 relative">

                        {/* Tab: Info */}
                        {activeTab === 'info' && (
                            <div className="space-y-6 max-w-xl animate-in fade-in">
                                <h3 className="text-lg font-bold text-white mb-4">تعديل بيانات المنظمة</h3>
                                <div>
                                    <label htmlFor="org-name" className="block text-sm font-bold text-slate-400 mb-2">اسم المنظمة</label>
                                    <input
                                        id="org-name"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="owner-name" className="block text-sm font-bold text-slate-400 mb-2">اسم المالك</label>
                                        <input
                                            id="owner-name"
                                            value={ownerProfile?.full_name || ''}
                                            onChange={e => ownerProfile && setOwnerProfile({ ...ownerProfile, full_name: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-blue-500"
                                            placeholder="اسم المالك غير متوفر"
                                            disabled={!ownerProfile}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="owner-phone" className="block text-sm font-bold text-slate-400 mb-2">هاتف المالك</label>
                                        <input
                                            id="owner-phone"
                                            value={formData.owner_phone}
                                            onChange={e => setFormData({ ...formData, owner_phone: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-blue-500"
                                            placeholder="رقم الهاتف..."
                                            disabled={!ownerProfile}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="org-status" className="block text-sm font-bold text-slate-400 mb-2">الحالة</label>
                                    <select
                                        id="org-status"
                                        value={formData.is_active ? 'active' : 'disabled'}
                                        onChange={e => setFormData({ ...formData, is_active: e.target.value === 'active' })}
                                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-blue-500"
                                    >
                                        <option value="active">نشط (Active)</option>
                                        <option value="disabled">معطل (Disabled)</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Tab: Plan */}
                        {activeTab === 'plan' && (
                            <div className="space-y-6 max-w-xl animate-in fade-in">
                                <h3 className="text-lg font-bold text-white mb-4">تحديث الاشتراك</h3>
                                <div>
                                    <label htmlFor="plan-selector" className="block text-sm font-bold text-slate-400 mb-2">نوع الباقة</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                                        {availablePlans.length > 0 ? availablePlans.map(p => (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => {
                                                    // Auto-set dates based on plan duration (defaulting to monthly if not specified/yearly)
                                                    // Check if plan is verified based on id or some other logic, or just let user pick dates.
                                                    // For now, we just select the plan ID. User sets dates manually or we could prompt/auto-set.
                                                    // Let's at least set the updated plan ID.
                                                    setFormData({ ...formData, subscription_plan: p.id });
                                                }}
                                                className={`py-3 px-4 rounded-xl border font-bold text-right transition flex flex-col gap-1 ${formData.subscription_plan === p.id
                                                    ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                                                    : 'border-slate-700 text-slate-400 hover:border-slate-600'} `}
                                            >
                                                <span className="text-white">{p.name_ar}</span>
                                                <span className="text-[10px] opacity-70">{p.price_monthly} ج.م/شهر</span>
                                            </button>
                                        )) : (
                                            <div className="col-span-3 text-center text-slate-500 py-4 border border-dashed border-slate-700 rounded-xl">
                                                جاري تحميل الباقات... أو لا توجد باقات معرفة
                                            </div>
                                        )}
                                        {/* Fallback for hardcoded plans if DB is empty or for legacy support */}
                                        {availablePlans.length === 0 && ['trial', 'starter', 'pro'].map(p => (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, subscription_plan: p })}
                                                className={`py-3 rounded-xl border font-bold capitalize ${formData.subscription_plan === p ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'border-slate-700 text-slate-400'} `}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700 mt-4">
                                    <div>
                                        <label htmlFor="start-date" className="block text-sm text-slate-400 mb-1">تاريخ بداية الاشتراك</label>
                                        <input
                                            id="start-date"
                                            type="date"
                                            value={formData.subscription_start ? new Date(formData.subscription_start).toISOString().split('T')[0] : ''}
                                            onChange={(e) => setFormData({ ...formData, subscription_start: e.target.value })}
                                            className="w-full bg-slate-800 border-slate-700 rounded-lg text-white"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="end-date" className="block text-sm text-slate-400 mb-1">تاريخ نهاية الاشتراك</label>
                                        <input
                                            id="end-date"
                                            type="date"
                                            value={formData.subscription_end ? new Date(formData.subscription_end).toISOString().split('T')[0] : ''}
                                            onChange={(e) => setFormData({ ...formData, subscription_end: e.target.value })}
                                            className="w-full bg-slate-800 border-slate-700 rounded-lg text-white"
                                        />
                                    </div>
                                </div>
                                <div className="pt-4 mt-2">
                                    <label htmlFor="manual-ext-date" className="block text-sm text-purple-400 mb-2 font-bold">تمديد يدوي إضافي (Administrative Override)</label>
                                    <div className="flex items-center gap-3">
                                        <div className="relative flex-1">
                                            <input
                                                id="manual-ext-date"
                                                type="date"
                                                value={formData.manual_extension_end ? new Date(formData.manual_extension_end).toISOString().split('T')[0] : ''}
                                                onChange={(e) => setFormData({ ...formData, manual_extension_end: e.target.value })}
                                                className="w-full bg-slate-800 border border-purple-500/30 rounded-xl p-3 text-white outline-none focus:border-purple-500 transition"
                                            />
                                            <Calendar className="absolute left-3 top-3 w-5 h-5 text-purple-500 pointer-events-none opacity-50" />
                                        </div>
                                        {formData.manual_extension_end && (
                                            <button
                                                onClick={() => setFormData({ ...formData, manual_extension_end: undefined })}
                                                className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition"
                                                title="إزالة التمديد"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-2 italic">ملاحظة: إذا كان هذا التاريخ "أبعد" من تاريخ الاشتراك، سيتم اعتماده كتاريخ النهاية الفعلي.</p>
                                </div>
                            </div>
                        )}

                        {/* Tab: Users */}
                        {activeTab === 'users' && (
                            <div className="animate-in fade-in">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-lg font-bold text-white">مستخدمو المنظمة ({orgUsers.length})</h3>
                                    <button
                                        onClick={() => setIsAddUserModalOpen(true)}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-500 transition"
                                    >
                                        <Plus className="w-4 h-4" /> إضافة مستخدم
                                    </button>
                                </div>
                                {loadingUsers ? (
                                    <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div>
                                ) : (
                                    <div className="space-y-3">
                                        {orgUsers.map(user => (
                                            <div key={user.id} className="flex items-center justify-between p-4 bg-slate-800 rounded-xl border border-slate-700 hover:border-slate-600 transition group">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-slate-300">
                                                        {user.full_name?.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-white">{user.full_name}</div>
                                                        <div className="text-xs text-slate-400">{user.email}</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${getRoleBadgeClass(user.role || 'staff')}`}>
                                                        {user.role}
                                                    </span>
                                                    <div className={`w-2 h-2 rounded-full ${user.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'} `} />

                                                    {/* Actions */}
                                                    <div className="flex items-center gap-1 mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => {
                                                                setNewUserForm({
                                                                    fullName: user.full_name || '',
                                                                    email: user.email || '',
                                                                    password: '', // Update not allowed here usually
                                                                    role: user.role || 'staff'
                                                                });
                                                                // We need a 'editingUserId' state to tackle this properly, 
                                                                // but for now, let's reuse the Add Modal with a tweak or create a simple prompt?
                                                                // BETTER: Quick Prompt for role change
                                                                const newRole = prompt('تغيير الدور إلى (admin/driver/staff/supervisor):', user.role);
                                                                if (newRole && ['admin', 'driver', 'staff', 'supervisor'].includes(newRole)) {
                                                                    handleUpdateUserRole(user.id, newRole);
                                                                }
                                                            }}
                                                            className="p-2 hover:bg-slate-700 rounded-lg text-blue-400"
                                                            title="تعديل الدور"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteUser(user.id, user.full_name)}
                                                            className="p-2 hover:bg-slate-700 rounded-lg text-red-400"
                                                            title="تعطيل/حذف"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {orgUsers.length === 0 && <p className="text-slate-500 text-center py-4">لا يوجد مستخدمين</p>}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tab: Permissions (Feature Overrides) */}
                        {activeTab === 'permissions' && (
                            <div className="space-y-6 animate-in fade-in">
                                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-200 text-sm flex items-start gap-3">
                                    <Shield className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold mb-1">تخصيص الصلاحيات والميزات</p>
                                        <p>هذه الخيارات تتجاوز (Override) إعدادات الباقة الافتراضية. يمكنك تفعيل أو تعطيل وحدات معينة لهذه المنظمة خصيصاً.</p>
                                        {formData.subscription_plan === 'trial' && (
                                            <p className="mt-2 text-emerald-400 font-bold">⚠️ باقة Trial: جميع الميزات مفعلة افتراضياً.</p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="font-bold text-white border-b border-slate-800 pb-2">وحدات النظام</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {[
                                            { k: 'finance', l: 'الإدارة المالية (مصروفات/إيرادات)' },
                                            { k: 'assets', l: 'إدارة الأصول' },
                                            { k: 'inventory', l: 'المخزون وقطع الغيار' },
                                            { k: 'maintenance', l: 'الصيانة الدورية' },
                                            { k: 'team', l: 'إدارة فريق العمل' },
                                            { k: 'reports', l: 'التقارير المتقدمة' },
                                            { k: 'export', l: 'تصدير البيانات (Excel/PDF)' },
                                            { k: 'priority_support', l: 'دعم فني عاجل' },
                                        ].map(item => {
                                            const settings = (formData.settings as { custom_features?: Record<string, boolean> });
                                            const customFeatures = settings?.custom_features || {};
                                            // Feature is enabled IF it's in customFeatures OR if plan is 'trial' (Trial has everything)
                                            const isEnabled = (formData.subscription_plan === 'trial') || !!customFeatures[item.k];

                                            return (
                                                <label key={item.k} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${isEnabled
                                                    ? 'bg-blue-500/10 border-blue-500/50'
                                                    : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                                                    } `}>
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isEnabled ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-400'} `}>
                                                            <Check className={`w-4 h-4 ${isEnabled ? 'opacity-100' : 'opacity-0'} `} />
                                                        </div>
                                                        <span className={isEnabled ? 'text-white font-bold' : 'text-slate-400'}>{item.l}</span>
                                                    </div>
                                                    <input
                                                        aria-label={item.l}
                                                        type="checkbox"
                                                        checked={!!isEnabled}
                                                        disabled={formData.subscription_plan === 'trial'}
                                                        onChange={(e) => {
                                                            const settings = formData.settings as { custom_features?: Record<string, boolean> };
                                                            const currentFeatures = settings?.custom_features || {};
                                                            const newFeatures = { ...currentFeatures };
                                                            newFeatures[item.k] = e.target.checked;
                                                            setFormData({
                                                                ...formData,
                                                                settings: { ...formData.settings, custom_features: newFeatures }
                                                            });
                                                        }}
                                                        className="hidden"
                                                    />
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="mt-8 pt-6 border-t border-slate-800">
                                    <h4 className="font-bold text-white mb-4">أدوات خطرة</h4>
                                    <button
                                        onClick={handleBulkPermissions}
                                        className="w-full py-3 px-4 bg-slate-800 border-2 border-dashed border-slate-700 hover:border-red-500 hover:bg-red-500/5 rounded-xl flex items-center justify-center gap-3 transition group text-slate-400 hover:text-red-400"
                                    >
                                        <AlertCircle className="w-5 h-5" />
                                        <span className="font-bold">إعادة تعيين وتطبيق الصلاحيات الافتراضية للجميع</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Tab: Security */}
                        {activeTab === 'security' && (
                            <div className="space-y-6 animate-in fade-in">
                                <h3 className="text-lg font-bold text-white mb-4">المفاتيح الأمنية (API Keys)</h3>

                                <div className="bg-slate-950 p-6 rounded-xl border border-slate-800">
                                    <label htmlFor="secret-key" className="block text-sm font-bold text-slate-400 mb-2">Organization Secret Key</label>
                                    <div className="flex gap-2">
                                        <code id="secret-key" className="flex-1 bg-black p-3 rounded-lg text-emerald-500 font-mono text-sm break-all">
                                            {generateSecretKey(org.id)}
                                        </code>
                                        <button type="button" className="px-4 bg-slate-800 text-white rounded-lg text-sm font-bold hover:bg-slate-700">
                                            نسخ
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">
                                        * هذا المفتاح يستخدم للربط البرمجي API. لا تشاركه مع أحد.
                                    </p>
                                </div>

                                <div className="bg-slate-950 p-6 rounded-xl border border-slate-800">
                                    <h4 className="font-bold text-white mb-4 border-b border-slate-800 pb-2 flex items-center gap-2">
                                        <Lock className="w-5 h-5 text-orange-400" />
                                        تحديث كلمة المرور
                                    </h4>
                                    <p className="text-sm text-slate-400 mb-4">
                                        يمكنك تغيير كلمة المرور لأي مستخدم في هذه المنظمة. (يتطلب صلاحية Super Admin)
                                    </p>

                                    <div className="space-y-4">
                                        <div>
                                            <label htmlFor="user-reset-select" className="block text-sm font-bold text-slate-400 mb-1">اختر المستخدم</label>
                                            <select
                                                id="user-reset-select"
                                                value={resetConfig.userId}
                                                onChange={e => setResetConfig({ ...resetConfig, userId: e.target.value })}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                                            >
                                                <option value="">-- اختر مستخدماً --</option>
                                                {orgUsers.map(u => (
                                                    <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label htmlFor="new-password" className="block text-sm font-bold text-slate-400 mb-1">كلمة المرور الجديدة</label>
                                            <input
                                                id="new-password"
                                                type="text"
                                                placeholder="أدخل كلمة المرور الجديدة..."
                                                value={resetConfig.newPassword}
                                                onChange={e => setResetConfig({ ...resetConfig, newPassword: e.target.value })}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white font-mono"
                                            />
                                        </div>
                                        <button
                                            onClick={async () => {
                                                if (!resetConfig.userId || resetConfig.newPassword.length < 6) return alert('الرجاء اختيار مستخدم وكلمة مرور (6 خانات على الأقل)');
                                                if (!confirm('هل أنت متأكد من تغيير كلمة المرور لهذا المستخدم؟')) return;

                                                setResettingPass(true);
                                                // Try RPC first
                                                const { error } = await supabase.rpc('admin_reset_password', {
                                                    target_user_id: resetConfig.userId,
                                                    new_password: resetConfig.newPassword
                                                });

                                                if (error) {
                                                    console.error('RPC Error:', error);
                                                    alert('فشل تغيير كلمة المرور. تأكد من أن دالة admin_reset_password موجودة في قاعدة البيانات.\n\nالخطأ: ' + error.message);
                                                } else {
                                                    alert('تم تغيير كلمة المرور بنجاح ✅\n\nقم بنسخ كلمة المرور وإرسالها للمستخدم.');
                                                    setResetConfig({ userId: '', newPassword: '' });
                                                }
                                                setResettingPass(false);
                                            }}
                                            disabled={resettingPass || !resetConfig.userId || resetConfig.newPassword.length < 6}
                                            className="w-full py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold transition flex items-center justify-center gap-2"
                                        >
                                            {resettingPass ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                            تحديث كلمة المرور
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-3 shrink-0">
                    <button onClick={onClose} className="px-6 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700">
                        إغلاق
                    </button>
                    {(activeTab === 'info' || activeTab === 'plan' || activeTab === 'permissions') && (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-500 flex items-center gap-2"
                        >
                            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                            حفظ التغييرات
                        </button>
                    )}
                </div>
            </div>

            {/* Internal Modal: Add User */}
            {
                isAddUserModalOpen && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in">
                        <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-700 p-6 shadow-2xl">
                            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <UserPlus className="w-5 h-5 text-blue-500" />
                                إضافة مستخدم جديد
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="auth-fullname" className="block text-sm font-bold text-slate-400 mb-2">الاسم الكامل</label>
                                    <input
                                        id="auth-fullname"
                                        value={newUserForm.fullName}
                                        onChange={e => setNewUserForm({ ...newUserForm, fullName: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-blue-500"
                                        placeholder="مثال: أحمد محمد"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="auth-email" className="block text-sm font-bold text-slate-400 mb-2">البريد الإلكتروني</label>
                                    <input
                                        id="auth-email"
                                        type="email"
                                        value={newUserForm.email}
                                        onChange={e => setNewUserForm({ ...newUserForm, email: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-blue-500"
                                        placeholder="user@example.com"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="auth-password" className="block text-sm font-bold text-slate-400 mb-2">كلمة المرور</label>
                                    <input
                                        id="auth-password"
                                        type="password"
                                        value={newUserForm.password}
                                        onChange={e => setNewUserForm({ ...newUserForm, password: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-blue-500"
                                        placeholder="******"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="auth-role" className="block text-sm font-bold text-slate-400 mb-2">الدور</label>
                                    <select
                                        id="auth-role"
                                        value={newUserForm.role}
                                        onChange={e => setNewUserForm({ ...newUserForm, role: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-blue-500"
                                    >
                                        <option value="staff">موظف (Staff)</option>
                                        <option value="driver">سائق (Driver)</option>
                                        <option value="admin">مدير (Admin)</option>
                                        <option value="supervisor">مشرف (Supervisor)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-8">
                                <button
                                    onClick={() => setIsAddUserModalOpen(false)}
                                    className="flex-1 py-3 bg-slate-800 text-slate-400 rounded-xl font-bold hover:bg-slate-700 transition"
                                >
                                    إلغاء
                                </button>
                                <button
                                    onClick={handleAddUser}
                                    disabled={addingUser}
                                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 transition flex items-center justify-center gap-2"
                                >
                                    {addingUser ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
                                    إضافة
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
};

// ==================== ANNOUNCEMENTS SECTION ====================

const AnnouncementsSection: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState<SystemConfig | null>(null);
    const [data, setData] = useState({
        title: '', body: '', target_plans: [] as string[], show: false, version: '1.0'
    });

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        const { data: configData } = await supabase.from('public_config').select('*').eq('id', 1).single();
        if (configData) {
            setConfig(configData);
            setData({
                title: configData.announcement_data?.title || '',
                body: configData.announcement_data?.body || '',
                target_plans: configData.announcement_data?.target_plans || [],
                show: configData.show_announcement || false,
                version: configData.announcement_data?.version || '1.0',
            });
        }
    };

    const handleSave = async () => {
        setLoading(true);
        const payload = {
            title: data.title,
            body: data.body,
            target_plans: data.target_plans,
            date: new Date().toISOString().split('T')[0],
            version: Date.now().toString()
        };

        const { error } = await supabase.from('public_config').update({
            announcement_data: payload,
            show_announcement: data.show,
            grace_period_days: config?.grace_period_days || 7,
            grace_period_allowed_modules: config?.grace_period_allowed_modules || ['inventory']
        }).eq('id', 1);

        setLoading(false);
        if (error) {
            alert('خطأ: ' + error.message);
        } else {
            alert('تم حفظ ونشر الإعدادات بنجاح ✅');
        }
    };

    const togglePlan = (plan: string) => {
        if (data.target_plans.includes(plan)) {
            setData({ ...data, target_plans: data.target_plans.filter(p => p !== plan) });
        } else {
            setData({ ...data, target_plans: [...data.target_plans, plan] });
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Status Card */}
            <div className={`p-4 rounded-2xl border ${data.show ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-900 border-slate-800'} `}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {data.show ? <Eye className="w-6 h-6 text-emerald-500" /> : <EyeOff className="w-6 h-6 text-slate-500" />}
                        <div>
                            <div className={`font-bold ${data.show ? 'text-emerald-400' : 'text-slate-400'} `}>
                                {data.show ? 'الإعلان نشط الآن' : 'الإعلان متوقف'}
                            </div>
                            <div className="text-xs text-slate-500">
                                {data.show ? 'سيظهر للمستخدمين المستهدفين' : 'لن يظهر لأي مستخدم'}
                            </div>
                        </div>
                    </div>
                    <label htmlFor="announcement-toggle" className="relative inline-flex items-center cursor-pointer">
                        <span className="sr-only">تفعيل الإعلان</span>
                        <input
                            id="announcement-toggle"
                            type="checkbox"
                            checked={data.show}
                            onChange={e => setData({ ...data, show: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-14 h-7 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                </div>
            </div>

            {/* Form */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
                <div>
                    <label htmlFor="announcement-title" className="block text-sm font-bold text-slate-300 mb-2">عنوان الإعلان</label>
                    <input
                        id="announcement-title"
                        value={data.title}
                        onChange={e => setData({ ...data, title: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-blue-500 outline-none transition"
                        placeholder="مثال: ميزة جديدة متاحة الآن!"
                    />
                </div>

                <div>
                    <label htmlFor="announcement-body" className="block text-sm font-bold text-slate-300 mb-2">نص الإعلان</label>
                    <textarea
                        id="announcement-body"
                        value={data.body}
                        onChange={e => setData({ ...data, body: e.target.value })}
                        rows={4}
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-blue-500 outline-none transition resize-none"
                        placeholder="اكتب تفاصيل الإعلان هنا..."
                    />
                </div>

                <div>
                    <div>
                        <h4 className="block text-sm font-bold text-slate-300 mb-2">إعدادات فترة السماح (Grace Period)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900/40 p-4 rounded-xl border border-slate-800">
                            <div>
                                <label htmlFor="grace-period-days" className="text-xs text-slate-400 block mb-1">عدد أيام السماح</label>
                                <input id="grace-period-days" type="number"
                                    value={config?.grace_period_days || 7}
                                    onChange={e => {
                                        if (config) setConfig({ ...config, grace_period_days: Number.parseInt(e.target.value, 10) } as SystemConfig);
                                    }}
                                    className="w-full bg-[#0f172a] border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-blue-500" />
                            </div>
                            <div>
                                <label htmlFor="grace-period-allowed-modules-field" id="modules-label" className="text-xs text-slate-400 block mb-1">الموديولات المسموحة (Inventory فقط افتراضياً)</label>
                                <fieldset id="grace-period-allowed-modules-field" className="flex flex-wrap gap-2 mt-1" aria-labelledby="modules-label">
                                    {(['inventory', 'finance', 'team', 'assets', 'reports'] as (Extract<keyof UserPermissions, string>)[]).map(mod => (
                                        <button key={mod}
                                            type="button"
                                            onClick={() => {
                                                const current = (config as SystemConfig)?.grace_period_allowed_modules || ['inventory'];
                                                const updated = (current as string[]).includes(mod)
                                                    ? (current as string[]).filter((m) => m !== mod)
                                                    : [...current, mod];
                                                if (config) setConfig({ ...config, grace_period_allowed_modules: updated });
                                            }}
                                            className={`px-3 py-1 rounded-full text-[10px] font-bold transition ${((config as SystemConfig)?.grace_period_allowed_modules || ['inventory'] as (keyof UserPermissions)[] as string[])?.includes(mod) ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}
                                        >
                                            {mod}
                                        </button>
                                    ))}
                                </fieldset>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h4 id="target-plans-label" className="block text-sm font-bold text-slate-300 mb-2">الباقات المستهدفة</h4>
                        <fieldset className="flex flex-wrap gap-3" aria-labelledby="target-plans-label">
                            {[
                                { id: 'pro', label: 'المحترف (Pro)' },
                                { id: 'starter', label: 'البداية (Starter)' },
                                { id: 'trial', label: 'التجريبية (Trial)' },
                            ].map(plan => (
                                <button
                                    key={plan.id}
                                    type="button"
                                    onClick={() => togglePlan(plan.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${data.target_plans.includes(plan.id)
                                        ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                                        : 'text-slate-400 hover:bg-slate-800'
                                        } `}
                                >
                                    {plan.label}
                                </button>
                            ))}
                        </fieldset>
                        <p className="text-xs text-slate-500 mt-2">* اترك الكل غير محدد لإظهار الإعلان للجميع</p>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition shadow-lg shadow-blue-500/20"
                    >
                        {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                        حفظ ونشر الإعلان والإعدادات
                    </button>
                </div>
            </div>
        </div >
    );
};

// ==================== PLANS SECTION ====================

const PlansSection: React.FC = () => {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

    // Default Plan Template
    const defaultPlan: Plan = {
        id: '',
        name: '',
        name_ar: '',
        description_ar: '',
        price: 0,
        price_monthly: 0,
        price_yearly: 0,
        interval: 'monthly',
        features: {
            reports: false, export: false, priority_support: false, max_users: 1, max_cars: 1,
            inventory: false, finance: false, team: false, maintenance: false, assets: false,
            advanced_reports: false, alerts: false
        },
        is_active: true,
        sort_order: 0
    };

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('plans')
            .select('*')
            .order('sort_order', { ascending: true });

        if (!error && data) {
            setPlans(data as Plan[]);
        }
        setLoading(false);
    };

    const handleSavePlan = async (plan: Plan) => {
        // Sanitize payload to match DB schema
        const payload = {
            id: plan.id,
            name: plan.name || plan.id,
            name_ar: plan.name_ar,
            description_ar: plan.description_ar,
            price_monthly: plan.price_monthly,
            price_yearly: plan.price_yearly,
            max_cars: plan.features.max_cars,
            max_users: plan.features.max_users,
            features: plan.features, // JSONB
            is_active: plan.is_active,
            sort_order: plan.sort_order,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase.from('plans').upsert(payload);

        if (error) {
            alert('فشل حفظ الباقة: ' + error.message);
        } else {
            alert('تم حفظ الباقة بنجاح ✅');
            fetchPlans();
            setIsEditModalOpen(false);
        }
    };

    const handleDeletePlan = async (planId: string) => {
        if (!confirm('هل أنت متأكد من حذف هذه الباقة؟')) return;
        const { error } = await supabase.from('plans').delete().eq('id', planId);

        if (error) {
            alert('فشل الحذف: ' + error.message);
        } else {
            setPlans(plans.filter(p => p.id !== planId));
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-end gap-3">
                <a
                    href="#/subscription"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-slate-800 text-slate-300 px-4 py-2 rounded-lg font-bold hover:bg-slate-700 hover:text-white transition border border-slate-700"
                >
                    <ExternalLink className="w-5 h-5" /> معاينة صفحة الاشتراكات
                </a>
                <button
                    onClick={() => { setEditingPlan(null); setIsEditModalOpen(true); }}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-500 transition"
                >
                    <Plus className="w-5 h-5" /> إضافة باقة جديدة
                </button>
            </div>

            {loading ? (
                <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-blue-500 w-8 h-8" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {plans.map(plan => (
                        <div key={plan.id} className={`bg-slate-900 border rounded-2xl p-6 transition relative group ${plan.is_active ? 'border-slate-800 hover:border-blue-500/30' : 'border-red-900/30 opacity-70'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${plan.is_active ? 'bg-blue-500/10' : 'bg-red-500/10'}`}>
                                    <Package className={`w-6 h-6 ${plan.is_active ? 'text-blue-500' : 'text-red-500'}`} />
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => { setEditingPlan(plan); setIsEditModalOpen(true); }} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-blue-400">
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDeletePlan(plan.id)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-400">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <h3 className="text-xl font-bold text-white mb-1">{plan.name_ar || plan.name}</h3>
                            <div className="text-sm text-slate-500 mb-2">{plan.id}</div>

                            <div className="flex flex-col gap-1 mb-4">
                                <div className="text-2xl font-bold text-blue-400">{plan.price_monthly} ج.م <span className="text-sm text-slate-500 font-normal">/ شهر</span></div>
                                <div className="text-lg font-bold text-emerald-400">{plan.price_yearly} ج.م <span className="text-sm text-slate-500 font-normal">/ سنة</span></div>
                            </div>

                            <div className="space-y-2 mb-4">
                                <div className="text-sm text-slate-300 flex items-center gap-2">
                                    <Car className="w-4 h-4 text-slate-500" />
                                    <span>{plan.features.max_cars === 9999 ? 'سيارات غير محدودة' : `${plan.features.max_cars} سيارة`}</span>
                                </div>
                                <div className="text-sm text-slate-300 flex items-center gap-2">
                                    <Users className="w-4 h-4 text-slate-500" />
                                    <span>{plan.features.max_users === 9999 ? 'مستخدمين غير محدودين' : `${plan.features.max_users} مستخدم`}</span>
                                </div>
                            </div>

                            {!plan.is_active && (
                                <div className="bg-red-500/10 text-red-400 text-xs px-2 py-1 rounded inline-block mb-2">غير نشطة (مخفية)</div>
                            )}

                            <div className="flex flex-wrap gap-2">
                                {Object.entries(plan.features).filter(([k, v]) => v === true && !['max_cars', 'max_users'].includes(k)).slice(0, 5).map(([key]) => (
                                    <span key={key} className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-400 capitalize">
                                        {key.replace('_', ' ')}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Edit Modal */}
            {isEditModalOpen && (
                <PlanEditModal
                    plan={editingPlan || defaultPlan}
                    onClose={() => setIsEditModalOpen(false)}
                    onSave={handleSavePlan}
                />
            )}
        </div>
    );
};

const PlanEditModal: React.FC<{ plan: Plan, onClose: () => void, onSave: (p: Plan) => void }> = ({ plan, onClose, onSave }) => {
    const [formData, setFormData] = useState<Plan>(plan);

    const toggleFeature = (key: string) => {
        // Cast to Record to allow string indexing
        const currentFeatures = (formData.features as unknown as Record<string, boolean>) || {};
        setFormData({
            ...formData,
            features: { ...currentFeatures, [key]: !currentFeatures[key] } as unknown as PlanFeatures
        });
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-slate-900 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 p-6 shadow-2xl">
                <h3 className="text-xl font-bold text-white mb-6">
                    {plan.id ? 'تعديل الباقة' : 'باقة جديدة'}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                        <label htmlFor="plan-name-ar" className="block text-sm text-slate-400 mb-1">الاسم بالعربية</label>
                        <input id="plan-name-ar" value={formData.name_ar} onChange={e => setFormData({ ...formData, name_ar: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white" />
                    </div>
                    <div>
                        <label htmlFor="plan-id" className="block text-sm text-slate-400 mb-1">الاسم بالإنجليزية (ID)</label>
                        <input id="plan-id" value={formData.id} disabled={!!plan.id} onChange={e => setFormData({ ...formData, id: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white disabled:opacity-50" />
                    </div>
                    <div className="col-span-2">
                        <label htmlFor="plan-desc" className="block text-sm text-slate-400 mb-1">وصف الباقة</label>
                        <input id="plan-desc" value={formData.description_ar || ''} onChange={e => setFormData({ ...formData, description_ar: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white" placeholder="وصف قصير يظهر تحت الاسم" />
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 border-b border-slate-800 pb-6">
                    <div>
                        <label htmlFor="plan-price-m" className="block text-sm text-slate-400 mb-1">شهري (ج.م)</label>
                        <input id="plan-price-m" type="number" value={formData.price_monthly} onChange={e => setFormData({ ...formData, price_monthly: Number(e.target.value) })} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white" />
                    </div>
                    <div>
                        <label htmlFor="plan-price-y" className="block text-sm text-slate-400 mb-1">سنوي (ج.م)</label>
                        <input id="plan-price-y" type="number" value={formData.price_yearly} onChange={e => setFormData({ ...formData, price_yearly: Number(e.target.value) })} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white" />
                    </div>
                    <div>
                        <label htmlFor="plan-max-cars" className="block text-sm text-slate-400 mb-1">السيارات</label>
                        <input id="plan-max-cars" type="number" value={formData.features.max_cars} onChange={e => setFormData({ ...formData, features: { ...formData.features, max_cars: Number(e.target.value) } })} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white" />
                    </div>
                    <div>
                        <label htmlFor="plan-max-users" className="block text-sm text-slate-400 mb-1">المستخدمين</label>
                        <input id="plan-max-users" type="number" value={formData.features.max_users} onChange={e => setFormData({ ...formData, features: { ...formData.features, max_users: Number(e.target.value) } })} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white" />
                    </div>
                    <div>
                        <label htmlFor="plan-sort" className="block text-sm text-slate-400 mb-1">ترتيب العرض</label>
                        <input id="plan-sort" type="number" value={formData.sort_order || 0} onChange={e => setFormData({ ...formData, sort_order: Number(e.target.value) })} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white" />
                    </div>
                </div>

                <div className="flex items-center gap-4 mb-6 p-4 bg-slate-800/50 rounded-xl">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={formData.is_active}
                            onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                            className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-green-600 focus:ring-green-500"
                        />
                        <span className="text-white font-bold">تفعيل الباقة</span>
                    </label>
                    <span className="text-xs text-slate-400">الباقات غير النشطة لن تظهر في صفحة الاشتراك للعملاء.</span>
                </div>

                <div className="space-y-4 mb-6">
                    <h4 className="font-bold text-white border-b border-slate-800 pb-2">الميزات والوحدات</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {[
                            { k: 'reports', l: 'التقارير' },
                            { k: 'export', l: 'تصدير البيانات' },
                            { k: 'priority_support', l: 'دعم فني' },
                            { k: 'inventory', l: 'المخزون (السيارات)' },
                            { k: 'finance', l: 'المالية' },
                            { k: 'team', l: 'فريق العمل' },
                            { k: 'maintenance', l: 'الصيانة' },
                            { k: 'assets', l: 'إدارة الأصول' },
                            { k: 'advanced_reports', l: 'تقارير متقدمة' },
                            { k: 'alerts', l: 'التنبيهات الذكية' },
                        ].map(item => (
                            <label key={item.k} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-800">
                                <input
                                    type="checkbox"
                                    checked={!!(formData.features as unknown as Record<string, boolean>)?.[item.k]}
                                    onChange={() => toggleFeature(item.k)}
                                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-slate-300 text-sm">{item.l}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700">إلغاء</button>
                    <button onClick={() => onSave(formData)} className="flex-1 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-500">حفظ</button>
                </div>
            </div>
        </div>
    );
};

// ==================== SYSTEM SETTINGS SECTION ====================

const SystemSettingsSection: React.FC = () => {
    const [config, setConfig] = useState<SystemConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        const { data } = await supabase.from('public_config').select('*').eq('id', 1).single();
        if (data) setConfig(data);
        setLoading(false);
    };

    const handleSave = async () => {
        if (!config) return;
        setSaving(true);
        const { error } = await supabase.from('public_config').update(config).eq('id', 1);
        setSaving(false);
        if (error) {
            alert('خطأ: ' + error.message);
        } else {
            alert('تم حفظ الإعدادات ✅');
        }
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* Pages & Entry Settings */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <Eye className="w-5 h-5 text-blue-500" />
                    إعدادات الصفحات والدخول
                </h3>

                <div className="space-y-4 max-w-xl">
                    {/* Show Landing Page */}
                    <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl">
                        <div>
                            <div className="font-bold text-white">عرض صفحة الهبوط</div>
                            <div className="text-xs text-slate-400">إظهار صفحة الهبوط للزوار</div>
                        </div>
                        <label htmlFor="landing-page-toggle" className="relative inline-flex items-center cursor-pointer">
                            <span className="sr-only">عرض صفحة الهبوط</span>
                            <input
                                id="landing-page-toggle"
                                type="checkbox"
                                checked={config?.show_landing_page || false}
                                onChange={e => setConfig(prev => prev ? { ...prev, show_landing_page: e.target.checked } : null)}
                                className="sr-only peer"
                            />
                            <div className="w-14 h-7 bg-slate-700 rounded-full peer peer-checked:bg-blue-500 after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full"></div>
                        </label>
                    </div>

                    {/* Show Pricing Page */}
                    <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl">
                        <div>
                            <div className="font-bold text-white">عرض صفحة الأسعار</div>
                            <div className="text-xs text-slate-400">إظهار صفحة الأسعار للزوار</div>
                        </div>
                        <label htmlFor="pricing-page-toggle" className="relative inline-flex items-center cursor-pointer">
                            <span className="sr-only">عرض صفحة الأسعار</span>
                            <input
                                id="pricing-page-toggle"
                                type="checkbox"
                                checked={config?.show_pricing_page || false}
                                onChange={e => setConfig(prev => prev ? { ...prev, show_pricing_page: e.target.checked } : null)}
                                className="sr-only peer"
                            />
                            <div className="w-14 h-7 bg-slate-700 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full"></div>
                        </label>
                    </div>

                    <div>
                        <label htmlFor="default-entry-page" className="block text-sm font-bold text-slate-400 mb-2">الصفحة الافتراضية عند الدخول</label>
                        <select
                            id="default-entry-page"
                            value={config?.default_entry_page || 'login'}
                            onChange={e => setConfig(prev => prev ? { ...prev, default_entry_page: e.target.value as 'login' | 'landing' | 'pricing' } : null)}
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-blue-500 outline-none"
                        >
                            <option value="login">صفحة تسجيل الدخول مباشرة</option>
                            <option value="landing">صفحة الهبوط (Landing)</option>
                            <option value="pricing">صفحة الأسعار (Pricing)</option>
                        </select>
                        <p className="text-xs text-slate-500 mt-2">* هذه الصفحة التي يراها الزائر أولاً عند فتح الموقع</p>
                    </div>

                    {/* Show Subscription Banner */}
                    <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl">
                        <div>
                            <div className="font-bold text-white">عرض شريط الاشتراك</div>
                            <div className="text-xs text-slate-400">إظهار شريط التذكير بالاشتراك</div>
                        </div>
                        <label htmlFor="subscription-banner-toggle" className="relative inline-flex items-center cursor-pointer">
                            <span className="sr-only">عرض شريط الاشتراك</span>
                            <input
                                id="subscription-banner-toggle"
                                type="checkbox"
                                checked={config?.show_subscription_banner || false}
                                onChange={e => setConfig(prev => prev ? { ...prev, show_subscription_banner: e.target.checked } : null)}
                                className="sr-only peer"
                            />
                            <div className="w-14 h-7 bg-slate-700 rounded-full peer peer-checked:bg-purple-500 after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full"></div>
                        </label>
                    </div>
                </div>
            </div>

            {/* Registration & Accounts */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-500" />
                    إعدادات التسجيل والحسابات
                </h3>

                <div className="space-y-4 max-w-xl">
                    {/* Allow Registration */}
                    <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl">
                        <div>
                            <div className="font-bold text-white">السماح بالتسجيل</div>
                            <div className="text-xs text-slate-400">السماح للمستخدمين الجدد بإنشاء حسابات</div>
                        </div>
                        <label htmlFor="allow-registration-toggle" className="relative inline-flex items-center cursor-pointer">
                            <span className="sr-only">السماح بالتسجيل</span>
                            <input
                                id="allow-registration-toggle"
                                type="checkbox"
                                checked={config?.allow_registration || false}
                                onChange={e => setConfig(prev => prev ? { ...prev, allow_registration: e.target.checked } : null)}
                                className="sr-only peer"
                            />
                            <div className="w-14 h-7 bg-slate-700 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full"></div>
                        </label>
                    </div>

                    {/* Allow Trial Accounts */}
                    <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl">
                        <div>
                            <div className="font-bold text-white">السماح بالحسابات التجريبية</div>
                            <div className="text-xs text-slate-400">السماح بإنشاء حسابات تجريبية جديدة</div>
                        </div>
                        <label htmlFor="allow-trial-toggle" className="relative inline-flex items-center cursor-pointer">
                            <span className="sr-only">السماح بالحسابات التجريبية</span>
                            <input
                                id="allow-trial-toggle"
                                type="checkbox"
                                checked={config?.allow_trial_accounts || false}
                                onChange={e => setConfig(prev => prev ? { ...prev, allow_trial_accounts: e.target.checked } : null)}
                                className="sr-only peer"
                            />
                            <div className="w-14 h-7 bg-slate-700 rounded-full peer peer-checked:bg-orange-500 after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full"></div>
                        </label>
                    </div>
                </div>
            </div>

            {/* System Settings */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-purple-500" />
                    إعدادات النظام العامة
                </h3>

                <div className="space-y-4 max-w-xl">
                    {/* Maintenance Mode */}
                    <div className="flex items-center justify-between p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                        <div>
                            <div className="font-bold text-white flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-red-500" />
                                وضع الصيانة
                            </div>
                            <div className="text-xs text-slate-400">إيقاف الوصول للتطبيق مؤقتاً</div>
                        </div>
                        <label htmlFor="maintenance-mode-toggle" className="relative inline-flex items-center cursor-pointer">
                            <span className="sr-only">وضع الصيانة</span>
                            <input
                                id="maintenance-mode-toggle"
                                type="checkbox"
                                checked={config?.maintenance_mode || false}
                                onChange={e => setConfig(prev => prev ? { ...prev, maintenance_mode: e.target.checked } : null)}
                                className="sr-only peer"
                            />
                            <div className="w-14 h-7 bg-slate-700 rounded-full peer peer-checked:bg-red-500 after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full"></div>
                        </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="app-version" className="block text-sm font-bold text-slate-400 mb-2">إصدار التطبيق</label>
                            <input
                                id="app-version"
                                value={config?.version || ''}
                                onChange={e => setConfig(prev => prev ? { ...prev, version: e.target.value } : null)}
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-purple-500 outline-none"
                            />
                        </div>

                        <div>
                            <label htmlFor="min-app-version" className="block text-sm font-bold text-slate-400 mb-2">الحد الأدنى للإصدار</label>
                            <input
                                id="min-app-version"
                                value={config?.min_app_version || ''}
                                onChange={e => setConfig(prev => prev ? { ...prev, min_app_version: e.target.value } : null)}
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-purple-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="instapay-handle" className="block text-sm font-bold text-slate-400 mb-2">عنوان InstaPay</label>
                            <input
                                id="instapay-handle"
                                value={config?.instapay_handle || ''}
                                onChange={e => setConfig(prev => prev ? { ...prev, instapay_handle: e.target.value } : null)}
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-purple-500 outline-none"
                                placeholder="name@instapay"
                            />
                        </div>
                        <div>
                            <label htmlFor="vodafone-cash-number" className="block text-sm font-bold text-slate-400 mb-2">رقم Vodafone Cash</label>
                            <input
                                id="vodafone-cash-number"
                                value={config?.vodafone_cash_number || ''}
                                onChange={e => setConfig(prev => prev ? { ...prev, vodafone_cash_number: e.target.value } : null)}
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-purple-500 outline-none"
                                placeholder="010xxxxxxxx"
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="whatsapp-number" className="block text-sm font-bold text-slate-400 mb-2">رقم WhatsApp للتواصل (الدعم الفني)</label>
                        <input
                            id="whatsapp-number"
                            value={config?.whatsapp_number || ''}
                            onChange={e => setConfig(prev => prev ? { ...prev, whatsapp_number: e.target.value } : null)}
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-purple-500 outline-none"
                            placeholder="966500000000"
                        />
                        <p className="text-xs text-slate-500 mt-2">* في حال عدم تحديد أرقام للدفع أعلاه، سيتم استخدام هذا الرقم افتراضياً.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="support-contact" className="block text-sm font-bold text-slate-400 mb-2">رقم الدعم الفني</label>
                            <input
                                id="support-contact"
                                value={config?.support_contact || ''}
                                onChange={e => setConfig(prev => prev ? { ...prev, support_contact: e.target.value } : null)}
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-purple-500 outline-none"
                                placeholder="0123456789"
                            />
                        </div>

                        <div>
                            <label htmlFor="survey-link" className="block text-sm font-bold text-slate-400 mb-2">رابط الاستبيان</label>
                            <input
                                id="survey-link"
                                value={config?.survey_link || ''}
                                onChange={e => setConfig(prev => prev ? { ...prev, survey_link: e.target.value } : null)}
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-purple-500 outline-none"
                                placeholder="https://survey.example.com"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition shadow-lg shadow-purple-500/20"
                    >
                        {saving ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                        حفظ جميع الإعدادات
                    </button>
                </div>
            </div>
        </div>
    );
};

// ==================== USERS SECTION ====================

const UsersSection: React.FC = () => {
    const [users, setUsers] = useState<Profile[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('all');

    // Org cache
    const [orgs, setOrgs] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [users, searchTerm, filterRole]);

    const fetchUsers = async () => {
        setLoading(true);
        // Fetch users
        const { data: userData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });

        // Fetch org names
        const { data: orgData } = await supabase.from('organizations').select('id, name');
        const orgMap: Record<string, string> = {};
        if (orgData) {
            for (const org of orgData) {
                orgMap[org.id] = org.name;
            }
        }
        setOrgs(orgMap);

        if (userData) {
            setUsers(userData);
            setFilteredUsers(userData);
        }
        setLoading(false);
    };

    const applyFilters = () => {
        let result = [...users];

        // Search
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(u =>
                u.full_name?.toLowerCase().includes(term) ||
                u.email?.toLowerCase().includes(term) ||
                u.username?.toLowerCase().includes(term)
            );
        }

        // Role filter
        if (filterRole !== 'all') {
            result = result.filter(u => u.role === filterRole);
        }

        setFilteredUsers(result);
    };

    const handleToggleStatus = async (user: Profile) => {
        const newStatus = user.status === 'disabled' ? 'active' : 'disabled';

        if (!confirm('هل أنت متأكد من ' + (newStatus === 'disabled' ? 'تعطيل' : 'تفعيل') + ' المستخدم "' + user.full_name + '"؟')) return;

        const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', user.id);

        if (error) {
            alert('خطأ: ' + error.message);
        } else {
            setUsers(users.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
            logAction('update', 'user', user.id, { field: 'status', old: user.status, new: newStatus });
        }
    };

    const logAction = async (action: string, entity: string, entityId: string, details: Record<string, unknown>) => {
        const session = JSON.parse(localStorage.getItem('securefleet_session') || '{ }');
        await supabase.from('audit_logs').insert({
            admin_id: session.id,
            action,
            entity,
            entity_id: entityId,
            details
        });
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            {/* Filters */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                        type="text"
                        placeholder="بحث عن مستخدم..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pr-10 pl-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-blue-500 outline-none"
                    />
                </div>

                <select
                    value={filterRole}
                    onChange={e => setFilterRole(e.target.value)}
                    className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-blue-500 outline-none"
                >
                    <option value="all">كل الأدوار</option>
                    <option value="owner">Owner (مالك)</option>
                    <option value="admin">Admin (مدير)</option>
                    <option value="supervisor">Supervisor (مشرف)</option>
                    <option value="driver">Driver (سائق)</option>
                </select>

                <div className="text-white flex items-center px-4">
                    عدد المستخدمين: {filteredUsers.length}
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden relative min-h-[400px]">
                {loading && (
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-10 flex items-center justify-center">
                        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                    </div>
                )}
                <div className="overflow-x-auto">
                    <table className="w-full text-right">
                        <thead className="bg-slate-800/50 text-slate-400 text-xs font-bold uppercase">
                            <tr>
                                <th className="px-6 py-4">المستخدم</th>
                                <th className="px-6 py-4">الدور</th>
                                <th className="px-6 py-4">المنظمة</th>
                                <th className="px-6 py-4">الحالة</th>
                                <th className="px-6 py-4">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {filteredUsers.map(user => (
                                <tr key={user.id} className="text-slate-300 hover:bg-slate-800/30 transition">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-white">
                                                {user.full_name?.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-bold text-white">{user.full_name}</div>
                                                <div className="text-xs text-slate-500">{user.email || user.username}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 bg-slate-700 rounded text-xs">
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {user.org_id ? (
                                            <span className="flex items-center gap-1 text-blue-400">
                                                <Building className="w-3 h-3" />
                                                {orgs[user.org_id] || 'منظمة غير معروفة'}
                                            </span>
                                        ) : (
                                            <span className="text-slate-500">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {user.status === 'disabled' ? (
                                            <span className="px-2 py-1 bg-red-500/10 text-red-400 rounded-full text-xs font-bold">معطل</span>
                                        ) : (
                                            <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-bold">نشط</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 flex items-center gap-2">
                                        <button
                                            onClick={() => handleToggleStatus(user)}
                                            className={`p-2 rounded-lg transition ${user.status === 'disabled' ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'} `}
                                            title={user.status === 'disabled' ? 'تفعيل' : 'تعطيل'}
                                        >
                                            {user.status === 'disabled' ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                                        </button>
                                        <button className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-lg transition hover:bg-slate-700" title="تعديل">
                                            <Edit className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filteredUsers.length === 0 && (
                    <div className="p-12 text-center text-slate-500">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>لا يوجد مستخدمين</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// ==================== AUDIT LOGS SECTION ====================

const AuditLogsSection: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        // In a real scenario, we would join with profiles to get admin name
        // For now, fetching logs directly
        const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50);

        if (data) {
            setLogs(data as unknown as AuditLog[]);
        }
        setLoading(false);
    };

    const getActionColor = (action: string) => {
        if (action.includes('delete') || action.includes('block')) return 'text-red-400';
        if (action.includes('create') || action.includes('add')) return 'text-emerald-400';
        if (action.includes('update') || action.includes('edit')) return 'text-blue-400';
        return 'text-slate-400';
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Shield className="w-5 h-5 text-purple-500" />
                        سجل النشاطات (آخر 50 إجراء)
                    </h3>
                    <button onClick={fetchLogs} className="text-sm text-blue-400 hover:text-blue-300">تحديث</button>
                </div>

                <div className="space-y-4">
                    {logs.slice(0, 4).map((log) => (
                        <div key={log.id} className="flex items-start gap-4 p-4 rounded-lg bg-slate-900/50 border border-slate-700/50">
                            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                                <FileText className="w-5 h-5 text-slate-500" />
                            </div>
                            <div className="flex-1">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                    <div className="font-bold text-white">
                                        <span className={getActionColor(log.action)}>{log.action.toUpperCase()}</span>
                                        <span className="mx-2 text-slate-600">|</span>
                                        <span className="text-slate-300">{log.entity}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <Clock className="w-3 h-3" />
                                        {new Date(log.created_at).toLocaleString('ar-SA')}
                                    </div>
                                </div>
                                <div className="mt-1 text-sm text-slate-400">
                                    قام الأدمن ({log.admin_id.substring(0, 8)}...) بإجراء تعديل على {log.entity} ({log.entity_id})
                                </div>
                                {log.details && (
                                    <div className="mt-2 bg-slate-950 p-2 rounded text-xs font-mono text-slate-500 overflow-x-auto">
                                        {JSON.stringify(log.details)}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {logs.length === 0 && (
                        <div className="text-center py-12 text-slate-500">
                            <Shield className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>لا توجد سجلات نشاط</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ==================== DISCOUNT CODES SECTION ====================

const DiscountCodesSection: React.FC = () => {
    const [codes, setCodes] = useState<DiscountCode[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCode, setEditingCode] = useState<DiscountCode | null>(null);
    const [formData, setFormData] = useState({
        code: '',
        description: '',
        discount_type: 'percentage' as 'percentage' | 'fixed',
        discount_value: 10,
        allowed_plans: [] as string[],
        max_uses: 100,
        expires_at: '',
        is_active: true
    });

    useEffect(() => {
        fetchCodes();
    }, []);

    const fetchCodes = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('discount_codes')
            .select('*')
            .order('created_at', { ascending: false });
        if (data) setCodes(data);
        setLoading(false);
    };

    const handleSave = async () => {
        const payload = {
            code: formData.code.toUpperCase().trim(),
            description: formData.description,
            discount_type: formData.discount_type,
            discount_value: formData.discount_value,
            allowed_plans: formData.allowed_plans.length > 0 ? formData.allowed_plans : null,
            max_uses: formData.max_uses,
            expires_at: formData.expires_at || null,
            is_active: formData.is_active
        };

        if (editingCode) {
            const { error } = await supabase
                .from('discount_codes')
                .update(payload)
                .eq('id', editingCode.id);
            if (error) return alert('خطأ: ' + error.message);
        } else {
            const { error } = await supabase.from('discount_codes').insert(payload);
            if (error) return alert('خطأ: ' + error.message);
        }

        setIsModalOpen(false);
        setEditingCode(null);
        fetchCodes();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('هل أنت متأكد من حذف هذا الكود؟')) return;
        await supabase.from('discount_codes').delete().eq('id', id);
        fetchCodes();
    };

    const openEditModal = (code: DiscountCode) => {
        setEditingCode(code);
        setFormData({
            code: code.code,
            description: code.description || '',
            discount_type: code.discount_type,
            discount_value: code.discount_value,
            allowed_plans: code.allowed_plans || [],
            max_uses: code.max_uses,
            expires_at: code.expires_at ? code.expires_at.split('T')[0] : '',
            is_active: code.is_active
        });
        setIsModalOpen(true);
    };

    const openNewModal = () => {
        setEditingCode(null);
        setFormData({
            code: '',
            description: '',
            discount_type: 'percentage',
            discount_value: 10,
            allowed_plans: [],
            max_uses: 100,
            expires_at: '',
            is_active: true
        });
        setIsModalOpen(true);
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Tag className="w-6 h-6 text-purple-500" />
                    أكواد الخصم
                </h2>
                <button
                    onClick={openNewModal}
                    className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-purple-500 transition"
                >
                    <Plus className="w-5 h-5" /> إضافة كود جديد
                </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-800/50">
                        <tr>
                            <th className="px-4 py-3 text-right text-sm font-bold text-slate-400">الكود</th>
                            <th className="px-4 py-3 text-right text-sm font-bold text-slate-400">الخصم</th>
                            <th className="px-4 py-3 text-right text-sm font-bold text-slate-400">الاستخدام</th>
                            <th className="px-4 py-3 text-right text-sm font-bold text-slate-400">الحالة</th>
                            <th className="px-4 py-3 text-right text-sm font-bold text-slate-400">الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {codes.map(code => (
                            <tr key={code.id} className="border-t border-slate-800 hover:bg-slate-800/30">
                                <td className="px-4 py-3">
                                    <div className="font-mono font-bold text-white bg-slate-800 px-2 py-1 rounded inline-block">
                                        {code.code}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-slate-300">
                                    {code.discount_type === 'percentage' ? (
                                        <span className="flex items-center gap-1">
                                            <Percent className="w-4 h-4 text-purple-400" />
                                            {code.discount_value}%
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1">
                                            <DollarSign className="w-4 h-4 text-emerald-400" />
                                            {code.discount_value} ج.م
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-slate-300">
                                    {code.used_count} / {code.max_uses}
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${code.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                                        }`}>
                                        {code.is_active ? 'نشط' : 'متوقف'}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex gap-2">
                                        <button onClick={() => openEditModal(code)} className="p-2 hover:bg-slate-700 rounded text-slate-400 hover:text-blue-400">
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(code.id)} className="p-2 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {codes.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                        <Tag className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>لا توجد أكواد خصم</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <div className="bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-700 p-6">
                        <h3 className="text-xl font-bold text-white mb-6">
                            {editingCode ? 'تعديل الكود' : 'كود خصم جديد'}
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="discount-code" className="block text-sm text-slate-400 mb-1">الكود</label>
                                <input
                                    id="discount-code"
                                    value={formData.code}
                                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono"
                                    placeholder="مثال: SAVE20"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="discount-type" className="block text-sm text-slate-400 mb-1">نوع الخصم</label>
                                    <select
                                        id="discount-type"
                                        value={formData.discount_type}
                                        onChange={e => setFormData({ ...formData, discount_type: e.target.value as 'percentage' | 'fixed' })}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                                    >
                                        <option value="percentage">نسبة مئوية %</option>
                                        <option value="fixed">مبلغ ثابت</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="discount-value" className="block text-sm text-slate-400 mb-1">القيمة</label>
                                    <input
                                        id="discount-value"
                                        type="number"
                                        value={formData.discount_value}
                                        onChange={e => setFormData({ ...formData, discount_value: Number(e.target.value) })}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="max-uses" className="block text-sm text-slate-400 mb-1">الحد الأقصى للاستخدام</label>
                                    <input
                                        id="max-uses"
                                        type="number"
                                        value={formData.max_uses}
                                        onChange={e => setFormData({ ...formData, max_uses: Number(e.target.value) })}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="expires-at" className="block text-sm text-slate-400 mb-1">تاريخ الانتهاء</label>
                                    <input
                                        id="expires-at"
                                        type="date"
                                        value={formData.expires_at}
                                        onChange={e => setFormData({ ...formData, expires_at: e.target.value })}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <input
                                    id="is-active"
                                    type="checkbox"
                                    checked={formData.is_active}
                                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                    className="w-4 h-4"
                                />
                                <label htmlFor="is-active" className="text-slate-300">تفعيل الكود</label>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setIsModalOpen(false)} className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700">إلغاء</button>
                            <button onClick={handleSave} className="flex-1 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-500">حفظ</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ==================== PAYMENT REQUESTS SECTION ====================

const PaymentRequestsSection: React.FC<{ currentUser: Profile | null }> = ({ currentUser }) => {
    const [requests, setRequests] = useState<PaymentRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
    const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);
    const [processing, setProcessing] = useState(false);
    const [rejectReason, setRejectReason] = useState('');

    // فحص الصلاحيات
    // const canView = currentUser?.permissions.subscription?.view_requests || false;
    const canApprove = currentUser?.permissions.subscription?.approve_requests || false;
    const canReject = currentUser?.permissions.subscription?.reject_requests || false;

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('payment_requests')
            .select('*, plans(*), organizations(*)')
            .order('created_at', { ascending: false });
        if (data) setRequests(data as unknown as PaymentRequest[]);
        setLoading(false);
    };

    const handleApprove = async (request: PaymentRequest) => {
        if (!canApprove) {
            alert('⛔ ليس لديك صلاحية الموافقة على طلبات الدفع');
            return;
        }

        setProcessing(true);
        const sessionStr = localStorage.getItem('securefleet_session');
        const adminId = sessionStr ? JSON.parse(sessionStr).id : null;

        const { data, error } = await supabase.rpc('approve_payment_request', {
            p_request_id: request.id,
            p_admin_id: adminId,
            p_notes: null
        });

        if (error) {
            alert('خطأ: ' + error.message);
        } else if (data && !data.success) {
            alert('خطأ: ' + data.error);
        } else {
            alert('تم تفعيل الاشتراك بنجاح ✅');
            fetchRequests();
        }
        setProcessing(false);
        setSelectedRequest(null);
    };

    const handleReject = async (request: PaymentRequest) => {
        if (!canReject) {
            alert('⛔ ليس لديك صلاحية رفض طلبات الدفع');
            return;
        }

        if (!rejectReason.trim()) return alert('يرجى إدخال سبب الرفض');

        setProcessing(true);
        const sessionStr = localStorage.getItem('securefleet_session');
        const adminId = sessionStr ? JSON.parse(sessionStr).id : null;

        const { data, error } = await supabase.rpc('reject_payment_request', {
            p_request_id: request.id,
            p_admin_id: adminId,
            p_reason: rejectReason
        });

        if (error) {
            alert('خطأ: ' + error.message);
        } else if (data && !data.success) {
            alert('خطأ: ' + data.error);
        } else {
            alert('تم رفض الطلب');
            fetchRequests();
            setRejectReason('');
        }
        setProcessing(false);
        setSelectedRequest(null);
    };

    const filteredRequests = requests.filter(r => filter === 'all' || r.status === filter);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending': return <span className="px-2 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400">في الانتظار</span>;
            case 'approved': return <span className="px-2 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400">تمت الموافقة</span>;
            case 'rejected': return <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400">مرفوض</span>;
            default: return null;
        }
    };

    const getFilterLabel = (f: string) => {
        switch (f) {
            case 'all': return 'الكل';
            case 'pending': return 'في الانتظار';
            case 'approved': return 'تمت الموافقة';
            case 'rejected': return 'مرفوض';
            default: return f;
        }
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Receipt className="w-6 h-6 text-emerald-500" />
                    طلبات الدفع
                    {requests.some(r => r.status === 'pending') && (
                        <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                            {requests.filter(r => r.status === 'pending').length} قيد الانتظار
                        </span>
                    )}
                </h2>
                <div className="flex gap-2">
                    {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${filter === f ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                                }`}
                        >
                            {getFilterLabel(f)}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid gap-4">
                {filteredRequests.map(request => (
                    <div key={request.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition">
                        <div className="flex flex-col lg:flex-row gap-4">
                            {/* Request Info */}
                            <div className="flex-1 space-y-3">
                                <div className="flex items-center gap-3 flex-wrap">
                                    {getStatusBadge(request.status)}
                                    <span className="text-slate-500 text-sm">
                                        {new Date(request.created_at || '').toLocaleDateString('ar-EG')}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div>
                                        <div className="text-xs text-slate-500">المنشأة</div>
                                        <div className="text-white font-medium">{(request as PaymentRequest & { organizations?: { name: string } }).organizations?.name || '-'}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500">الباقة</div>
                                        <div className="text-white font-medium">{(request as PaymentRequest & { plans?: { name_ar: string } }).plans?.name_ar || request.plan_id}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500">المبلغ</div>
                                        <div className="text-emerald-400 font-bold">{request.final_amount} ج.م</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500">طريقة الدفع</div>
                                        <div className="text-white">{request.payment_method === 'instapay' ? 'InstaPay' : 'Vodafone Cash'}</div>
                                    </div>
                                </div>
                                {request.reference_number && (
                                    <div className="text-sm text-slate-400">
                                        الرقم المرجعي: <span className="font-mono text-white">{request.reference_number}</span>
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-2 lg:w-48">
                                {request.receipt_url && (
                                    <a
                                        href={request.receipt_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition"
                                    >
                                        <Image className="w-4 h-4" />
                                        عرض الإيصال
                                    </a>
                                )}
                                {request.status === 'pending' && (
                                    <>
                                        <button
                                            onClick={() => handleApprove(request)}
                                            disabled={processing}
                                            className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 transition disabled:opacity-50"
                                        >
                                            <CheckCircle2 className="w-4 h-4" />
                                            موافقة
                                        </button>
                                        <button
                                            onClick={() => setSelectedRequest(request)}
                                            className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600/20 text-red-400 rounded-xl hover:bg-red-600/30 transition"
                                        >
                                            <XCircle className="w-4 h-4" />
                                            رفض
                                        </button>
                                    </>
                                )}
                                {request.status === 'rejected' && request.rejection_reason && (
                                    <div className="text-sm text-red-400 bg-red-500/10 p-2 rounded-lg">
                                        سبب الرفض: {request.rejection_reason}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {filteredRequests.length === 0 && (
                    <div className="text-center py-12 text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl">
                        <Receipt className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>لا توجد طلبات {filter !== 'all' && 'في هذه الفئة'}</p>
                    </div>
                )}
            </div>

            {/* Reject Modal */}
            {selectedRequest && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-700 p-6">
                        <h3 className="text-xl font-bold text-white mb-4">رفض طلب الدفع</h3>
                        <div className="mb-4">
                            <label htmlFor="reject-reason" className="block text-sm text-slate-400 mb-2">سبب الرفض</label>
                            <textarea
                                id="reject-reason"
                                value={rejectReason}
                                onChange={e => setRejectReason(e.target.value)}
                                rows={3}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white resize-none"
                                placeholder="مثال: الإيصال غير واضح..."
                            />
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => { setSelectedRequest(null); setRejectReason(''); }} className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700">إلغاء</button>
                            <button onClick={() => handleReject(selectedRequest)} disabled={processing} className="flex-1 py-2 bg-red-600 text-white rounded-xl hover:bg-red-500 disabled:opacity-50">
                                {processing ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'تأكيد الرفض'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SuperAdminDashboard;

