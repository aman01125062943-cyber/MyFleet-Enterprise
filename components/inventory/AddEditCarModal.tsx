import React from 'react';
import { X, ShieldCheck, PieChart, Loader2 } from 'lucide-react';
import { Car } from '../../types';

interface AddEditCarModalProps {
    isOpen: boolean;
    isEdit: boolean;
    saveLoading: boolean;
    car: Partial<Car>;
    onCarChange: (updates: Partial<Car>) => void;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
}

const AddEditCarModal: React.FC<AddEditCarModalProps> = ({
    isOpen, isEdit, saveLoading, car, onCarChange, onClose, onSubmit
}) => {
    if (!isOpen) return null;

    const handleOwnerPercentageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Number.parseFloat(e.target.value) || 0;
        onCarChange({ owner_percentage: val, driver_percentage: 100 - val });
    };

    return (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
            onClick={(e) => e.target === e.currentTarget && onClose()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
        >
            <div className="bg-white dark:bg-[#1e293b] w-[95%] md:w-full max-w-lg rounded-3xl p-5 md:p-8 shadow-2xl border border-gray-200 dark:border-slate-700 animate-in zoom-in-95 my-auto relative">
                <button
                    onClick={onClose}
                    className="absolute left-4 top-4 p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 transition"
                    aria-label="إغلاق"
                >
                    <X className="w-5 h-5" />
                </button>
                <h3 id="modal-title" className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white mb-6 border-b border-gray-100 dark:border-slate-700 pb-4 pr-2">
                    {isEdit ? 'تعديل بيانات السيارة' : 'إضافة سيارة جديدة'}
                </h3>
                <form onSubmit={onSubmit} className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="car-make" className="text-xs font-bold text-slate-500 mb-1.5 block">الماركة</label>
                            <input 
                                id="car-make"
                                required 
                                className="w-full bg-slate-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl p-3.5 outline-none text-slate-800 dark:text-white focus:border-blue-500 font-bold" 
                                placeholder="مثال: Toyota"
                                value={car.make || ''}
                                onChange={e => onCarChange({ make: e.target.value })} 
                            />
                        </div>
                        <div>
                            <label htmlFor="car-model" className="text-xs font-bold text-slate-500 mb-1.5 block">الموديل</label>
                            <input 
                                id="car-model"
                                required 
                                className="w-full bg-slate-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl p-3.5 outline-none text-slate-800 dark:text-white focus:border-blue-500 font-bold" 
                                placeholder="مثال: Camry"
                                value={car.model || ''}
                                onChange={e => onCarChange({ model: e.target.value })} 
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="car-plate" className="text-xs font-bold text-slate-500 mb-1.5 block">رقم اللوحة</label>
                            <input 
                                id="car-plate"
                                required 
                                className="w-full bg-slate-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl p-3.5 outline-none text-slate-800 dark:text-white focus:border-blue-500 font-bold text-center" 
                                placeholder="1234 ABC"
                                value={car.plate_number || ''}
                                onChange={e => onCarChange({ plate_number: e.target.value })} 
                            />
                        </div>
                        <div>
                            <label htmlFor="car-year" className="text-xs font-bold text-slate-500 mb-1.5 block">سنة الصنع</label>
                            <input 
                                id="car-year"
                                required 
                                className="w-full bg-slate-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl p-3.5 outline-none text-slate-800 dark:text-white focus:border-blue-500 font-bold text-center" 
                                placeholder="2024"
                                value={car.year || ''}
                                onChange={e => onCarChange({ year: e.target.value })} 
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                        <div>
                            <label htmlFor="car-status" className="text-xs font-bold text-slate-500 mb-1.5 block">حالة السيارة</label>
                            <select 
                                id="car-status"
                                className="w-full bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl p-3 outline-none text-slate-800 dark:text-white text-sm font-bold"
                                value={car.status || 'active'}
                                onChange={e => onCarChange({ status: e.target.value as Car['status'] })}
                            >
                                <option value="active">نشطة (Active)</option>
                                <option value="maintenance">صيانة (Maintenance)</option>
                                <option value="rented">مؤجرة (Rented)</option>
                                <option value="out_of_service">خارج الخدمة</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="car-odometer" className="text-xs font-bold text-slate-500 mb-1.5 block">عداد المسافات (كم)</label>
                            <input 
                                id="car-odometer"
                                type="number" 
                                min="0" 
                                className="w-full bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl p-3 outline-none text-slate-800 dark:text-white text-sm font-bold"
                                value={car.current_odometer || 0}
                                onChange={e => onCarChange({ current_odometer: Number(e.target.value) })} 
                            />
                        </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                        <h4 className="text-xs font-bold text-blue-500 mb-4 flex items-center gap-1"><ShieldCheck className="w-4 h-4" /> بيانات الرخصة</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="car-license" className="text-xs font-bold text-slate-500 mb-1.5 block">رقم الرخصة</label>
                                <input 
                                    id="car-license"
                                    className="w-full bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl p-3 outline-none text-slate-800 dark:text-white text-sm"
                                    value={car.license_number || ''}
                                    onChange={e => onCarChange({ license_number: e.target.value })} 
                                />
                            </div>
                            <div>
                                <label htmlFor="car-expiry" className="text-xs font-bold text-slate-500 mb-1.5 block">تاريخ الانتهاء</label>
                                <input 
                                    id="car-expiry"
                                    type="date" 
                                    className="w-full bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl p-3 outline-none text-slate-800 dark:text-white text-sm"
                                    value={car.license_expiry || ''}
                                    onChange={e => onCarChange({ license_expiry: e.target.value })} 
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                        <h4 className="text-xs font-bold text-emerald-500 mb-4 flex items-center gap-1"><PieChart className="w-4 h-4" /> نسب الربح</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="owner-perc" className="text-xs font-bold text-slate-500 mb-1.5 block">نسبة المالك %</label>
                                <div className="relative">
                                    <input 
                                        id="owner-perc"
                                        type="number" 
                                        min="0" 
                                        max="100" 
                                        className="w-full bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl p-3 outline-none text-slate-800 dark:text-white text-sm font-bold pl-8"
                                        value={car.owner_percentage || 100}
                                        onChange={handleOwnerPercentageChange} 
                                    />
                                    <span className="absolute left-3 top-3 text-slate-400 font-bold">%</span>
                                </div>
                            </div>
                            <div>
                                <label htmlFor="driver-perc" className="text-xs font-bold text-slate-500 mb-1.5 block">نسبة السائق % (تلقائي)</label>
                                <div className="relative">
                                    <input 
                                        id="driver-perc"
                                        type="number" 
                                        readOnly 
                                        className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 outline-none text-slate-500 dark:text-slate-400 text-sm font-bold cursor-not-allowed pl-8"
                                        value={car.driver_percentage || 0} 
                                    />
                                    <span className="absolute left-3 top-3 text-slate-400 font-bold">%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 mt-8">
                        <button type="button" onClick={onClose} className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-bold transition">إلغاء</button>
                        <button type="submit" disabled={saveLoading} className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 transition">
                            {saveLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isEdit ? 'حفظ التعديلات' : 'إضافة السيارة')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddEditCarModal;
