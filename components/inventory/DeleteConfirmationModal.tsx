import React from 'react';
import { AlertCircle, Trash2 } from 'lucide-react';

interface DeleteConfirmationModalProps {
    isOpen: boolean;
    saveLoading: boolean;
    deleteType: 'car' | 'transaction' | null;
    onClose: () => void;
    onConfirm: () => void;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
    isOpen,
    saveLoading,
    deleteType,
    onClose,
    onConfirm
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-[#1e293b] rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="p-6 text-center">
                    <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                        {deleteType === 'car' ? 'حذف السيارة نهائياً؟' : 'نقل العملة للسلة؟'}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
                        {deleteType === 'car' 
                            ? 'سيؤدي هذا لحذف السيارة وجميع الحركات المرتبطة بها نهائياً ولا يمكن التراجع.' 
                            : 'سيتم إخفاء هذه الحركة من التقارير ونقلها لسلة المهملات حيث يمكنك استعادتها لاحقاً.'}
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={onConfirm}
                            disabled={saveLoading}
                            className={`flex-1 py-3 rounded-2xl font-bold text-sm transition flex items-center justify-center gap-2 ${saveLoading ? 'bg-slate-100 text-slate-400' : 'bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-500/30'}`}
                        >
                            {saveLoading ? (
                                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <Trash2 className="w-4 h-4" />
                            )}
                            {deleteType === 'car' ? 'تأكيد الحذف' : 'نقل للسلة'}
                        </button>
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 rounded-2xl font-bold text-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition"
                        >
                            تراجع
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeleteConfirmationModal;
