import React from 'react';
import { 
    X, Plus, Trash2, CheckCircle, ShoppingCart, 
    CreditCard, Wrench
} from 'lucide-react';
import { TransactionCategory } from '../../types';

interface CategoryManagerModalProps {
    type: 'income' | 'expense';
    initialCats: TransactionCategory[];
    onClose: () => void;
    onSave: (cats: TransactionCategory[]) => Promise<void>;
}

const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({ 
    type, initialCats, onClose, onSave 
}) => {
    const [cats, setCats] = React.useState<TransactionCategory[]>(initialCats);
    const [saving, setSaving] = React.useState(false);

    const handleAdd = () => {
        const id = `custom_${Date.now()}`;
        setCats([...cats, { id, label: '', is_custom: true }]);
    };

    const handleRemove = (id: string) => {
        setCats(cats.filter(c => c.id !== id));
    };

    const handleChange = (id: string, label: string) => {
        setCats(cats.map(c => c.id === id ? { ...c, label } : c));
    };

    const handleSaveLocal = async () => {
        const validCats = cats.filter(c => c.label.trim() !== '');
        setSaving(true);
        await onSave(validCats);
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-[#1e293b] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        {type === 'income' ? <ShoppingCart className="w-5 h-5 text-emerald-500" /> : <CreditCard className="w-5 h-5 text-red-500" />}
                        إدارة تصنيفات {type === 'income' ? 'الإيرادات' : 'المصروفات'}
                    </h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <div className="p-6 max-h-[60vh] overflow-y-auto no-scrollbar" dir="rtl">
                    <div className="space-y-3">
                        {cats.map((cat) => (
                            <div key={cat.id} className="flex items-center gap-3 group">
                                <div className="flex-1 relative">
                                    <input 
                                        type="text"
                                        value={cat.label}
                                        onChange={(e) => handleChange(cat.id, e.target.value)}
                                        placeholder="اسم التصنيف..."
                                        disabled={!cat.is_custom}
                                        className={`w-full h-12 pr-4 pl-12 rounded-2xl border-2 transition-all outline-none font-bold text-sm ${!cat.is_custom ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-400' : 'bg-white dark:bg-[#0f172a] border-slate-100 dark:border-slate-800 focus:border-blue-500 text-slate-700 dark:text-white shadow-sm'}`}
                                    />
                                    {!cat.is_custom && (
                                        <div className="absolute top-1/2 left-3 -translate-y-1/2 text-[10px] bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-lg text-slate-400 font-bold">افتراضي</div>
                                    )}
                                </div>
                                {cat.is_custom && (
                                    <button 
                                        onClick={() => handleRemove(cat.id)}
                                        className="p-3 rounded-xl bg-red-50 dark:bg-red-900/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 transition-all"
                                        aria-label="حذف التصنيف"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <button 
                        onClick={handleAdd}
                        className="w-full mt-6 py-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 font-bold text-sm flex items-center justify-center gap-2 hover:border-blue-400 hover:text-blue-500 transition-all group"
                    >
                        <div className="p-1 rounded-lg bg-slate-50 dark:bg-slate-800 group-hover:bg-blue-50 transition-all">
                            <Plus className="w-4 h-4" />
                        </div>
                        إضافة تصنيف جديد
                    </button>
                </div>

                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                    <button
                        onClick={handleSaveLocal}
                        disabled={saving}
                        className={`flex-[2] py-4 rounded-2xl font-bold text-sm transition flex items-center justify-center gap-2 ${saving ? 'bg-slate-200 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-500/30'}`}
                    >
                        {saving ? (
                            <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <CheckCircle className="w-4 h-4" />
                        )}
                        حفظ التعديلات
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 rounded-2xl font-bold text-sm bg-white dark:bg-[#1e293b] border-2 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition"
                    >
                        إلغاء
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CategoryManagerModal;
