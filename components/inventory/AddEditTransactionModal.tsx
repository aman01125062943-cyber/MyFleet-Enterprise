import React from 'react';
import { 
    X, TrendingUp, TrendingDown, Edit, ChevronDown, Loader2 
} from 'lucide-react';
import { Car, Transaction, ExpenseTemplate, TransactionCategories } from '../../types';
import { getArabicDayName } from './utils';

interface AddEditTransactionModalProps {
    isOpen: boolean;
    isEdit: boolean;
    saveLoading: boolean;
    tx: Partial<Transaction> & { amount_str?: string };
    cars: Car[];
    templates: ExpenseTemplate[];
    activeCategories: TransactionCategories;
    showCategoryDropdown: boolean;
    setShowCategoryDropdown: (show: boolean) => void;
    onTxChange: (updates: Partial<Transaction> & { amount_str?: string }) => void;
    onClose: () => void;
    onSave: (e: React.FormEvent) => void;
    applyTemplate: (t: ExpenseTemplate) => void;
    getCategoryLabel: (type: 'income' | 'expense', id: string) => string;
    onEditCategories: (type: 'income' | 'expense') => void;
}

const AddEditTransactionModal: React.FC<AddEditTransactionModalProps> = ({
    isOpen, isEdit, saveLoading, tx, cars, templates, activeCategories,
    showCategoryDropdown, setShowCategoryDropdown, onTxChange, onClose, onSave,
    applyTemplate, getCategoryLabel, onEditCategories
}) => {
    if (!isOpen) return null;

    const selectedCar = cars.find(c => c.id === tx.car_id);

    return (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-start sm:items-center justify-center p-4 overflow-y-auto pb-20 sm:pb-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tx-modal-title"
        >
            <div className="bg-white dark:bg-[#1e293b] w-[95%] md:w-full max-w-sm rounded-2xl p-5 md:p-6 shadow-2xl border border-gray-200 dark:border-slate-700 animate-in zoom-in-95 relative my-auto">
                <div className="flex justify-between items-center mb-4">
                    <h3 id="tx-modal-title" className="text-lg md:text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        {tx.type === 'income' ? <TrendingUp className="text-emerald-500" /> : <TrendingDown className="text-red-500" />}
                        {isEdit ? 'تعديل السجل' : (tx.type === 'income' ? 'تسجيل إيراد' : 'تسجيل مصروف')}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        aria-label="إغلاق"
                    >
                        <X className="w-5 h-5 text-slate-400 hover:text-red-500" />
                    </button>
                </div>

                <form onSubmit={onSave} className="space-y-4">
                    <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
                        <span className="text-xs text-slate-500 block mb-1">السيارة المحددة</span>
                        <span className="font-bold text-slate-800 dark:text-white">
                            {selectedCar ? `${selectedCar.make} ${selectedCar.model}` : 'غير محدد'}
                        </span>
                    </div>

                    {/* Quick Templates Section */}
                    {templates.some(t => t.is_active && (t.type === tx.type || (!t.type && tx.type === 'expense'))) && (
                        <div className="mb-4">
                            <label className="text-xs font-bold text-slate-500 mb-2 block flex items-center gap-1">
                                <span className={`w-1.5 h-1.5 rounded-full ${tx.type === 'income' ? 'bg-emerald-500' : 'bg-red-500'} inline-block`}></span>
                                {tx.type === 'income' ? 'إيرادات جاهزة (اختر للتعبئة)' : 'مصروفات جاهزة (اختر للتعبئة)'}
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {templates.filter(t => t.is_active && (t.type === tx.type || (!t.type && tx.type === 'expense'))).map(t => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => applyTemplate(t)}
                                        className="px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 hover:shadow-sm transition active:scale-95"
                                    >
                                        {t.title} <span className="opacity-60 text-[10px] pr-1">({t.amount})</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="tx-amount" className="text-xs font-bold text-slate-500 mb-1 block">المبلغ</label>
                            <input 
                                id="tx-amount"
                                type="number" 
                                required 
                                min="0.01" 
                                step="0.01" 
                                className="w-full bg-slate-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl p-3 outline-none text-slate-800 dark:text-white font-bold focus:border-blue-500" 
                                placeholder="0.00" 
                                value={(tx.amount && tx.amount > 0) ? tx.amount : ''} 
                                onChange={e => onTxChange({ amount: Number.parseFloat(e.target.value) || 0 })} 
                            />
                        </div>
                        <div>
                            <label htmlFor="tx-date" className="text-xs font-bold text-slate-500 mb-1 block">التاريخ</label>
                            <input 
                                id="tx-date"
                                type="date" 
                                required 
                                className="w-full bg-slate-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl p-3 outline-none text-slate-800 dark:text-white focus:border-blue-500" 
                                value={tx.date || ''} 
                                onChange={e => onTxChange({ date: e.target.value })} 
                            />
                            {tx.date && (
                                <div className="text-[10px] font-bold text-blue-500 mt-1 mr-1">
                                    {getArabicDayName(tx.date)}
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label htmlFor="tx-category" className="text-xs font-bold text-slate-500 block">التصنيف</label>
                            <button
                                type="button"
                                onClick={() => onEditCategories(tx.type as 'income' | 'expense')}
                                className="text-[10px] font-bold text-blue-500 flex items-center gap-1 hover:underline"
                            >
                                <Edit className="w-2.5 h-2.5" /> تعديل القائمة
                            </button>
                        </div>
                        <div className="relative">
                            <div className="flex items-center">
                                <input
                                    id="tx-category"
                                    type="text"
                                    className="w-full bg-slate-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-r-xl p-3 outline-none text-slate-800 dark:text-white focus:border-blue-500 font-bold"
                                    placeholder="اختر أو اكتب..."
                                    value={getCategoryLabel(tx.type as 'income' | 'expense', tx.category || '')}
                                    onChange={e => onTxChange({ category: e.target.value })}
                                    onFocus={() => setShowCategoryDropdown(true)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                                    className="px-3 py-3.5 bg-slate-100 dark:bg-slate-800 border-y border-l border-gray-200 dark:border-slate-700 rounded-l-xl text-slate-500 hover:text-blue-500 transition"
                                    aria-label="عرض قائمة التصنيفات"
                                >
                                    <ChevronDown className={`w-5 h-5 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} />
                                </button>
                            </div>

                            {showCategoryDropdown && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                                    {(tx.type === 'income' ? activeCategories.income : activeCategories.expense).length > 0 ? (
                                        (tx.type === 'income' ? activeCategories.income : activeCategories.expense).map((cat) => (
                                            <button
                                                key={cat.id}
                                                type="button"
                                                onClick={() => {
                                                    onTxChange({ category: cat.id });
                                                    setShowCategoryDropdown(false);
                                                }}
                                                className="w-full text-right px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-gray-50 dark:border-slate-700/50 last:border-0 transition"
                                            >
                                                {cat.label}
                                            </button>
                                        ))
                                    ) : (
                                        <div className="p-4 text-center text-xs text-slate-400">لا توجد تصنيفات، اكتب يدوياً</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <label htmlFor="tx-notes" className="text-xs font-bold text-slate-500 mb-1 block">ملاحظات</label>
                        <textarea 
                            id="tx-notes"
                            className="w-full bg-slate-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl p-3 outline-none text-slate-800 dark:text-white h-20 focus:border-blue-500" 
                            placeholder="تفاصيل إضافية..." 
                            value={tx.notes || ''} 
                            onChange={e => onTxChange({ notes: e.target.value })}
                        ></textarea>
                    </div>

                    <button 
                        type="submit"
                        disabled={saveLoading} 
                        className={`w-full py-3 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 ${tx.type === 'income' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'}`}
                    >
                        {saveLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isEdit ? 'حفظ التعديلات' : (tx.type === 'income' ? 'حفظ الإيراد' : 'حفظ المصروف')}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AddEditTransactionModal;
