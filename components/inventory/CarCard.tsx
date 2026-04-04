import React, { useMemo } from 'react';
import { 
    Car as CarIcon, Gauge, Info, ShieldCheck, TrendingUp, TrendingDown, FileBarChart, Edit, Trash2 
} from 'lucide-react';
import { Car } from '../../types';

interface CarCardProps {
    car: Car;
    canEdit: boolean;
    canDelete: boolean;
    isReadOnly: boolean;
    onOpenReport: (car: Car) => void;
    onQuickAction: (carId: string, type: 'income' | 'expense') => void;
    onEdit: (car: Car) => void;
    onDelete: (carId: string) => void;
}

const CarCard: React.FC<CarCardProps> = ({ 
    car, canEdit, canDelete, isReadOnly, onOpenReport, onQuickAction, onEdit, onDelete 
}) => {
    const isLicenseExpired = useMemo(() => 
        car.license_expiry ? new Date(car.license_expiry) < new Date() : false, 
    [car.license_expiry]);
    
    const stats = car.stats || { total_income: 0, total_expense: 0, balance: 0 };

    const getStatusClasses = (status: Car['status']) => {
        switch (status) {
            case 'active': return 'bg-emerald-100 text-emerald-700';
            case 'maintenance': return 'bg-yellow-100 text-yellow-700';
            case 'rented': return 'bg-blue-100 text-blue-700';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    const getStatusText = (status: Car['status']) => {
        switch (status) {
            case 'active': return 'نشطة';
            case 'maintenance': return 'صيانة';
            case 'rented': return 'مؤجرة';
            default: return 'غير محدد';
        }
    };

    const getLicenseExpiryContainerClasses = (isExpired: boolean) => {
        return isExpired
            ? 'bg-red-50 border-red-100 text-red-600 dark:bg-red-900/10 dark:border-red-900/30'
            : 'bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-900/10 dark:border-emerald-900/30';
    };

    const getLicenseExpiryText = (isExpired: boolean) => isExpired ? 'منتهية' : 'سارية';
    const getLicenseExpiryIcon = (isExpired: boolean) => isExpired ? <Info className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />;

    return (
        <div className="bg-white dark:bg-[#1e293b] rounded-3xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col relative">
            <div className="h-2 w-full bg-gradient-to-r from-blue-500 to-indigo-600"></div>

            {/* Main Click Area */}
            <button
                className="p-5 flex-1 cursor-pointer w-full text-right"
                onClick={() => onOpenReport(car)}
            >
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-2xl">
                            <CarIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-xl text-slate-800 dark:text-white leading-tight">{car.make} {car.model}</h3>
                            <div className="text-sm font-bold text-slate-500 mt-1">{car.year}</div>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 font-mono tracking-wider border border-slate-200 dark:border-slate-600">
                            {car.plate_number}
                        </div>
                        {/* Status Badge */}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${getStatusClasses(car.status)}`}>
                            {getStatusText(car.status)}
                        </span>
                    </div>
                </div>

                {/* Odometer Display */}
                <div className="mb-4 flex items-center gap-2 text-xs font-bold text-slate-500 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg w-fit">
                    <Gauge className="w-3 h-3 text-purple-500" />
                    <span>العداد: {Number(car.current_odometer || 0).toLocaleString()} كم</span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700 mb-4 grid grid-cols-3 gap-2 text-center">
                    <div>
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mb-1">الوارد</div>
                        <div className="font-bold text-slate-800 dark:text-white">{stats.total_income.toLocaleString()}</div>
                    </div>
                    <div className="border-x border-slate-200 dark:border-slate-700">
                        <div className="text-[10px] text-red-500 font-bold mb-1">المنصرف</div>
                        <div className="font-bold text-slate-800 dark:text-white">{stats.total_expense.toLocaleString()}</div>
                    </div>
                    <div>
                        <div className="text-[10px] text-blue-500 font-bold mb-1">الباقي (الصافي)</div>
                        <div className={`font-bold ${stats.balance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'}`}>
                            {stats.balance.toLocaleString()}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className={`p-3 rounded-xl border flex flex-col justify-center items-center text-center ${getLicenseExpiryContainerClasses(isLicenseExpired)}`}>
                        <span className="text-[10px] font-bold opacity-80 mb-1">رخصة الربط</span>
                        <div className="font-bold text-sm mb-1">{car.license_number || 'غير مسجل'}</div>
                        <div className="flex items-center gap-1 font-bold text-[10px]">
                            {getLicenseExpiryIcon(isLicenseExpired)}
                            {getLicenseExpiryText(isLicenseExpired)}
                        </div>
                    </div>

                    <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex flex-col justify-center">
                        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                            <span>المالك</span>
                            <span className="font-bold">{car.owner_percentage}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
                            <div className="bg-blue-500 h-full" style={{ width: `${car.owner_percentage}%` }}></div>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                            <span>السائق</span>
                            <span className="font-bold">{car.driver_percentage}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full" style={{ width: `${car.driver_percentage}%` }}></div>
                        </div>
                    </div>
                </div>
            </button>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 border-t border-gray-100 dark:border-slate-700 divide-x divide-x-reverse divide-gray-100 dark:divide-slate-700 relative z-10 bg-white dark:bg-[#1e293b]">
                <button 
                  onClick={(e) => { e.stopPropagation(); if (!isReadOnly) onQuickAction(car.id, 'income'); }} 
                  disabled={isReadOnly}
                  className={`py-4 flex flex-col items-center justify-center gap-1 text-sm font-bold transition group/btn ${isReadOnly ? 'text-slate-400 opacity-50 cursor-not-allowed' : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/10'}`}>
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 group-hover/btn:scale-110 transition-transform" /> تسجيل وارد
                    </div>
                    <span className="text-[10px] font-normal opacity-60">إضافة مبلغ</span>
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); onQuickAction(car.id, 'expense'); }} 
                    disabled={isReadOnly}
                    className={`py-4 flex flex-col items-center justify-center gap-1 text-sm font-bold transition group/btn ${isReadOnly ? 'text-slate-400 opacity-50 cursor-not-allowed' : 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10'}`}
                >
                    <div className="flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 group-hover/btn:scale-110 transition-transform" /> تسجيل منصرف
                    </div>
                    <span className="text-[10px] text-red-600/60 font-normal">إضافة مبلغ</span>
                </button>
            </div>

            {/* Footer (Actions) */}
            <div className="px-5 py-3 bg-gray-50 dark:bg-slate-800/50 flex justify-between items-center border-t border-gray-100 dark:border-slate-700 relative z-10">
                <button onClick={() => onOpenReport(car)} className="text-blue-600 hover:text-blue-700 text-xs font-bold flex items-center gap-1.5 transition hover:underline">
                    <FileBarChart className="w-3.5 h-3.5" /> عرض التقرير الكامل
                </button>

                <div className="flex gap-2">
                    {canEdit && (
                        <button onClick={(e) => { e.stopPropagation(); onEdit(car); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-400 hover:text-blue-500 hover:border-blue-500 transition shadow-sm relative z-20 cursor-pointer">
                            <Edit className="w-4 h-4" />
                        </button>
                    )}
                    {canDelete && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(car.id);
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-400 hover:text-red-500 hover:border-red-500 transition shadow-sm relative z-20 cursor-pointer"
                            title="حذف السيارة"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CarCard;
