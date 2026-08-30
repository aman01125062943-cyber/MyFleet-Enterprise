import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Users, Wallet, Plus, TrendingUp, TrendingDown, DollarSign,
  PieChart, Calendar, Filter, Trash2, ShieldAlert,
  Percent, FileText, CheckCircle, Printer, Car as CarIcon
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { LayoutContextType } from './Layout';
import { Car, OwnerDistribution, Transaction } from '../types';
import { db } from '../lib/db';

interface OwnerShareConfig {
  name: string;
  percentage: number;
}

const DEFAULT_OWNERS: OwnerShareConfig[] = [
  { name: 'المالك الأول', percentage: 50 },
  { name: 'المالك الثاني', percentage: 50 },
];

const OwnerExpenses: React.FC = () => {
  const { user, org, isReadOnly } = useOutletContext<LayoutContextType>();

  // State
  const [loading, setLoading] = useState(true);
  const [distributions, setDistributions] = useState<OwnerDistribution[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [owners, setOwners] = useState<OwnerShareConfig[]>(() => {
    const saved = localStorage.getItem(`myfleet_owners_${org?.id}`);
    return saved ? JSON.parse(saved) : DEFAULT_OWNERS;
  });

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Form State
  const [selectedOwner, setSelectedOwner] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [carId, setCarId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filter State
  const [filterOwner, setFilterOwner] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Owner Config Form State
  const [editOwners, setEditOwners] = useState<OwnerShareConfig[]>(owners);

  useEffect(() => {
    if (org?.id) {
      fetchData();
    }
  }, [org?.id]);

  useEffect(() => {
    if (owners.length > 0 && !selectedOwner) {
      setSelectedOwner(owners[0].name);
    }
  }, [owners]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (!org?.id) return;

      // 1. Fetch transactions for total income/expense calculation
      const { data: transData } = await supabase
        .from('transactions')
        .select('*')
        .eq('org_id', org.id);

      if (transData) setTransactions(transData as Transaction[]);

      // 2. Fetch Cars for dropdown reference
      const { data: carData } = await supabase
        .from('cars')
        .select('id, name, plate_number, make, model')
        .eq('org_id', org.id);

      if (carData) setCars(carData as Car[]);

      // 3. Fetch owner distributions from Supabase
      const { data: distData, error: distError } = await supabase
        .from('owner_distributions')
        .select('*')
        .eq('org_id', org.id)
        .order('date', { ascending: false });

      if (distData && !distError) {
        setDistributions(distData as OwnerDistribution[]);
      } else {
        // Fallback: Check local IndexedDB
        const localDists = await db.ownerDistributions
          .where('org_id')
          .equals(org.id)
          .toArray();

        if (localDists.length > 0) {
          setDistributions(localDists as unknown as OwnerDistribution[]);
        }
      }
    } catch (err) {
      console.warn('Error fetching owner expenses data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Financial Computations
  const totalFleetIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const totalFleetExpense = transactions
    .filter(t => t.type === 'expense' && t.category !== 'مسحوبات شريك')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const netFleetProfit = Math.max(0, totalFleetIncome - totalFleetExpense);

  const totalDistributionsAll = distributions.reduce((sum, d) => sum + (d.amount || 0), 0);

  // Compute Owner Specific Totals
  const ownerStats = owners.map(o => {
    const ownerDistributions = distributions.filter(d => d.owner_name === o.name);
    const totalWithdrawn = ownerDistributions.reduce((sum, d) => sum + Number(d.amount || 0), 0);
    const entitledShare = (netFleetProfit * (o.percentage / 100));
    const remainingBalance = entitledShare - totalWithdrawn;

    return {
      name: o.name,
      percentage: o.percentage,
      entitledShare,
      totalWithdrawn,
      remainingBalance,
      count: ownerDistributions.length
    };
  });

  // Filtered Distributions List
  const filteredDistributions = distributions.filter(d => {
    const matchesOwner = filterOwner === 'all' || d.owner_name === filterOwner;
    const matchesFrom = !dateFrom || new Date(d.date) >= new Date(dateFrom);
    const matchesTo = !dateTo || new Date(d.date) <= new Date(dateTo);
    return matchesOwner && matchesFrom && matchesTo;
  });

  const handleAddDistribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0 || !selectedOwner || !org?.id) return;

    setSubmitting(true);
    const numAmount = Number(amount);
    const selectedCar = cars.find(c => c.id === carId);
    const carName = selectedCar ? `${selectedCar.name || selectedCar.make || ''} (${selectedCar.plate_number || ''})` : undefined;

    const newRecord: Partial<OwnerDistribution> = {
      id: crypto.randomUUID(),
      org_id: org.id,
      owner_name: selectedOwner,
      amount: numAmount,
      date,
      notes: notes.trim() || 'مسحوبات شريك من الإيراد',
      car_id: carId || undefined,
      car_name: carName,
      created_at: new Date().toISOString()
    };

    try {
      // Save to Supabase
      const { error } = await supabase.from('owner_distributions').insert([newRecord]);

      if (error) {
        console.warn('Supabase insert failed, saving locally:', error);
      }

      // Also record in transactions as owner expense for financial reporting
      await supabase.from('transactions').insert([{
        id: crypto.randomUUID(),
        org_id: org.id,
        user_id: user?.id,
        car_id: carId || null,
        type: 'expense',
        category: 'مسحوبات شريك',
        amount: numAmount,
        reason: `مسحوبات للمالك: ${selectedOwner} ${notes ? `(${notes})` : ''}`,
        date,
        created_at: new Date().toISOString()
      }]);

      // Save to IndexedDB
      await db.ownerDistributions.put({
        id: newRecord.id,
        org_id: org.id,
        owner_name: selectedOwner,
        amount: numAmount,
        date,
        notes: notes.trim(),
        car_id: carId || undefined,
        last_updated: Date.now()
      });

      // Update state
      setDistributions(prev => [newRecord as OwnerDistribution, ...prev]);

      // Reset Form
      setAmount('');
      setNotes('');
      setCarId('');
      setShowAddModal(false);

      // Refresh transactions
      fetchData();
    } catch (err) {
      console.error('Error adding distribution:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDistribution = async (id: string) => {
    if (!window.confirm('هل أنت تأكد من حذف هذا السجل؟')) return;

    try {
      await supabase.from('owner_distributions').delete().eq('id', id);
      await db.ownerDistributions.delete(id);
      setDistributions(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      console.error('Error deleting record:', err);
    }
  };

  const handleSaveOwnerConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const totalPct = editOwners.reduce((sum, o) => sum + Number(o.percentage || 0), 0);
    if (totalPct !== 100) {
      alert(`إجمالي النسب يجب أن يساوي 100% (الإجمالي الحالي: ${totalPct}%)`);
      return;
    }
    setOwners(editOwners);
    if (org?.id) {
      localStorage.setItem(`myfleet_owners_${org.id}`, JSON.stringify(editOwners));
    }
    setShowConfigModal(false);
  };

  return (
    <div className="space-y-6 font-[Cairo]">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#1e293b] p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 shrink-0">
            <Wallet className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">مسحوبات وتوزيعات الشركاء</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">تتبع الحصص والمسحوبات الشخصية لكل مالك من صافي أرباح الأسطول</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => { setEditOwners(owners); setShowConfigModal(true); }}
            className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-xl font-bold text-sm transition"
          >
            <Percent className="w-4 h-4 text-indigo-500" />
            <span>ضبط نسب الشركاء</span>
          </button>

          {!isReadOnly && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/20 transition transform active:scale-95"
            >
              <Plus className="w-5 h-5" />
              <span>تسجيل سحب جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Financial Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Income */}
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-bold">إجمالي الإيرادات</span>
            <div className="p-2 bg-emerald-500/10 rounded-xl">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">
            {totalFleetIncome.toLocaleString()} <span className="text-xs text-slate-400">ج.م</span>
          </p>
        </div>

        {/* Total Expenses */}
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-bold">إجمالي المصروفات العامة</span>
            <div className="p-2 bg-red-500/10 rounded-xl">
              <TrendingDown className="w-5 h-5 text-red-500" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">
            {totalFleetExpense.toLocaleString()} <span className="text-xs text-slate-400">ج.م</span>
          </p>
        </div>

        {/* Net Fleet Profit */}
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-emerald-500/30 dark:border-emerald-500/20 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500"></div>
          <div className="flex items-center justify-between">
            <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold">الصافي القابل للتوزيع</span>
            <div className="p-2 bg-emerald-500/10 rounded-xl">
              <PieChart className="w-5 h-5 text-emerald-500" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">
            {netFleetProfit.toLocaleString()} <span className="text-xs text-slate-400">ج.م</span>
          </p>
        </div>

        {/* Total Owner Withdrawals */}
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-purple-500/30 dark:border-purple-500/20 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2 h-full bg-purple-500"></div>
          <div className="flex items-center justify-between">
            <span className="text-purple-600 dark:text-purple-400 text-xs font-bold">إجمالي مسحوبات الشركاء</span>
            <div className="p-2 bg-purple-500/10 rounded-xl">
              <Wallet className="w-5 h-5 text-purple-500" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 mt-2">
            {totalDistributionsAll.toLocaleString()} <span className="text-xs text-slate-400">ج.م</span>
          </p>
        </div>
      </div>

      {/* Owner Share Breakdown Cards */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-500" />
          <span>ملخص الأرباح والمسحوبات لكل مالك</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ownerStats.map((st, idx) => {
            const withdrawalPercent = st.entitledShare > 0 ? Math.min(100, (st.totalWithdrawn / st.entitledShare) * 100) : 0;
            const isOverdrawn = st.remainingBalance < 0;

            return (
              <div key={idx} className="bg-white dark:bg-[#1e293b] rounded-3xl p-6 border border-gray-100 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between space-y-4 transition hover:shadow-md">
                
                {/* Top Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-sm">
                      {st.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">{st.name}</h3>
                      <span className="text-xs text-indigo-500 font-semibold">نسبة الملكية: {st.percentage}%</span>
                    </div>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                    {st.count} عمليات سحب
                  </span>
                </div>

                {/* Main Figures */}
                <div className="space-y-2 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-gray-100 dark:border-slate-800/80">
                  <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
                    <span>الحصة المستحقة من الصافي:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{st.entitledShare.toLocaleString()} ج.م</span>
                  </div>

                  <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
                    <span>إجمالي المسحوبات والمصاريف:</span>
                    <span className="font-bold text-purple-600 dark:text-purple-400">{st.totalWithdrawn.toLocaleString()} ج.م</span>
                  </div>

                  <div className="h-px bg-gray-200 dark:bg-slate-800 my-2"></div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">الرصيد المتبقي:</span>
                    <span className={`text-base font-extrabold ${isOverdrawn ? 'text-red-500' : 'text-emerald-500'}`}>
                      {st.remainingBalance.toLocaleString()} ج.م
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>نسبة المسحوب من الحصة</span>
                    <span>{Math.round(withdrawalPercent)}%</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${isOverdrawn ? 'bg-red-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`}
                      style={{ width: `${Math.min(100, withdrawalPercent)}%` }}
                    ></div>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      </div>

      {/* Filter and History Table */}
      <div className="bg-white dark:bg-[#1e293b] rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden space-y-4">
        
        {/* Table Filters Header */}
        <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">سجل المسحوبات والمصاريف التفصيلي</h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Owner */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={filterOwner}
                onChange={e => setFilterOwner(e.target.value)}
                className="bg-transparent outline-none text-slate-700 dark:text-slate-300 font-bold"
              >
                <option value="all">كل الشركاء</option>
                {owners.map(o => (
                  <option key={o.name} value={o.name}>{o.name}</option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="bg-transparent outline-none text-slate-700 dark:text-slate-300 font-bold"
              />
            </div>

            {/* Date To */}
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="bg-transparent outline-none text-slate-700 dark:text-slate-300 font-bold"
              />
            </div>

            {/* Print Button */}
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-xl text-xs font-bold transition"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة التقرير</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 text-xs font-bold border-b border-gray-100 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-6">المالك / الشريك</th>
                <th className="py-3.5 px-6">المبلغ المسحوب</th>
                <th className="py-3.5 px-6">التاريخ</th>
                <th className="py-3.5 px-6">السيارة (إن وجدت)</th>
                <th className="py-3.5 px-6">البيان / الملاحظات</th>
                <th className="py-3.5 px-6 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">جاري تحميل البيانات...</td>
                </tr>
              ) : filteredDistributions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Wallet className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                      <p>لا توجد مسحوبات مسجلة حالياً</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDistributions.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                    <td className="py-4 px-6 font-bold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center text-xs font-bold">
                          {item.owner_name.charAt(0)}
                        </div>
                        <span>{item.owner_name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 font-extrabold text-purple-600 dark:text-purple-400">
                      {item.amount.toLocaleString()} ج.م
                    </td>
                    <td className="py-4 px-6 text-slate-600 dark:text-slate-400 text-xs">
                      {new Date(item.date).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="py-4 px-6 text-slate-600 dark:text-slate-400 text-xs">
                      {item.car_name ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 font-semibold">
                          <CarIcon className="w-3 h-3" /> {item.car_name}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-slate-600 dark:text-slate-400 text-xs max-w-xs truncate">
                      {item.notes || 'سحب نقدي'}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {!isReadOnly && (
                        <button
                          onClick={() => handleDeleteDistribution(item.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                          title="حذف السجل"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add New Withdrawal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1e293b] w-full max-w-md rounded-3xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-500" />
                <span>تسجيل مسحوبات جديدة للشريك</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddDistribution} className="space-y-4">
              {/* Partner Select */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">اختر المالك / الشريك</label>
                <select
                  required
                  value={selectedOwner}
                  onChange={e => setSelectedOwner(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-indigo-500 text-sm font-bold"
                >
                  {owners.map(o => (
                    <option key={o.name} value={o.name}>{o.name} ({o.percentage}%)</option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">المبلغ المسحوب (جنيه)</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="مثال: 5000"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-indigo-500 text-sm font-bold"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">تاريخ السحب</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-indigo-500 text-sm font-bold"
                />
              </div>

              {/* Related Car (Optional) */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">السيارة المرتبطة (اختياري)</label>
                <select
                  value={carId}
                  onChange={e => setCarId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-indigo-500 text-sm"
                >
                  <option value="">بدون سيارة محددة (مسحوبات عامة)</option>
                  {cars.map(c => (
                    <option key={c.id} value={c.id}>{c.name || c.make} ({c.plate_number})</option>
                  ))}
                </select>
              </div>

              {/* Notes / Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">البيان / السبب</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="مثال: مسحوبات شخصية من أرباح شهر أغسطس"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-indigo-500 text-sm"
                ></textarea>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-500/20 transition"
                >
                  {submitting ? 'جاري الحفظ...' : 'تأكيد وحفظ السحب'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl"
                >
                  إلغاء
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Modal: Config Owners & Percentages */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1e293b] w-full max-w-md rounded-3xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Percent className="w-5 h-5 text-indigo-500" />
                <span>إعداد أسماء الشركاء ونسب الأرباح</span>
              </h3>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveOwnerConfig} className="space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                أدخل أسماء المالكين/الشركاء والنسبة المئوية لكل منهم من صافي الأرباح (يجب أن يكون إجمالي النسب 100%).
              </p>

              {editOwners.map((owner, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <input
                    type="text"
                    required
                    value={owner.name}
                    onChange={e => {
                      const updated = [...editOwners];
                      updated[idx].name = e.target.value;
                      setEditOwners(updated);
                    }}
                    placeholder={`اسم المالك ${idx + 1}`}
                    className="flex-1 bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-indigo-500 text-sm font-bold"
                  />

                  <div className="w-28 relative">
                    <input
                      type="number"
                      required
                      min="0"
                      max="100"
                      value={owner.percentage}
                      onChange={e => {
                        const updated = [...editOwners];
                        updated[idx].percentage = Number(e.target.value);
                        setEditOwners(updated);
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-3 pr-8 text-slate-900 dark:text-white outline-none focus:border-indigo-500 text-sm font-bold text-center"
                    />
                    <span className="absolute right-3 top-3 text-slate-400 text-sm">%</span>
                  </div>

                  {editOwners.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setEditOwners(editOwners.filter((_, i) => i !== idx))}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={() => setEditOwners([...editOwners, { name: `المالك ${editOwners.length + 1}`, percentage: 0 }])}
                className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-indigo-600 dark:text-indigo-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1 border border-dashed border-indigo-300 dark:border-indigo-800"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة شريك جديد</span>
              </button>

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-500/20 transition"
                >
                  حفظ النسب
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl"
                >
                  إلغاء
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default OwnerExpenses;
