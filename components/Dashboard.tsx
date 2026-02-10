
import React, { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Transaction, Plan } from '../types';
import { LayoutContextType } from './Layout';
import { db } from '../lib/db';
import {
    Activity,
    Calendar, AlertTriangle, BarChart3, Crown
} from 'lucide-react';
import WelcomeModal from './WelcomeModal';

// Helper Component for Stats Card
import { UpdateBanner } from './UpdateBanner';
const StatCard = ({ title, amount, type }: { title: string, amount: number, type: 'income' | 'expense' | 'net' }) => {
    let colorClass = '';
    if (type === 'income') colorClass = 'text-emerald-600 dark:text-emerald-400';
    else if (type === 'expense') colorClass = 'text-red-600 dark:text-red-400';
    else colorClass = amount >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500';

    let bgClass = '';
    if (type === 'income') bgClass = 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30';
    else if (type === 'expense') bgClass = 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30';
    else bgClass = 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30';

    return (
        <div className={`flex-1 rounded-xl p-2 md:p-5 border shadow-sm flex flex-col justify-center items-center text-center h-full ${bgClass}`}>
            <div className="text-[9px] md:text-xs font-bold text-slate-500 mb-1 whitespace-nowrap">{title}</div>
            <div className={`text-xs md:text-2xl font-bold truncate w-full ${colorClass}`}>
                {amount.toLocaleString()}
            </div>
        </div>
    );
};

// Helper: Get plan name in Arabic
const getPlanNameAr = (planId: string, availablePlans?: Plan[]) => {
    if (planId === 'trial') return 'تجريبية';
    const plan = availablePlans?.find(p => p.id === planId);
    if (plan) return plan.name_ar;
    if (planId === 'starter') return 'بداية';
    if (planId === 'pro') return 'برو';
    return planId;
};

