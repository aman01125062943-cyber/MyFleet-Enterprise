import React, { useState, useMemo, useCallback } from 'react';
import { 
    X, Download, Printer, Trash2, Search, PieChart, Calendar, 
    FileBarChart, CheckCircle
} from 'lucide-react';
import { Car, Transaction, Organization } from '../../types';
import ReportViewContent from './ReportViewContent';
import { getArabicMonthName } from './utils';
import { supabase } from '../../lib/supabaseClient';

interface ReportModalProps {
    car: Car;
    org: Organization | null; 
    onClose: () => void;
    getCategoryLabel: (type: 'income' | 'expense', id: string) => string;
    onEditTransaction: (t: Transaction) => void;
    onDeleteTransaction: (id: string) => void;
    fetchHistory: (car: Car) => Promise<void>;
}

/**
 * ReportModal Component
 * Displays a full-screen financial report for a specific car.
 * Handles its own filtering, grouping, and export logic to keep Inventory.tsx clean.
 */
const ReportModal: React.FC<ReportModalProps> = ({
    car,
    org,
    onClose,
    getCategoryLabel,
    onEditTransaction,
    onDeleteTransaction,
    fetchHistory
}) => {
    // --- Internal UI State ---
    const [reportFilterType, setReportFilterType] = useState<'all' | 'monthly' | 'yearly'>('monthly');
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number | null>(new Date().getMonth());
    const [reportViewMode, setReportViewMode] = useState<'detailed' | 'summary'>('detailed');
    const [reportTxTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
    const [showTrash, setShowTrash] = useState(false);
    const [trashTxs, setTrashTxs] = useState<Transaction[]>([]);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // --- Computed Data ---
    const getAvailableYears = useCallback((): number[] => {
        if (!car.history || car.history.length === 0) {
            return [new Date().getFullYear()];
        }
        const years = car.history.map(t => new Date(t.date).getFullYear());
        return Array.from(new Set(years)).sort((a, b) => b - a);
    }, [car.history]);

    const getFilteredTransactions = useCallback((): Transaction[] => {
        if (!car.history) return [];
        let filtered = [...car.history];

        if (reportFilterType === 'monthly') {
            filtered = filtered.filter(t => {
                const d = new Date(t.date);
                return d.getFullYear() === selectedYear && (selectedMonth === null || d.getMonth() === selectedMonth);
            });
        } else if (reportFilterType === 'yearly') {
            filtered = filtered.filter(t => new Date(t.date).getFullYear() === selectedYear);
        }

        if (reportTxTypeFilter !== 'all') {
            filtered = filtered.filter(t => t.type === reportTxTypeFilter);
        }

        return filtered;
    }, [car.history, reportFilterType, selectedYear, selectedMonth, reportTxTypeFilter]);

    const getMonthlyGroupedData = useCallback(() => {
        if (!car.history || reportFilterType !== 'yearly') return null;

        const monthlyData = Array.from({ length: 12 }, (_, i) => ({
            monthNumber: i + 1,
            monthName: getArabicMonthName(i),
            income: 0,
            expense: 0,
            net: 0,
            transactions: [] as Transaction[]
        }));

        const yearTxs = car.history.filter(t => new Date(t.date).getFullYear() === selectedYear);
        const filtered = reportTxTypeFilter === 'all' ? yearTxs : yearTxs.filter(t => t.type === reportTxTypeFilter);

        filtered.forEach(t => {
            const m = new Date(t.date).getMonth();
            monthlyData[m].transactions.push(t);
            if (t.type === 'income') monthlyData[m].income += Number(t.amount);
            else monthlyData[m].expense += Number(t.amount);
        });

        monthlyData.forEach(m => { m.net = m.income - m.expense; });
        return monthlyData;
    }, [car.history, reportFilterType, selectedYear, reportTxTypeFilter]);

    const monthlyData = useMemo(() => getMonthlyGroupedData(), [getMonthlyGroupedData]);
    const filteredHist = useMemo(() => getFilteredTransactions(), [getFilteredTransactions]);

    // Totals
    const { totalIncome, totalExpense, netProfit } = useMemo(() => {
        let inc = 0, exp = 0;
        if (monthlyData) {
            inc = monthlyData.reduce((s, m) => s + m.income, 0);
            exp = monthlyData.reduce((s, m) => s + m.expense, 0);
        } else {
            inc = filteredHist.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
            exp = filteredHist.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
        }
        return { totalIncome: inc, totalExpense: exp, netProfit: inc - exp };
    }, [monthlyData, filteredHist]);

    // --- Handlers ---
    const handleExportExcel = useCallback((data: Transaction[]) => {
        if (!data.length) return;
        const headers = ['التاريخ', 'النوع', 'التصنيف', 'المبلغ', 'ملاحظات'];
        const rows = data.map(t => [
            t.date,
            t.type === 'income' ? 'إيراد' : 'مصروف',
            getCategoryLabel(t.type, t.category || ''),
            t.amount,
            `"${(t.notes || '').replaceAll('"', '""')}"`
        ]);
        const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `report_${car.plate_number}_${new Date().toISOString().slice(0, 10)}.csv`);
        link.click();
    }, [car.plate_number, getCategoryLabel]);

    const toggleTrash = async () => {
        if (!showTrash) {
            const { data } = await supabase.from('transactions').select('*').eq('car_id', car.id).not('deleted_at', 'is', null);
            if (data) setTrashTxs(data as Transaction[]);
        }
        setShowTrash(!showTrash);
    };

    const handleRestoreTrash = async (id: string) => {
        const { error } = await supabase.from('transactions').update({ deleted_at: null }).eq('id', id);
        if (!error) {
            setTrashTxs(prev => prev.filter(t => t.id !== id));
            await fetchHistory(car);
            setSuccessMsg('تمت استعادة السجل بنجاح ✨');
            setTimeout(() => setSuccessMsg(null), 3000);
        }
    };

    const handlePermanentDeleteTrash = async (id: string) => {
        if (!confirm('هل أنت متأكد من حذف هذا السجل نهائياً؟ لا يمكن التراجع عن هذا الفعل.')) return;
        const { error } = await supabase.from('transactions').delete().eq('id', id);
        if (!error) {
            setTrashTxs(prev => prev.filter(t => t.id !== id));
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-white dark:bg-[#0f172a] overflow-y-auto animate-in fade-in flex flex-col print:fixed print:inset-0 print:w-screen print:h-screen print:z-[100] print:bg-white print:block">
            {/* TOOLBAR */}
            <div className="sticky top-0 z-40 bg-white/80 dark:bg-[#1e293b]/90 backdrop-blur-md border-b border-gray-200 dark:border-slate-700 shadow-sm p-4 print:hidden">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="w-full md:w-auto flex justify-between items-center gap-4">
                        <div className="flex items-center gap-3">
                            <button onClick={onClose} className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition">
                                <X className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                            </button>
                            <div>
                                <h2 className="text-lg font-bold text-slate-800 dark:text-white leading-none mb-1">{car.make} {car.model}</h2>
                                <p className="text-xs text-slate-500 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded inline-block">{car.plate_number}</p>
                            </div>
                        </div>
                        <div className="flex md:hidden gap-2">
                            <button onClick={() => handleExportExcel(filteredHist)} className="bg-emerald-50 text-emerald-600 p-2 rounded-lg">
                                <Download className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <div className="w-full md:w-auto flex flex-col md:flex-row items-center gap-3">
                        <div className="w-full overflow-x-auto pb-1 md:pb-0 flex items-center gap-3 no-scrollbar">
                            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
                                {(['all', 'monthly', 'yearly'] as const).map(type => (
                                    <button 
                                        key={type}
                                        onClick={() => setReportFilterType(type)} 
                                        className={`px-3 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap ${reportFilterType === type ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                                    >
                                        {(() => {
                                            const labels: Record<string, string> = { all: 'الكل', monthly: 'شهري', yearly: 'سنوي' };
                                            return labels[type];
                                        })()}
                                    </button>
                                ))}
                            </div>

                            {(reportFilterType === 'yearly' || reportFilterType === 'monthly') && (
                                <div className="relative shrink-0">
                                    <select
                                        value={selectedYear}
                                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                                        className="appearance-none w-24 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl py-2.5 pr-8 pl-3 outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer transition hover:bg-slate-200 dark:hover:bg-slate-700"
                                    >
                                        {getAvailableYears().map(year => (
                                            <option key={year} value={year}>{year}</option>
                                        ))}
                                    </select>
                                    <Calendar className="absolute top-1/2 right-2 -translate-y-1/2 pointer-events-none text-slate-500 w-3.5 h-3.5" />
                                </div>
                            )}

                            {reportFilterType === 'monthly' && (
                                <div className="relative shrink-0">
                                    <select
                                        value={selectedMonth ?? 'all'}
                                        onChange={(e) => setSelectedMonth(e.target.value === 'all' ? null : Number(e.target.value))}
                                        className="appearance-none min-w-[120px] bg-white dark:bg-slate-800 border-2 border-blue-500/20 dark:border-blue-500/20 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl py-2.5 pr-8 pl-3 outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                    >
                                        <option value="all">كل الشهور</option>
                                        {Array.from({ length: 12 }, (_, i) => (
                                            <option key={i} value={i}>{getArabicMonthName(i)}</option>
                                        ))}
                                    </select>
                                    <Calendar className="absolute top-1/2 right-2 -translate-y-1/2 pointer-events-none text-blue-600 dark:text-blue-400 w-3.5 h-3.5" />
                                </div>
                            )}

                            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
                                <button onClick={() => setReportViewMode('detailed')} className={`px-3 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${reportViewMode === 'detailed' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}><Search className="w-3.5 h-3.5" /> تفصيلي</button>
                                <button onClick={() => setReportViewMode('summary')} className={`px-3 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${reportViewMode === 'summary' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}><PieChart className="w-3.5 h-3.5" /> ملخص</button>
                            </div>
                        </div>

                        <div className="hidden md:flex items-center gap-2 shrink-0">
                            <button onClick={() => handleExportExcel(filteredHist)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow hover:shadow-lg transition">
                                <Download className="w-3.5 h-3.5" /> Excel
                            </button>
                            <button onClick={() => globalThis.print()} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow hover:shadow-lg transition">
                                <Printer className="w-3.5 h-3.5" /> طباعة
                            </button>
                            <button 
                                onClick={toggleTrash} 
                                className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow transition ${showTrash ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                                <Trash2 className="w-3.5 h-3.5" /> {showTrash ? 'إغلاق السلة' : 'سلة المهملات'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* REPORT BODY */}
            <div className="max-w-7xl mx-auto w-full p-4 md:p-8 flex-1 print:p-0 print:max-w-none print:overflow-visible" dir="rtl">
                <div className="hidden print:flex justify-between items-start mb-8 pb-6 border-b-2 border-slate-800">
                    <div>
                        <h1 className="text-3xl font-bold mb-2 text-black">{org?.name}</h1>
                        <p className="text-sm text-slate-600">{org?.settings?.address}</p>
                        <p className="text-sm text-slate-600">{org?.settings?.phone}</p>
                    </div>
                    <div className="text-left">
                        <div className="text-xl font-bold mb-2">{car.make} {car.model}</div>
                        <div className="font-mono text-lg border border-black px-2 py-1 inline-block">{car.plate_number}</div>
                        <div className="text-xs text-slate-500 mt-2">تاريخ التقرير: {new Date().toLocaleDateString()}</div>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="bg-emerald-50 dark:bg-emerald-900/10 p-6 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                        <div className="text-emerald-600 dark:text-emerald-400 text-sm font-bold mb-1">إجمالي الوارد</div>
                        <div className="text-3xl font-bold text-slate-800 dark:text-white">{totalIncome.toLocaleString()}</div>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-2xl border border-red-100 dark:border-red-900/30">
                        <div className="text-red-600 dark:text-red-400 text-sm font-bold mb-1">إجمالي المصاريف</div>
                        <div className="text-3xl font-bold text-slate-800 dark:text-white">{totalExpense.toLocaleString()}</div>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                        <div className="text-blue-600 dark:text-blue-400 text-sm font-bold mb-1">الصافي (الباقي)</div>
                        <div className={`text-3xl font-bold ${netProfit >= 0 ? 'text-slate-800 dark:text-white' : 'text-red-600'}`}>
                            {netProfit.toLocaleString()}
                        </div>
                    </div>
                </div>

                {monthlyData ? (
                    <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800/50">
                            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <FileBarChart className="w-5 h-5 text-blue-500" /> التقرير الشهري لعام {selectedYear}
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-right text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="p-4">الشهر</th>
                                        <th className="p-4 text-left">الوارد</th>
                                        <th className="p-4 text-left">المنصرف</th>
                                        <th className="p-4 text-left">الصافي</th>
                                        <th className="p-4 text-center">الحركات</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                    {monthlyData.map(m => (
                                        <tr key={m.monthNumber} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                                            <td className="p-4 font-bold text-slate-700 dark:text-slate-300">{m.monthName}</td>
                                            <td className="p-4 text-left font-bold font-mono text-emerald-600 dark:text-emerald-400">{m.income.toLocaleString()}</td>
                                            <td className="p-4 text-left font-bold font-mono text-red-600 dark:text-red-400">{m.expense.toLocaleString()}</td>
                                            <td className={`p-4 text-left font-bold font-mono ${m.net >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600'}`}>{m.net.toLocaleString()}</td>
                                            <td className="p-4 text-center text-slate-500">{m.transactions.length}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <ReportViewContent 
                        reportViewMode={reportViewMode}
                        filteredHist={filteredHist}
                        getCategoryLabel={getCategoryLabel}
                        onEditTransaction={onEditTransaction}
                        initiateDeleteTransaction={onDeleteTransaction}
                        showTrash={showTrash}
                        trashTxs={trashTxs}
                        onRestoreTrash={handleRestoreTrash}
                        onPermanentDeleteTrash={handlePermanentDeleteTrash}
                    />
                )}

                <div className="hidden print:block p-8 border-t-2 border-slate-800 text-center text-xs mt-auto">
                    {org?.settings?.footer_text || 'تقرير مالي - نظام إدارة الأسطول'}
                </div>
            </div>

            {successMsg && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-bottom-5">
                    <div className="bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-xl font-bold flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" /> {successMsg}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportModal;
