import React from 'react';
import { getCategorySummaries, getCategoryColor, getCategoryIcon } from './utils';
import { Transaction } from '../../types';

interface ReportSummaryViewProps {
    transactions: Transaction[];
    getCategoryLabel: (type: 'income' | 'expense', id: string) => string;
}

const ReportSummaryView: React.FC<ReportSummaryViewProps> = ({ transactions, getCategoryLabel }) => {
    const summaries = getCategorySummaries(transactions, getCategoryLabel);
    const maxAmount = Math.max(...summaries.map(s => s.amount), 1);

    return (
        <div className="space-y-6">
            {/* Summary Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {summaries.map((sum) => {
                    const percentage = (sum.amount / maxAmount) * 100;
                    const colorClass = getCategoryColor(sum.type, sum.id);
                    
                    return (
                        <div key={`${sum.type}-${sum.id}`} className="bg-white dark:bg-[#1e293b] p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
                            <div className={`absolute top-0 right-0 w-24 h-24 bg-${colorClass}-500/5 rounded-full -mr-8 -mt-8 group-hover:scale-110 transition-transform`}></div>
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-3 bg-${colorClass}-50 dark:bg-${colorClass}-900/20 rounded-2xl`}>
                                        {getCategoryIcon(sum.type, sum.id)}
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                                            {sum.count} عمليات
                                        </div>
                                        <div className="text-2xl font-bold font-mono text-slate-800 dark:text-white">
                                            {sum.amount.toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                                
                                <h4 className="font-bold text-slate-700 dark:text-slate-300 text-lg mb-4">{sum.label}</h4>
                                
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[10px] font-bold text-slate-500/60 uppercase tracking-tighter">
                                        <span>نسبة المصروف</span>
                                        <span>{Math.round(percentage)}%</span>
                                    </div>
                                    <div className="h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full bg-${colorClass}-500 transition-all duration-1000`} 
                                            style={{ width: `${percentage}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            
            {/* Summary Table for Print */}
            <div className="hidden print:block mt-8 border-t-2 border-slate-200 pt-6">
                <h3 className="text-xl font-bold mb-4">ملخص الإجمالي لكل تصنيف</h3>
                <table className="w-full text-right" dir="rtl">
                    <thead>
                        <tr className="border-b-2 border-slate-300">
                            <th className="py-2">التصنيف</th>
                            <th className="py-2">العدد</th>
                            <th className="py-2 text-left">الإجمالي</th>
                        </tr>
                    </thead>
                    <tbody>
                        {summaries.map(sum => (
                            <tr key={`${sum.type}-${sum.id}-print`} className="border-b border-slate-100">
                                <td className="py-2 font-bold">{sum.label}</td>
                                <td className="py-2">{sum.count}</td>
                                <td className="py-2 text-left font-bold font-mono">{sum.amount.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ReportSummaryView;
