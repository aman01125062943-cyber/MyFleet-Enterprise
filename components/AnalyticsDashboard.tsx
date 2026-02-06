import React, { useState, useEffect } from 'react';
import { fetchSystemStats, SystemStats, fetchGrowthData, GrowthData } from '@lib/analytics';
import {
    Users,
    Building,
    CreditCard,
    Activity,
    Loader2,
    RefreshCw
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const AnalyticsDashboard: React.FC = () => {
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [growthData, setGrowthData] = useState<GrowthData[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            const [statsData, growth] = await Promise.all([
                fetchSystemStats(),
                fetchGrowthData()
            ]);
            setStats(statsData);
            setGrowthData(growth);
        } catch (error) {
            console.error('Failed to load analytics:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    if (loading && !stats) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                <span className="mr-2 text-slate-500 font-[Cairo]">جاري تحميل التحليلات...</span>
            </div>
        );
    }

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('ar-EG', {
            style: 'currency',
            currency: 'EGP',
            maximumFractionDigits: 2
        }).format(value).replace('ج.م.', 'ج.م');
    };

    return (
        <div className="space-y-6 font-[Cairo]" dir="rtl">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">إحصائيات النظام</h2>
                <button
                    onClick={() => loadData(true)}
                    disabled={refreshing}
                    className="flex items-center px-4 py-2 text-sm font-bold text-slate-300 bg-slate-900 border border-slate-700 rounded-xl hover:bg-slate-800 transition-all disabled:opacity-50 shadow-lg"
                >
                    <RefreshCw className={`w-4 h-4 ml-2 ${refreshing ? 'animate-spin' : ''}`} />
                    تحديث البيانات
                </button>
            </div>

            {/* Stat Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                {/* Total Organizations */}
                <div className="bg-slate-900 p-6 rounded-2xl shadow-xl border border-slate-800 hover:border-blue-500/50 transition-all group">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-400">إجمالي المنظمات</p>
                            <p className="text-2xl font-black text-white mt-1">{stats?.totalOrganizations || 0}</p>
                        </div>
                        <div className="p-3 bg-blue-500/10 rounded-xl group-hover:scale-110 transition-transform">
                            <Building className="w-6 h-6 text-blue-500" />
                        </div>
                    </div>
                </div>

                {/* Total Users */}
                <div className="bg-slate-900 p-6 rounded-2xl shadow-xl border border-slate-800 hover:border-purple-500/50 transition-all group">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-400">إجمالي المستخدمين</p>
                            <p className="text-2xl font-black text-white mt-1">{stats?.totalUsers || 0}</p>
                        </div>
                        <div className="p-3 bg-purple-500/10 rounded-xl group-hover:scale-110 transition-transform">
                            <Users className="w-6 h-6 text-purple-500" />
                        </div>
                    </div>
                </div>

                {/* Total Revenue */}
                <div className="bg-slate-900 p-6 rounded-2xl shadow-xl border border-slate-800 hover:border-emerald-500/50 transition-all group">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-400">إجمالي الإيرادات</p>
                            <p className="text-2xl font-black text-white mt-1">
                                {formatCurrency(stats?.totalRevenue || 0)}
                            </p>
                        </div>
                        <div className="p-3 bg-emerald-500/10 rounded-xl group-hover:scale-110 transition-transform">
                            <CreditCard className="w-6 h-6 text-emerald-500" />
                        </div>
                    </div>
                </div>

                {/* Monthly Revenue */}
                <div className="bg-slate-900 p-6 rounded-2xl shadow-xl border border-slate-800 hover:border-blue-500/50 transition-all group">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-400">إيرادات الشهر الحالي</p>
                            <p className="text-2xl font-black text-white mt-1">
                                {formatCurrency(stats?.monthlyRevenue || 0)}
                            </p>
                        </div>
                        <div className="p-3 bg-blue-500/10 rounded-xl group-hover:scale-110 transition-transform">
                            <Activity className="w-6 h-6 text-blue-500" />
                        </div>
                    </div>
                </div>

                {/* Active Subscriptions */}
                <div className="bg-slate-900 p-6 rounded-2xl shadow-xl border border-slate-800 hover:border-green-500/50 transition-all group">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-400">الاشتراكات النشطة</p>
                            <p className="text-2xl font-black text-white mt-1">{stats?.activeSubscriptions || 0}</p>
                        </div>
                        <div className="p-3 bg-green-500/10 rounded-xl group-hover:scale-110 transition-transform">
                            <Users className="w-6 h-6 text-green-500" />
                        </div>
                    </div>
                </div>

                {/* Trial / Cancelled Breakdown */}
                <div className="bg-slate-900 p-6 rounded-2xl shadow-xl border border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-medium text-slate-400">حالات أخرى</p>
                        <Activity className="w-5 h-5 text-slate-500" />
                    </div>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm">
                            <span className="flex items-center text-slate-300">
                                <span className="w-2 h-2 rounded-full bg-yellow-400 ml-2"></span>
                                فترة تجريبية
                            </span>
                            <span className="font-bold text-white">{stats?.trialSubscriptions || 0}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="flex items-center text-slate-300">
                                <span className="w-2 h-2 rounded-full bg-red-400 ml-2"></span>
                                ملغية
                            </span>
                            <span className="font-bold text-white">{stats?.cancelledSubscriptions || 0}</span>
                        </div>
                    </div>
                </div>

            </div>

            {/* Growth Chart */}
            <div className="bg-slate-900 p-6 rounded-3xl shadow-2xl border border-slate-800/50">
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-lg font-bold text-white">اتجاهات النمو</h3>
                    <div className="flex gap-4 text-xs">
                        <div className="flex items-center gap-2 text-blue-400">
                            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                            المنظمات
                        </div>
                        <div className="flex items-center gap-2 text-purple-400">
                            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                            المستخدمين
                        </div>
                    </div>
                </div>
                <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={growthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorOrgs" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis
                                dataKey="month"
                                stroke="#64748b"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                dy={10}
                            />
                            <YAxis
                                stroke="#64748b"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                dx={-10}
                            />
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#0f172a',
                                    border: '1px solid #1e293b',
                                    borderRadius: '12px',
                                    color: '#f8fafc'
                                }}
                                itemStyle={{ color: '#f8fafc' }}
                                labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="organizations"
                                name="المنظمات"
                                stroke="#3b82f6"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorOrgs)"
                            />
                            <Area
                                type="monotone"
                                dataKey="users"
                                name="المستخدمين"
                                stroke="#8b5cf6"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorUsers)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
