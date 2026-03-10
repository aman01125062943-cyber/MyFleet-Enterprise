
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Car } from '../types';
import {
    Calculator, Fuel, Droplet, Banknote, RefreshCcw, Gauge, Save,
    Car as CarIcon, Calendar, Loader2, Printer, TrendingUp, DollarSign
} from 'lucide-react';

import { useOutletContext } from 'react-router-dom';
import { LayoutContextType } from './Layout';

const TripCalculator: React.FC = () => {
    const { user, org } = useOutletContext<LayoutContextType>();
    const [cars, setCars] = useState<Car[]>([]);
    const [selectedCarId, setSelectedCarId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);

    const [data, setData] = useState({
        km: '',
        tripIncome: '', // New: Expected Income from the trip
        fuelCost: '',
        oilCost: '',
        otherCost: ''
    });

    const km = parseFloat(data.km) || 0;
    const income = parseFloat(data.tripIncome) || 0;
    const fuel = parseFloat(data.fuelCost) || 0;
    const oil = parseFloat(data.oilCost) || 0;
    const other = parseFloat(data.otherCost) || 0;

    const totalCost = fuel + oil + other;
    const netProfit = income - totalCost;
    const costPerKm = km > 0 ? (totalCost / km) : 0;
    const profitMargin = income > 0 ? ((netProfit / income) * 100) : 0;

    useEffect(() => {
        const fetchCars = async () => {
            // Fallback: If no org in context yet, wait or try fetching if user exists
            const orgId = org?.id || user?.org_id;
            if (!orgId) return;

            try {
                const { data, error } = await supabase.from('cars').select('*').eq('org_id', orgId);
                if (error) console.error('Error fetching cars:', error);
                if (data) setCars(data as Car[]);
            } catch (err) {
                console.error("Fetch error:", err);
            }
        };

        if (user) fetchCars();
    }, [user, org]);

    const handleSaveToLedger = async () => {
        if (!selectedCarId) {
            alert('الرجاء اختيار السيارة أولاً');
            return;
        }
        if (totalCost === 0 && income === 0) {
            alert('لا توجد بيانات لحفظها');
            return;
        }
        if (!user) return;

        if (!confirm('هل تريد ترحيل هذه البيانات إلى دفتر اليومية (الوارد والمنصرف) العام؟')) return;

        setLoading(true);

        const orgId = org?.id || user.org_id;
        if (!orgId) {
            alert('خطأ: لا يمكن تحديد المنظمة');
            setLoading(false);
            return;
        }

        // 1. Insert Expense Record
        if (totalCost > 0) {
            const notesDetails = [
                km > 0 ? `مسافة: ${km} كم` : '',
                fuel > 0 ? `بنزين: ${fuel}` : '',
                oil > 0 ? `زيت: ${oil}` : '',
                other > 0 ? `أخرى: ${other}` : ''
            ].filter(Boolean).join(' | ');

            await supabase.from('transactions').insert({
                car_id: selectedCarId,
                type: 'expense',
                amount: totalCost,
                date: date,
                category: 'operating_cost',
                notes: `تكلفة رحلة: ${notesDetails}`,
                user_id: user.id,
                org_id: orgId
            });
        }

        // 2. Insert Income Record (If provided)
        if (income > 0) {
            await supabase.from('transactions').insert({
                car_id: selectedCarId,
                type: 'income',
                amount: income,
                date: date,
                category: 'daily_rent', // or create a 'trip_income' category
                notes: `إيراد رحلة (صافي ربح: ${netProfit})`,
                user_id: user.id,
                org_id: orgId
            });
        }

        setLoading(false);
        alert('تم ترحيل العملية إلى الحسابات العامة بنجاح');
    };

    const handlePrint = () => {
        if (!selectedCarId) {
            alert('الرجاء اختيار بيانات الرحلة');
            return;
        }
        setShowPrintModal(true);
        // Wait for modal to render then print
        setTimeout(() => window.print(), 100);
    };

    const selectedCar = cars.find(c => c.id === selectedCarId);

    return (
        <div className="font-[Cairo] pb-20 max-w-4xl mx-auto animate-in fade-in">

            {/* Page Header */}
            <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Calculator className="w-8 h-8 text-blue-500" />
                        تحليل تكاليف الرحلة (Trip Analyzer)
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">حساب ربحية المشوار بشكل مستقل وطباعة تقرير</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* INPUTS COLUMN */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
                        {/* Car Selection & Date */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-gray-100 dark:border-slate-700 mb-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2">
                                    <CarIcon className="w-4 h-4 text-slate-400" /> اختر السيارة
                                </label>
                                <select
                                    value={selectedCarId}
                                    onChange={e => setSelectedCarId(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-600 rounded-xl p-3 text-slate-800 dark:text-white focus:border-blue-500 outline-none font-bold"
                                >
                                    <option value="">-- اختر السيارة --</option>
                                    {cars.map(car => (
                                        <option key={car.id} value={car.id}>{car.make} {car.model} ({car.plate_number})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-slate-400" /> تاريخ الرحلة
                                </label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-600 rounded-xl p-3 text-slate-800 dark:text-white focus:border-blue-500 outline-none font-bold"
                                />
                            </div>
                        </div>

                        {/* Inputs */}
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300">
                                        <Gauge className="w-4 h-4 text-blue-500" /> المسافة (كم)
                                    </label>
                                    <input type="number" value={data.km} onChange={e => setData({ ...data, km: e.target.value })} placeholder="0"
                                        className="w-full bg-slate-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-600 rounded-xl p-3 text-slate-800 dark:text-white focus:border-blue-500 outline-none font-bold ltr" />
                                </div>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300">
                                        <DollarSign className="w-4 h-4 text-emerald-500" /> سعر الرحلة (الإيراد)
                                    </label>
                                    <input type="number" value={data.tripIncome} onChange={e => setData({ ...data, tripIncome: e.target.value })} placeholder="0.00"
                                        className="w-full bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30 rounded-xl p-3 text-emerald-700 dark:text-emerald-400 focus:border-emerald-500 outline-none font-bold ltr" />
                                </div>
                            </div>

                            <div className="h-px bg-gray-100 dark:bg-slate-700 my-4"></div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-2">
                                    <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                                        <span className="flex items-center gap-1"><Fuel className="w-3 h-3 text-orange-500" /> بنزين</span>
                                    </label>
                                    <input type="number" value={data.fuelCost} onChange={e => setData({ ...data, fuelCost: e.target.value })} placeholder="0"
                                        className="w-full bg-slate-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-600 rounded-xl p-2.5 text-slate-800 dark:text-white outline-none font-bold" />
                                </div>
                                <div className="space-y-2">
                                    <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                                        <span className="flex items-center gap-1"><Droplet className="w-3 h-3 text-yellow-500" /> زيت</span>
                                    </label>
                                    <input type="number" value={data.oilCost} onChange={e => setData({ ...data, oilCost: e.target.value })} placeholder="0"
                                        className="w-full bg-slate-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-600 rounded-xl p-2.5 text-slate-800 dark:text-white outline-none font-bold" />
                                </div>
                                <div className="space-y-2">
                                    <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                                        <span className="flex items-center gap-1"><Banknote className="w-3 h-3 text-red-500" /> أخرى</span>
                                    </label>
                                    <input type="number" value={data.otherCost} onChange={e => setData({ ...data, otherCost: e.target.value })} placeholder="0"
                                        className="w-full bg-slate-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-600 rounded-xl p-2.5 text-slate-800 dark:text-white outline-none font-bold" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <button onClick={() => setData({ km: '', tripIncome: '', fuelCost: '', oilCost: '', otherCost: '' })} className="px-4 py-3 bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 rounded-xl font-bold transition flex items-center justify-center gap-2">
                            <RefreshCcw className="w-4 h-4" />
                        </button>
                        <button onClick={handlePrint} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg">
                            <Printer className="w-5 h-5" /> استخراج تقرير (نصيحة)
                        </button>
                        <button onClick={handleSaveToLedger} disabled={loading} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20">
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            ترحيل للدفتر
                        </button>
                    </div>
                </div>

                {/* RESULTS COLUMN (The "Advice") */}
                <div className="lg:col-span-1">
                    <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-gray-200 dark:border-slate-700 p-6 shadow-lg h-full relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-purple-500"></div>

                        <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-purple-500" /> ملخص الرحلة
                        </h3>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-slate-800">
                                <span className="text-sm text-slate-500">سعر الرحلة</span>
                                <span className="font-bold text-emerald-500 text-lg">{income.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-slate-800">
                                <span className="text-sm text-slate-500">إجمالي المصاريف</span>
                                <span className="font-bold text-red-500 text-lg">{totalCost.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-slate-800">
                                <span className="text-sm text-slate-500">صافي الربح</span>
                                <span className={`font-bold text-2xl ${netProfit >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600'}`}>
                                    {netProfit.toFixed(2)}
                                </span>
                            </div>

                            {/* Indicators */}
                            <div className="grid grid-cols-2 gap-2 mt-4">
                                <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg text-center">
                                    <div className="text-[10px] text-slate-400">هامش الربح</div>
                                    <div className={`font-bold text-sm ${profitMargin > 30 ? 'text-emerald-500' : 'text-slate-500'}`}>{profitMargin.toFixed(0)}%</div>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg text-center">
                                    <div className="text-[10px] text-slate-400">تكلفة / كم</div>
                                    <div className="font-bold text-sm text-slate-700 dark:text-slate-300">{costPerKm.toFixed(2)}</div>
                                </div>
                            </div>

                            {/* "Advice" Badge */}
                            <div className={`mt-6 p-3 rounded-xl text-center font-bold text-sm border ${netProfit > 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-900/50' :
                                'bg-red-50 border-red-100 text-red-600 dark:bg-red-900/20 dark:border-red-900/50'
                                }`}>
                                {netProfit > 0 ? '✅ رحلة مربحة (ممتازة)' : '⚠️ رحلة خاسرة (انتبه)'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* PRINT TEMPLATE (Visible only when Printing) */}
            {showPrintModal && (
                <div className="fixed inset-0 z-[100] bg-white text-black p-8 print:block hidden overflow-y-auto">
                    <div className="max-w-3xl mx-auto border-2 border-slate-800 p-8 rounded-none h-full">
                        {/* Header */}
                        <div className="flex justify-between items-start border-b-2 border-slate-800 pb-6 mb-8">
                            <div>
                                <h1 className="text-3xl font-bold mb-2">تقرير تحليل رحلة</h1>
                                <p className="text-sm text-slate-600">Trip Cost & Profitability Analysis</p>
                            </div>
                            <div className="text-left">
                                <div className="font-bold text-xl">{selectedCar?.make} {selectedCar?.model}</div>
                                <div className="font-mono text-slate-600 text-lg border border-slate-400 px-2 py-1 mt-1 inline-block rounded">{selectedCar?.plate_number}</div>
                                <div className="text-sm mt-2 text-slate-500">{date}</div>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="grid grid-cols-2 gap-8 mb-8">
                            <div className="border border-slate-300 rounded p-4">
                                <h3 className="font-bold border-b border-slate-200 pb-2 mb-4">التكاليف التشغيلية</h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between"><span>المسافة المقطوعة</span> <span className="font-bold">{km} كم</span></div>
                                    <div className="flex justify-between"><span>تكلفة الوقود</span> <span className="font-bold">{fuel.toFixed(2)}</span></div>
                                    <div className="flex justify-between"><span>تكلفة الزيت</span> <span className="font-bold">{oil.toFixed(2)}</span></div>
                                    <div className="flex justify-between"><span>مصاريف أخرى</span> <span className="font-bold">{other.toFixed(2)}</span></div>
                                    <div className="flex justify-between border-t border-slate-300 pt-2 mt-2 font-bold text-base">
                                        <span>إجمالي التكلفة</span> <span>{totalCost.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="border border-slate-300 rounded p-4 bg-slate-50">
                                <h3 className="font-bold border-b border-slate-200 pb-2 mb-4">ملخص الأرباح</h3>
                                <div className="space-y-4 text-center py-4">
                                    <div>
                                        <div className="text-xs text-slate-500 mb-1">إيراد الرحلة (السعر)</div>
                                        <div className="text-2xl font-bold">{income.toFixed(2)}</div>
                                    </div>
                                    <div className="text-3xl font-bold text-slate-300">-</div>
                                    <div>
                                        <div className="text-xs text-slate-500 mb-1">المصاريف</div>
                                        <div className="text-2xl font-bold text-red-600">{totalCost.toFixed(2)}</div>
                                    </div>
                                    <div className="border-t-2 border-slate-800 pt-4 mt-2">
                                        <div className="text-sm font-bold text-slate-600 mb-1">صافي الربح</div>
                                        <div className={`text-4xl font-bold ${netProfit >= 0 ? 'text-black' : 'text-red-600'}`}>{netProfit.toFixed(2)}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Advice */}
                        <div className="border-t border-slate-300 pt-6">
                            <h4 className="font-bold mb-2">الخلاصة (System Advice):</h4>
                            <p className="text-sm text-slate-600">
                                بناءً على البيانات المدخلة، حققت هذه الرحلة هامش ربح قدره <strong>{profitMargin.toFixed(1)}%</strong>.
                                تكلفة الكيلومتر الواحد كانت <strong>{costPerKm.toFixed(2)}</strong>.
                                {netProfit > 0 ? ' الأداء المالي لهذه الرحلة جيد.' : ' يرجى مراجعة تكاليف التشغيل لهذه الرحلة.'}
                            </p>
                        </div>

                        <div className="mt-12 text-center text-xs text-slate-400">
                            تم الاستخراج بواسطة نظام MyFleet Pro
                        </div>
                    </div>

                    {/* Close Button for Modal (Hidden in Print) */}
                    <button onClick={() => setShowPrintModal(false)} className="fixed top-4 right-4 bg-red-600 text-white p-2 rounded print:hidden">إغلاق</button>
                </div>
            )}
        </div>
    );
};

export default TripCalculator;
