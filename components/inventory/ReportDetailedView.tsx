import React from 'react';
import { 
    FileBarChart, TrendingUp, TrendingDown, Edit, Trash2 
} from 'lucide-react';
import { Transaction } from '../../types';
import { getArabicDayName } from './utils';

interface ReportDetailedViewProps {
    transactions: Transaction[];
    getCategoryLabel: (type: 'income' | 'expense', id: string) => string;
    onEdit: (tx: Transaction) => void;
    onDelete: (txId: string) => void;
}

const ReportDetailedView: React.FC<ReportDetailedViewProps> = ({ 
    transactions, getCategoryLabel, onEdit, onDelete 
}) => {
    const handleKeyDown = (e: React.KeyboardEvent, tx: Transaction) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onEdit(tx);
        }
    };

    return (
        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm print:shadow-none print:border-none print:overflow-visible">
            <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800/50 print:bg-transparent">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 print:text-black">
                    <FileBarChart className="w-5 h-5 text-blue-500" /> سجل الحركات
                </h3>
                <span className="text-xs font-bold bg-white dark:bg-slate-700 px-2 py-1 rounded-lg text-slate-500 border border-slate-200 dark:border-slate-600">
                    {transactions.length} عمليات
                </span>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto print:block print:overflow-visible">
                <table className="w-full text-right text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700 print:bg-slate-200 print:text-black">
                        <tr>
                            <th className="p-4 whitespace-nowrap">التاريخ</th>
                            <th className="p-4 whitespace-nowrap">النوع</th>
                            <th className="p-4 whitespace-nowrap">التصنيف</th>
                            <th className="p-4 w-1/3">ملاحظات</th>
                            <th className="p-4 text-left">المبلغ</th>
                            <th className="p-4 text-center print:hidden">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700 print:divide-slate-300">
                        {transactions.map(t => (
                            <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition group print:text-black">
                                <td className="p-4 text-slate-600 dark:text-slate-300 whitespace-nowrap print:text-black">
                                    <div className="font-mono text-sm">{t.date}</div>
                                    <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">{t.date ? getArabicDayName(t.date) : ''}</div>
                                </td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold inline-flex items-center gap-1 ${t.type === 'income' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-red-50 text-red-600 dark:bg-red-900/20'} print:bg-transparent print:text-black print:border print:border-slate-400`}>
                                        {t.type === 'income' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                        {t.type === 'income' ? 'وارد' : 'منصرف'}
                                    </span>
                                </td>
                                <td className="p-4 text-slate-700 dark:text-slate-300 print:text-black font-medium">
                                    {getCategoryLabel(t.type, t.category ?? '')}
                                </td>
                                <td className="p-4 text-slate-500 dark:text-slate-400 text-xs print:text-black">{t.notes || '-'}</td>
                                <td className="p-4 text-left font-bold font-mono text-base">
                                    <span className={t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                                        {Number(t.amount).toLocaleString()}
                                    </span>
                                </td>
                                <td className="p-4 flex justify-center gap-2 print:hidden opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => onEdit(t)} className="p-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100 rounded transition" title="تعديل">
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => t.id && onDelete(t.id)} className="p-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100 rounded transition" title="حذف">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {transactions.length === 0 && (
                            <tr>
                                <td colSpan={6} className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2">
                                        <FileBarChart className="w-6 h-6 text-slate-300" />
                                    </div>
                                    لا توجد سجلات في هذه الفترة
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden print:hidden">
                <div className="divide-y divide-gray-100 dark:divide-slate-700">
                    {transactions.map(t => (
                        <div 
                            key={t.id} 
                            onClick={() => onEdit(t)} 
                            onKeyDown={(e) => handleKeyDown(e, t)}
                            className="p-4 active:bg-slate-50 dark:active:bg-slate-800/50 transition cursor-pointer"
                            role="button"
                            tabIndex={0}
                            aria-label={`تعديل الحركة بتاريخ ${t.date}`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${t.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                        {t.type === 'income' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-slate-800 dark:text-white">
                                            {getCategoryLabel(t.type, t.category ?? '')}
                                        </div>
                                        <div className="text-[10px] text-slate-500 font-mono">
                                            {t.date}
                                            {t.date && <span className="mr-1 font-bold text-slate-400">({getArabicDayName(t.date)})</span>}
                                        </div>
                                    </div>
                                </div>
                                <span className={`text-lg font-bold font-mono ${t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {Number(t.amount).toLocaleString()}
                                </span>
                            </div>

                            {t.notes && (
                                <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg mb-2 line-clamp-2 text-right">
                                    {t.notes}
                                </div>
                            )}

                            <div className="flex justify-end gap-2 mt-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onEdit(t); }}
                                    className="flex items-center gap-1 text-[10px] bg-blue-50 text-blue-600 px-2.5 py-1.5 rounded-lg font-bold"
                                >
                                    <Edit className="w-3 h-3" /> تعديل
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); if (t.id) onDelete(t.id); }}
                                    className="flex items-center gap-1 text-[10px] bg-red-50 text-red-600 px-2.5 py-1.5 rounded-lg font-bold"
                                >
                                    <Trash2 className="w-3 h-3" /> حذف
                                </button>
                            </div>
                        </div>
                    ))}
                    {transactions.length === 0 && (
                        <div className="p-10 text-center text-slate-400 text-sm flex flex-col items-center">
                            <FileBarChart className="w-10 h-10 text-slate-200 mb-2" />
                            لا توجد سجلات لعرضها
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReportDetailedView;
