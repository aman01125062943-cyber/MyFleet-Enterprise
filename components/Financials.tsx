import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { DollarSign, TrendingUp, TrendingDown, Plus, Minus, Filter, Download } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { LayoutContextType } from './Layout';
import { assertPermission } from '../lib/planPermissionGuard';

const Financials: React.FC = () => {
  const { user, org } = useOutletContext<LayoutContextType>();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');

  // التحقق من الصلاحيات
  React.useEffect(() => {
    if (!user) return;

    // التحقق من صلاحية الوصول للإدارة المالية
    const planId = org?.subscription_plan || 'trial';
    if (!user.permissions?.finance?.view) {
      return;
    }
  }, [user, org]);

  React.useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    if (!org?.id) return;

    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('org_id', org.id)
      .order('date', { ascending: false });

    if (data) setTransactions(data);
    setLoading(false);
  };

  const filteredTransactions = transactions.filter(t =>
    filter === 'all' || t.type === filter
  );

  const totalIncome = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const totalExpense = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const balance = totalIncome - totalExpense;

  const canAdd = user?.permissions?.finance?.add_income || user?.permissions?.finance?.add_expense;
  const canExport = user?.permissions?.finance?.export;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">الإدارة المالية</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">تتبع الإيرادات والمصروفات</p>
        </div>
        {canAdd && (
          <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition">
            <Plus className="w-5 h-5" />
            <span>إضافة معاملة</span>
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-sm">إجمالي الوارد</p>
              <p className="text-2xl font-bold mt-1">{totalIncome.toLocaleString()} ج.م</p>
            </div>
            <TrendingUp className="w-10 h-10 text-emerald-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm">إجمالي المنصرف</p>
              <p className="text-2xl font-bold mt-1">{totalExpense.toLocaleString()} ج.م</p>
            </div>
            <TrendingDown className="w-10 h-10 text-red-200" />
          </div>
        </div>

        <div className={`rounded-xl p-6 text-white ${balance >= 0 ? 'bg-gradient-to-br from-blue-500 to-blue-600' : 'bg-gradient-to-br from-orange-500 to-orange-600'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">الصافي</p>
              <p className="text-2xl font-bold mt-1">{balance.toLocaleString()} ج.م</p>
            </div>
            <DollarSign className="w-10 h-10 text-blue-200" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            الكل
          </button>
          <button
            onClick={() => setFilter('income')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
              filter === 'income'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            وارد
          </button>
          <button
            onClick={() => setFilter('expense')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
              filter === 'expense'
                ? 'bg-red-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <TrendingDown className="w-4 h-4" />
            منصرف
          </button>
        </div>

        {canExport && (
          <button className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 px-4 py-2 rounded-lg transition">
            <Download className="w-4 h-4" />
            <span>تصدير</span>
          </button>
        )}
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="text-right py-4 px-6 text-sm font-medium text-slate-600 dark:text-slate-400">التاريخ</th>
                <th className="text-right py-4 px-6 text-sm font-medium text-slate-600 dark:text-slate-400">النوع</th>
                <th className="text-right py-4 px-6 text-sm font-medium text-slate-600 dark:text-slate-400">المبلغ</th>
                <th className="text-right py-4 px-6 text-sm font-medium text-slate-600 dark:text-slate-400">السبب</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-slate-500">جاري التحميل...</td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-slate-500">
                    لا توجد معاملات
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                    <td className="py-4 px-6 text-sm text-slate-900 dark:text-white">
                      {new Date(transaction.date).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                        transaction.type === 'income'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                      }`}>
                        {transaction.type === 'income' ? (
                          <><TrendingUp className="w-3 h-3" /> وارد</>
                        ) : (
                          <><TrendingDown className="w-3 h-3" /> منصرف</>
                        )}
                      </span>
                    </td>
                    <td className={`py-4 px-6 text-sm font-medium ${
                      transaction.type === 'income' ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {transaction.amount.toLocaleString()} ج.م
                    </td>
                    <td className="py-4 px-6 text-sm text-slate-600 dark:text-slate-400">
                      {transaction.reason || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Financials;