// Helper: Calculate Date Difference
const getDayDiff = (d1: Date, d2: Date) => {
    const date1 = new Date(d1); date1.setHours(0, 0, 0, 0);
    const date2 = new Date(d2); date2.setHours(0, 0, 0, 0);
    return Math.ceil((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
};

// Helper: Process Transaction Data to reduce complexity in useEffect
const processTransactionStats = (txData: any[]) => {
    let mInc = 0, mExp = 0, wInc = 0, wExp = 0;

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);

    for (const t of txData) {
        const amount = Number(t.amount);
        const tDateObj = new Date(t.date);
        if (tDateObj >= startOfMonth) {
            if (t.type === 'income') mInc += amount;
            else mExp += amount;
        }
        if (tDateObj >= sevenDaysAgo) {
            if (t.type === 'income') wInc += amount;
            else wExp += amount;
        }
    }
    return { mInc, mExp, wInc, wExp };
};

const Dashboard: React.FC = () => {
    const { user, org, isExpired, systemConfig } = useOutletContext<LayoutContextType>();
    const [loading, setLoading] = useState(true);
    const [showWelcome, setShowWelcome] = useState(false);

    // Data States
    const [stats, setStats] = useState({
        totalCars: 0,
        totalUsers: 0,
        recentTx: [] as Transaction[],
        monthlyIncome: 0,
        monthlyExpense: 0,
        weeklyIncome: 0,
        weeklyExpense: 0
    });

    useEffect(() => {
        const hasSeenWelcome = localStorage.getItem(`welcome_${user?.id}`);
        if (user && org?.subscription_plan === 'trial' && !hasSeenWelcome) {
            setShowWelcome(true);
        }

        const loadData = async () => {
            if (!user || (!user.org_id && user.role !== 'super_admin')) {
                setLoading(false);
                return;
            }

            let carsCount = 0;
            let usersCount = 0;
            let txData: any[] = [];

            const today = new Date();
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(today.getDate() - 7);
            const fetchStartDate = startOfMonth < sevenDaysAgo ? startOfMonth.toISOString().split('T')[0] : sevenDaysAgo.toISOString().split('T')[0];

            if (navigator.onLine && user.org_id) {
                const { count: cCount } = await supabase.from('cars').select('*', { count: 'exact', head: true }).eq('org_id', user.org_id);
                const { count: uCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('org_id', user.org_id);
                const { data: remoteTxs } = await supabase.from('transactions').select('*').eq('org_id', user.org_id).gte('date', fetchStartDate).order('date', { ascending: true });

                carsCount = cCount || 0;
                usersCount = uCount || 0;
                txData = remoteTxs || [];

                if (remoteTxs) await db.transactions.bulkPut(remoteTxs);
            } else if (user.org_id) {
                carsCount = await db.cars.where('org_id').equals(user.org_id).count();
                // usersCount already 0
                txData = await db.transactions.where('org_id').equals(user.org_id).and(t => t.date >= fetchStartDate).toArray();
                txData.sort((a, b) => a.date.localeCompare(b.date));
            }

            const { mInc, mExp, wInc, wExp } = processTransactionStats(txData);

            const recentTx = [...txData].reverse().slice(0, 5);

            setStats({
                totalCars: carsCount,
                totalUsers: usersCount,
                recentTx: recentTx as Transaction[],
                monthlyIncome: mInc,
                monthlyExpense: mExp,
                weeklyIncome: wInc,
                weeklyExpense: wExp
            });
            setLoading(false);
        };

        loadData();
    }, [user, org?.subscription_plan]);

    if (loading) {
        return <div className="p-8 text-center text-slate-500">جاري تحميل البيانات...</div>;
    }

    const monthlyNet = stats.monthlyIncome - stats.monthlyExpense;
    const weeklyNet = stats.weeklyIncome - stats.weeklyExpense;

    return (
        <div className="space-y-6 animate-in fade-in pb-20 max-w-7xl mx-auto">
            <WelcomeModal isOpen={showWelcome} onClose={() => setShowWelcome(false)} userName={user?.full_name || 'يا بطل'} />

            {/* Auto Update Banner */}
            <UpdateBanner />

            {/* Header & Subscription Status */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-6">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-1">
                            <Activity className="text-blue-500 w-8 h-8" /> نظرة عامة
                        </h1>
                        {/* Super Admin Dashboard Button - Only for super_admin */}
                        {user?.role === 'super_admin' && (
                            <Link to="/admin" className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm px-4 py-2 rounded-xl transition-all hover:scale-105 shadow-lg shadow-purple-500/30 border border-purple-400/30">
                                <Crown className="w-4 h-4" /> لوحة الإدارة الشاملة
                            </Link>
                        )}
                    </div>
                    <p className="text-slate-500 text-sm">ملخص الأداء المالي والتشغيلي للوكالة</p>
                </div>

                {org && systemConfig?.show_subscription_banner && (
                    <div className="w-full md:w-auto bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col gap-3 min-w-[300px]">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-500">الباقة الحالية:</span>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1 ${isExpired ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                    {isExpired ? <AlertTriangle className="w-3 h-3" /> : <Crown className="w-3 h-3" />}
                                    {getPlanNameAr(org.subscription_plan, systemConfig?.available_plans)}
                                </span>
                            </div>
                            <Link to="/subscription" className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline">
                                ترقية / إدارة
                            </Link>
                        </div>

                        {/* Progress Bar Logic */}
                        {(() => {
                            const startDate = org.subscription_start ? new Date(org.subscription_start) : new Date();
                            const subEndDate = org.subscription_end ? new Date(org.subscription_end) : new Date();
                            const manualEnd = org.manual_extension_end ? new Date(org.manual_extension_end) : null;
                            const endDate = (manualEnd && manualEnd > subEndDate) ? manualEnd : subEndDate;

                            const today = new Date();

                            const totalDays = Math.max(1, getDayDiff(startDate, endDate));
                            const daysUsed = Math.max(0, getDayDiff(startDate, today));
                            const daysRemaining = Math.max(0, getDayDiff(today, endDate));
                            const percentage = Math.min(100, Math.max(0, (daysUsed / totalDays) * 100));

                            return (
                                <div>
                                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                        <span>المستخدم: {daysUsed} يوم</span>
                                        <span>المتبقي: {daysRemaining} يوم</span>
                                    </div>
                                    <div className="w-full h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${isExpired ? 'bg-red-500' : 'bg-indigo-500'}`}
                                            style={{ width: `${percentage}%` }}
                                        ></div>
                                    </div>
                                    <div className="text-[10px] text-center mt-1 text-slate-400">
                                        ينتهي في: {endDate.toLocaleDateString('en-GB')}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>

            {/* 1. MONTHLY STATS */}
            <div>
                <h3 className="font-bold text-sm md:text-lg text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4 md:w-5 md:h-5 text-purple-500" /> إحصائيات هذا الشهر
                </h3>
                <div className="flex items-stretch justify-between gap-2 md:gap-6">
                    <StatCard title="إجمالي الوارد" amount={stats.monthlyIncome} type="income" />
                    <StatCard title="إجمالي المنصرف" amount={stats.monthlyExpense} type="expense" />
                    <StatCard title="الصافي" amount={monthlyNet} type="net" />
                </div>
            </div>

            {/* 2. WEEKLY STATS */}
            <div>
                <h3 className="font-bold text-sm md:text-lg text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 md:w-5 md:h-5 text-orange-500" /> أداء آخر 7 أيام
                </h3>
                <div className="flex items-stretch justify-between gap-2 md:gap-6">
                    <StatCard title="وارد أسبوعي" amount={stats.weeklyIncome} type="income" />
                    <StatCard title="منصرف أسبوعي" amount={stats.weeklyExpense} type="expense" />
                    <StatCard title="صافي أسبوعي" amount={weeklyNet} type="net" />
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
