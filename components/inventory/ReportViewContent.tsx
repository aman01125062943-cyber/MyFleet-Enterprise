import React from 'react';
import { Trash2 } from 'lucide-react';
import { getArabicDayName } from './utils';
import ReportSummaryView from './ReportSummaryView';
import ReportDetailedView from './ReportDetailedView';
import { Transaction } from '../../types';

interface ReportViewContentProps {
    reportViewMode: 'summary' | 'detailed';
    filteredHist: Transaction[];
    getCategoryLabel: (type: 'income' | 'expense', id: string) => string;
    onEditTransaction: (t: Transaction) => void;
    initiateDeleteTransaction: (id: string) => void;
    showTrash: boolean;
    trashTxs: Transaction[];
    onRestoreTrash: (id: string) => void;
    onPermanentDeleteTrash: (id: string) => void;
}

const ReportViewContent: React.FC<ReportViewContentProps> = ({
    reportViewMode,
    filteredHist,
    getCategoryLabel,
    onEditTransaction,
    initiateDeleteTransaction,
    showTrash,
    trashTxs,
    onRestoreTrash,
    onPermanentDeleteTrash
}) => {
    return (
        <>
            {reportViewMode === 'summary' ? (
                <ReportSummaryView 
                    transactions={filteredHist} 
                    getCategoryLabel={getCategoryLabel} 
                />
            ) : (
                <ReportDetailedView 
                    transactions={filteredHist} 
                    getCategoryLabel={getCategoryLabel} 
                    onEdit={onEditTransaction} 
                    onDelete={initiateDeleteTransaction} 
                />
            )}

            {showTrash && (
                <div className="mt-8 animate-in slide-in-from-top-4">
                    <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 rounded-2xl overflow-hidden shadow-sm print:hidden">
                        <div className="p-4 border-b border-orange-100 dark:border-orange-900/30 flex justify-between items-center bg-orange-100/50 dark:bg-orange-900/20">
                            <h3 className="font-bold text-orange-800 dark:text-orange-400 flex items-center gap-2">
                                <Trash2 className="w-5 h-5" /> المحذوفات (سلة المهملات)
                            </h3>
                            <span className="text-[10px] bg-white dark:bg-slate-800 px-2 py-1 rounded-lg text-orange-600 border border-orange-200 dark:border-orange-800 font-bold">
                                سجلات يمكنك استعادتها
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-right text-sm">
                                <thead className="bg-orange-50 dark:bg-orange-900/5 text-orange-800/60 font-bold border-b border-orange-100 dark:border-orange-900/20">
                                    <tr>
                                        <th className="p-4 whitespace-nowrap">التاريخ</th>
                                        <th className="p-4">النوع</th>
                                        <th className="p-4">التصنيف</th>
                                        <th className="p-4 w-1/3">ملاحظات</th>
                                        <th className="p-4 text-left">المبلغ</th>
                                        <th className="p-4 text-center">إجراءات</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-orange-100 dark:divide-orange-900/20">
                                    {trashTxs.map(t => (
                                        <tr key={t.id} className="hover:bg-orange-100/30 transition text-orange-900 dark:text-orange-200">
                                            <td className="p-4 font-mono whitespace-nowrap opacity-60">
                                                {t.date}
                                                {t.date && <div className="text-[10px] font-bold text-slate-500">{getArabicDayName(t.date)}</div>}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                    {t.type === 'income' ? 'وارد' : 'منصرف'}
                                                </span>
                                            </td>
                                            <td className="p-4 font-bold">{getCategoryLabel(t.type, t.category || '')}</td>
                                            <td className="p-4 text-xs opacity-70">{t.notes || '-'}</td>
                                            <td className="p-4 text-left font-bold font-mono">{Number(t.amount).toLocaleString()}</td>
                                            <td className="p-4 flex justify-center gap-2">
                                                <button 
                                                    onClick={() => t.id && onRestoreTrash(t.id)} 
                                                    className="px-3 py-1 bg-blue-600 text-white rounded-lg text-[10px] font-bold shadow-md hover:bg-blue-500 transition"
                                                >
                                                    استعادة
                                                </button>
                                                <button 
                                                    onClick={() => t.id && onPermanentDeleteTrash(t.id)} 
                                                    className="p-1 px-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition" 
                                                    title="حذف نهائي"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {trashTxs.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="p-10 text-center text-orange-400 text-xs font-bold">
                                                سلة المهملات فارغة
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ReportViewContent;
