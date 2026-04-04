
import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Transaction, Car } from '../types';
import { LayoutContextType } from './Layout';
import { 
    Trash2, RefreshCcw, Search, TrendingUp, TrendingDown, 
    Info, Loader2, ChevronRight, Trash
} from 'lucide-react';

const GlobalTrash: React.FC = () => {
    const { org, isReadOnly } = useOutletContext<LayoutContextType>();
    const [trashTxs, setTrashTxs] = useState<(Transaction & { car?: Car })[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        if (org?.id) fetchTrash();
    }, [org?.id]);

    const fetchTrash = async () => {
        if (!org?.id) return;
        try {
            setLoading(true);
            // Fetch deleted transactions and JOIN cautiously with cars
            // Using transactions.org_id directly for better performance and RLS compatibility
            const { data, error } = await supabase
                .from('transactions')
                .select('*, car:cars(*)')
                .eq('org_id', org.id) // Direct filter on transactions table
                .not('deleted_at', 'is', null)
                .order('deleted_at', { ascending: false });

            if (error) throw error;
            setTrashTxs(data || []);
        } catch (error) {
            console.error('Error fetching trash:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async (id: string) => {
        if (isReadOnly) return;
        try {
            setActionLoading(id);
            const { error } = await supabase
                .from('transactions')
                .update({ deleted_at: null })
                .eq('id', id);

            if (error) throw error;
            setTrashTxs(prev => prev.filter(t => t.id !== id));
        } catch (error) {
            console.error('Error restoring transaction:', error);
        } finally {
            setActionLoading(null);
        }
    };

    const handlePermanentDelete = async (id: string) => {
        if (isReadOnly || !globalThis.confirm('هل أنت متأكد من حذف هذه الحركة نهائياً؟ لا يمكن التراجع عن هذا الإجراء.')) return;
        try {
            setActionLoading(id);
            const { error } = await supabase
                .from('transactions')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setTrashTxs(prev => prev.filter(t => t.id !== id));
        } catch (error) {
            console.error('Error deleting transaction:', error);
        } finally {
            setActionLoading(null);
        }
    };

    const filteredTrash = trashTxs.filter(t => {
        const s = searchTerm.toLowerCase();
        return (
            (t.notes || '').toLowerCase().includes(s) ||
            (t.car?.make || '').toLowerCase().includes(s) ||
            (t.car?.model || '').toLowerCase().includes(s) ||
            (t.car?.plate_number || '').toLowerCase().includes(s)
        );
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-xl text-red-600">
                            <Trash2 className="w-6 h-6" />
                        </div>
                        سلة المهملات
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
                        إدارة الحركات المحذوفة واستعادتها أو حذفها نهائياً
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="بحث في الملاحظات أو السيارات..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pr-10 pl-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
                        />
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                {loading && (
                    <div className="p-20 text-center">
                        <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
                        <p className="text-slate-500 font-bold">جاري تحميل سلة المهملات...</p>
                    </div>
                )}

                {!loading && filteredTrash.length === 0 && (
                    <div className="p-20 text-center">
                        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Trash2 className="w-10 h-10 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">السلة فارغة</h3>
                        <p className="text-slate-500 dark:text-slate-400">لا توجد حركات محذوفة حالياً</p>
                    </div>
                )}

                {!loading && filteredTrash.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-sm">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700 font-[Cairo]">
                                    <th className="p-4">تاريخ الحذف</th>
                                    <th className="p-4">السيارة</th>
                                    <th className="p-4">النوع</th>
                                    <th className="p-4">المبلغ</th>
                                    <th className="p-4">الملاحظات</th>
                                    <th className="p-4 text-center">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {filteredTrash.map((t) => (
                                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                        <td className="p-4 text-slate-500 dark:text-slate-400 font-mono text-xs">
                                            {t.deleted_at ? new Date(t.deleted_at).toLocaleString('ar-EG') : '-'}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600">
                                                    <ChevronRight className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 dark:text-white leading-none mb-1">
                                                        {t.car?.make} {t.car?.model}
                                                    </p>
                                                    <p className="text-[10px] text-slate-500 font-mono">{t.car?.plate_number}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {(() => {
                                                const isIncome = t.type === 'income';
                                                const colorClass = isIncome ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-red-50 text-red-600 dark:bg-red-900/20';
                                                const Icon = isIncome ? TrendingUp : TrendingDown;
                                                const label = isIncome ? 'وارد' : 'منصرف';
                                                
                                                return (
                                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold inline-flex items-center gap-1.5 ${colorClass}`}>
                                                        <Icon className="w-3 h-3" />
                                                        {label}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td className="p-4 font-bold font-mono text-slate-800 dark:text-white">
                                            {Number(t.amount).toLocaleString()}
                                        </td>
                                        <td className="p-4 max-w-xs">
                                            <p className="text-slate-500 dark:text-slate-400 truncate text-xs" title={t.notes || ''}>
                                                {t.notes || '-'}
                                            </p>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex justify-center gap-2">
                                                <button
                                                    onClick={() => handleRestore(t.id)}
                                                    disabled={!!actionLoading}
                                                    className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 hover:bg-emerald-100 rounded-xl transition-all flex items-center gap-1.5 font-bold text-xs"
                                                    title="استعادة"
                                                >
                                                    {actionLoading === t.id ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <RefreshCcw className="w-3.5 h-3.5" />
                                                    )}
                                                    استعادة
                                                </button>
                                                <button
                                                    onClick={() => handlePermanentDelete(t.id)}
                                                    disabled={!!actionLoading}
                                                    className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100 rounded-xl transition-all flex items-center gap-1.5 font-bold text-xs"
                                                    title="حذف نهائي"
                                                >
                                                    {actionLoading === t.id ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <Trash className="w-3.5 h-3.5" />
                                                    )}
                                                    حذف نهائي
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 p-4 rounded-2xl flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
                    <p className="font-bold">ملاحظات حول سلة المهملات:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                        <li>الحركات في سلة المهملات لا تدخل في حسابات الأرباح أو المصاريف.</li>
                        <li>استعادة الحركة سيعيدها فوراً إلى التقرير الخاص بسيارتها.</li>
                        <li>الحذف النهائي يزيل الحركة من قواعد البيانات ولا يمكن استرجاعها.</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default GlobalTrash;
