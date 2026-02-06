
import React, { useState, useEffect } from 'react';
import { useOutletContext, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Car, Transaction, ExpenseTemplate } from '../types';
import { LayoutContextType } from './Layout';
import { db } from '../lib/db';
import {
    Plus, TrendingUp, TrendingDown, X, Trash2, Car as CarIcon,
    Edit, FileBarChart, Printer, PieChart, ShieldCheck, Lock, Loader2, Info,
    Download, Search, AlertTriangle, Gauge, CheckCircle, Filter, Calendar, ChevronDown
} from 'lucide-react';

const Inventory: React.FC = () => {
    const location = useLocation();
    const { user, org, isReadOnly, refreshProfile } = useOutletContext<LayoutContextType>();

    const [cars, setCars] = useState<Car[]>([]);
    const [templates, setTemplates] = useState<ExpenseTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [saveLoading, setSaveLoading] = useState(false);

    // Search State
    const [searchTerm, setSearchTerm] = useState('');

    // Default Categories
    const DEFAULT_CAT = {
        income: [
            { id: 'daily_rent', label: 'إيجار يومي' },
            { id: 'monthly_rent', label: 'إيجار شهري' },
            { id: 'other', label: 'إيراد آخر' }
        ],
        expense: [
            { id: 'daily_expense', label: 'مصروف يومي' },
            { id: 'fuel', label: 'وقود' },
            { id: 'maintenance', label: 'صيانة' },
            { id: 'oil', label: 'زيوت' },
            { id: 'washing', label: 'غسيل' },
            { id: 'other', label: 'أخرى' }
        ]
    };

    // Current Active Categories (Prioritize user settings, then org, then default)
    const activeCategories = user?.settings?.transaction_categories || org?.settings?.transaction_categories || DEFAULT_CAT;

    // UI States
    const [showAddCar, setShowAddCar] = useState(false);
    const [showEditCar, setShowEditCar] = useState(false);
    const [showAddTx, setShowAddTx] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [showCatManager, setShowCatManager] = useState<{ show: boolean, type: 'income' | 'expense' }>({ show: false, type: 'income' });
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // Delete Modal State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [targetDeleteId, setTargetDeleteId] = useState<string | null>(null);
    const [deleteType, setDeleteType] = useState<'car' | 'transaction'>('transaction');
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false); // New State for Custom Dropdowns
    // Data Placeholders
    const [currentCar, setCurrentCar] = useState<Car>({
        id: '', make: '', model: '', plate_number: '', year: '',
        license_number: '', license_expiry: '', owner_percentage: 100, driver_percentage: 0,
        current_odometer: 0, status: 'active'
    });

    const [newCar, setNewCar] = useState({
        make: '', model: '', plate_number: '', year: '',
        license_number: '', license_expiry: '', owner_percentage: 100, driver_percentage: 0,
        current_odometer: 0, status: 'active'
    });

    // Report Logic States
    const [selectedReportCar, setSelectedReportCar] = useState<Car | null>(null);
    const [reportFilterType, setReportFilterType] = useState<'all' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'>('all');
    const [reportTxTypeFilter, setReportTxTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number | null>(null); // null = جميع الشهور

    // Transaction Editing State
    const [editingTxId, setEditingTxId] = useState<string | null>(null);

    const [newTx, setNewTx] = useState({
        car_id: '',
        type: 'income' as 'income' | 'expense',
        amount: '',
        category: 'daily_rent',
        notes: '',
        date: new Date().toLocaleDateString('en-CA')
    });

    // Permissions Constants
    const canAddCar = !isReadOnly && (user?.role === 'owner' || user?.permissions?.inventory?.add);
    const canEditCar = !isReadOnly && (user?.role === 'owner' || user?.permissions?.inventory?.edit);
    const canDeleteCar = !isReadOnly && (user?.role === 'owner' || user?.permissions?.inventory?.delete);

    useEffect(() => {
        if (user?.org_id) fetchData(user.org_id);
    }, [user]);

    // Auto-open report if redirected from Dashboard
    useEffect(() => {
        if (location.state?.targetCarId && cars.length > 0) {
            const targetCar = cars.find(c => c.id === location.state.targetCarId);
            if (targetCar) {
                handleOpenReport(targetCar);
                // Clear state to avoid reopening on refresh (optional, but good UX)
                window.history.replaceState({}, '');
            }
        }
    }, [location.state, cars]);

    // --- Helper Functions (Hoisted) ---

    // Defined early to be available for useEffect
    const handleOpenReport = async (car: Car, showLoad = true) => {
        if (showLoad) setLoading(true);
        const { data } = await supabase.from('transactions')
            .select('*')
            .eq('car_id', car.id)
            .order('date', { ascending: false });

        if (data) {
            const carWithHistory = { ...car, history: data as Transaction[] };
            setSelectedReportCar(carWithHistory);
            if (showLoad) {
                setReportFilterType('monthly');
                setShowReportModal(true);
            }
        }
        if (showLoad) setLoading(false);
    };

    const getCategoryLabel = (type: 'income' | 'expense', id: string) => {
        const cats = (activeCategories as any)[type] || [];
        const cat = cats.find((c: any) => c.id === id);
        return cat ? cat.label : id;
    };

    const fetchData = async (orgId: string) => {
        if (!orgId || !user) return;
        setLoading(true);

        let carsData: any[];
        let txData: any[];

        if (navigator.onLine) {
            // Fetch from Supabase
            const { data: remoteCars } = await supabase.from('cars').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
            const { data: remoteTxs } = await supabase.from('transactions').select('car_id, type, amount').eq('org_id', orgId);

            carsData = remoteCars || [];
            txData = remoteTxs || [];

            // Update Local Cache
            if (remoteCars) await db.cars.bulkPut(remoteCars);
        } else {
            carsData = await db.cars.where('org_id').equals(orgId).reverse().toArray();
            txData = await db.transactions.where('org_id').equals(orgId).toArray();
        }

        // Fetch Templates
        let templatesData: any[];
        if (navigator.onLine) {
            const { data } = await supabase.from('expense_templates').select('*').eq('user_id', user?.id);
            templatesData = data || [];
        } else {
            templatesData = await db.expenseTemplates.where('user_id').equals(user.id).toArray();
        }
        setTemplates(templatesData);

        if (carsData) {
            const carsWithStats = carsData.map((c: any) => {
                const carTxs = txData?.filter((t: any) => t.car_id === c.id) || [];
                const income = carTxs.filter((t: any) => t.type === 'income').reduce((sum: number, t: any) => sum + Number(t.amount), 0);
                const expense = carTxs.filter((t: any) => t.type === 'expense').reduce((sum: number, t: any) => sum + Number(t.amount), 0);

                return {
                    ...c,
                    stats: {
                        total_income: income,
                        total_expense: expense,
                        balance: income - expense
                    }
                } as Car;
            });
            setCars(carsWithStats);
        }
        setLoading(false);
    };

    // --- Handlers ---

    const handleOpenAddCar = () => {
        if (isReadOnly || !canAddCar) return;
        if (org && cars.length >= org.max_cars) {
            alert("لقد وصلت للحد الأقصى من السيارات المسموح به في باقتك.");
        } else {
            setNewCar({
                make: '', model: '', plate_number: '', year: '',
                license_number: '', license_expiry: '', owner_percentage: 100, driver_percentage: 0,
                current_odometer: 0, status: 'active'
            });
            setShowAddCar(true);
        }
    };

    const handleOpenEditCar = (car: Car) => {
        if (isReadOnly || !canEditCar) return;
        setCurrentCar({
            ...car,
            owner_percentage: car.owner_percentage ?? 100,
            driver_percentage: car.driver_percentage ?? 0
        });
        setShowEditCar(true);
    };

    const handleAddCar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isReadOnly || !canAddCar || !user?.org_id) return;

        setSaveLoading(true);
        const carId = crypto.randomUUID();
        const carData = {
            id: carId,
            make: newCar.make,
            model: newCar.model,
            plate_number: newCar.plate_number,
            year: newCar.year,
            license_number: newCar.license_number,
            license_expiry: newCar.license_expiry || null,
            owner_percentage: Number(newCar.owner_percentage),
            driver_percentage: Number(newCar.driver_percentage),
            org_id: user.org_id,
            name: `${newCar.make} ${newCar.model}`,
            current_odometer: Number(newCar.current_odometer || 0),
            status: newCar.status || 'active',
            created_at: new Date().toISOString()
        };

        // 1. Save to Local DB
        await db.cars.add(carData as any);

        if (navigator.onLine) {
            // 2. Push to Supabase
            const { error } = await supabase.from('cars').insert(carData);
            if (error) {
                // Queue for later if push failed despite being online
                await db.syncQueue.add({ table: 'cars', action: 'insert', data: carData, timestamp: Date.now() });
            }
        } else {
            // 2. Queue for Sync
            await db.syncQueue.add({ table: 'cars', action: 'insert', data: carData, timestamp: Date.now() });
        }

        setSaveLoading(false);
        setShowAddCar(false);
        fetchData(user.org_id);
    };

    const handleUpdateCar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isReadOnly || !canEditCar) return;

        setSaveLoading(true);

        const { error } = await supabase.from('cars').update({
            make: currentCar.make,
            model: currentCar.model,
            plate_number: currentCar.plate_number,
            year: currentCar.year,
            license_number: currentCar.license_number,
            license_expiry: currentCar.license_expiry || null,
            owner_percentage: Number(currentCar.owner_percentage),
            driver_percentage: Number(currentCar.driver_percentage),
            name: `${currentCar.make} ${currentCar.model}`,
            current_odometer: Number(currentCar.current_odometer || 0),
            status: currentCar.status || 'active'
        })
            .eq('id', currentCar.id)
            .eq('org_id', user?.org_id);

        setSaveLoading(false);

        if (!error) {
            setShowEditCar(false);
            if (user?.org_id) fetchData(user.org_id);
        } else {
            console.error(error);
        }
    };

    const initiateDeleteCar = (id: string) => {
        if (isReadOnly) return;
        if (!canDeleteCar) return;
        setTargetDeleteId(id);
        setDeleteType('car');
        setShowDeleteModal(true);
    };

    const initiateDeleteTransaction = (id: string) => {
        if (isReadOnly) return;
        setTargetDeleteId(id);
        setDeleteType('transaction');
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!targetDeleteId || !user?.org_id) return;

        setSaveLoading(true);
        try {
            if (deleteType === 'car') {
                // Manual Cascade Delete for Car
                await supabase.from('transactions').delete().eq('car_id', targetDeleteId);

                const { error } = await supabase.from('cars').delete()
                    .eq('id', targetDeleteId)
                    .eq('org_id', user.org_id);

                if (!error) {
                    setCars(prev => prev.filter(c => c.id !== targetDeleteId));
                    fetchData(user.org_id);
                    setShowDeleteModal(false);
                    setTargetDeleteId(null);
                } else {
                    throw error;
                }
            } else if (deleteType === 'transaction') {
                // Delete Transaction
                const { error } = await supabase.from('transactions').delete().eq('id', targetDeleteId);

                if (!error) {
                    if (selectedReportCar && showReportModal) {
                        await handleOpenReport(selectedReportCar, false);
                    }
                    if (user?.org_id) fetchData(user.org_id);
                    setShowDeleteModal(false);
                    setTargetDeleteId(null);
                } else {
                    throw error;
                }
            }
        } catch (err: any) {
            console.error(err);
        }
        setSaveLoading(false);
    };

    const handleQuickAction = (carId: string, type: 'income' | 'expense') => {
        if (isReadOnly) return;
        setEditingTxId(null);
        setNewTx({
            ...newTx,
            car_id: carId,
            type: type,
            category: type === 'income' ? 'daily_rent' : 'daily_expense',
            amount: '',
            notes: '',
            date: new Date().toLocaleDateString('en-CA')
        });
        setShowAddTx(true);
    };

    const handleEditTransaction = (tx: Transaction) => {
        if (isReadOnly) return;
        setEditingTxId(tx.id);
        setNewTx({
            car_id: tx.car_id,
            type: tx.type,
            amount: tx.amount.toString(),
            category: tx.category || 'other',
            notes: tx.notes || '',
            date: tx.date
        });
        setShowAddTx(true);
    };

    const handleSaveTx = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isReadOnly) return;
        if (!user || !user.org_id) return;

        setSaveLoading(true);
        const txId = editingTxId || crypto.randomUUID();
        const txData = {
            id: txId,
            org_id: user.org_id,
            user_id: user.id,
            car_id: newTx.car_id,
            type: newTx.type,
            amount: parseFloat(newTx.amount),
            category: newTx.category,
            notes: newTx.notes,
            date: newTx.date,
            created_at: new Date().toISOString()
        };

        // 1. Local Update
        await db.transactions.put(txData as any);

        if (navigator.onLine) {
            const { error } = await supabase.from('transactions').upsert(txData);
            if (error) {
                await db.syncQueue.add({ table: 'transactions', action: editingTxId ? 'update' : 'insert', data: txData, timestamp: Date.now() });
            }
        } else {
            await db.syncQueue.add({ table: 'transactions', action: editingTxId ? 'update' : 'insert', data: txData, timestamp: Date.now() });
        }

        setSaveLoading(false);
        setShowAddTx(false);
        if (showReportModal && selectedReportCar) {
            await handleOpenReport(selectedReportCar, false);
        }
        fetchData(user.org_id);
    };

    const handleUpdateCategories = async (type: 'income' | 'expense', newCategories: { id: string, label: string }[]) => {
        if (!user) return;
        setSaveLoading(true);
        try {
            const currentSettings = user.settings || {};
            const updatedCategories = {
                ...(user.settings?.transaction_categories || (org?.settings?.transaction_categories || DEFAULT_CAT)),
                [type]: newCategories
            };

            const { error } = await supabase
                .from('profiles')
                .update({
                    settings: {
                        ...currentSettings,
                        transaction_categories: updatedCategories
                    }
                })
                .eq('id', user.id);

            if (error) throw error;
            await refreshProfile(); // Force immediate update of context
            setSuccessMsg('تم تحديث التصنيفات بنجاح ✨');
            setTimeout(() => setSuccessMsg(null), 3000);
        } catch (error) {
            console.error('Error updating categories:', error);
            // Elegant error notification would be better too
        } finally {
            setSaveLoading(false);
        }
    };

    const applyTemplate = (template: ExpenseTemplate) => {
        // Resolve Category: Check if it matches an ID in activeCategories, if so use Label, else use raw string
        const cats = (activeCategories as any)[template.type] || [];
        const matchingCat = cats.find((c: any) => c.id === template.category);
        const resolvedCategory = matchingCat ? matchingCat.label : template.category;

        setNewTx({
            ...newTx,
            type: template.type, // Ensure type matches template
            amount: template.amount.toString(),
            category: resolvedCategory,
            notes: template.title + (newTx.notes ? ` - ${newTx.notes}` : ''),
            date: new Date().toLocaleDateString('en-CA') // Force Today
        });
    };

    const getArabicMonthName = (monthIndex: number): string => {
        const months = [
            'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
            'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
        ];
        return months[monthIndex];
    };

    const getAvailableYears = (): number[] => {
        if (!selectedReportCar?.history || selectedReportCar.history.length === 0) {
            return [new Date().getFullYear()];
        }

        // استخراج جميع السنوات من الحركات
        const years = selectedReportCar.history.map(t => new Date(t.date).getFullYear());
        const uniqueYears = Array.from(new Set(years)).sort((a, b) => b - a); // ترتيب تنازلي

        return uniqueYears.length > 0 ? uniqueYears : [new Date().getFullYear()];
    };

    const getMonthlyGroupedData = () => {
        if (!selectedReportCar?.history || reportFilterType !== 'yearly') return null;

        // تجهيز مصفوفة 12 شهر بقيم افتراضية = 0
        const monthlyData = Array.from({ length: 12 }, (_, index) => ({
            monthNumber: index + 1,
            monthName: getArabicMonthName(index),
            income: 0,
            expense: 0,
            net: 0,
            transactions: [] as Transaction[]
        }));

        // تصفية الحركات للسنة المحددة فقط
        const yearTransactions = selectedReportCar.history.filter(t => {
            const txDate = new Date(t.date);
            return txDate.getFullYear() === selectedYear;
        });

        // تطبيق فلتر نوع الحركة (وارد/منصرف/الكل)
        const filteredTx = reportTxTypeFilter !== 'all'
            ? yearTransactions.filter(t => t.type === reportTxTypeFilter)
            : yearTransactions;

        // تجميع الحركات حسب الشهر
        filteredTx.forEach(t => {
            const txDate = new Date(t.date);
            const monthIndex = txDate.getMonth(); // 0-11

            monthlyData[monthIndex].transactions.push(t);

            if (t.type === 'income') {
                monthlyData[monthIndex].income += Number(t.amount);
            } else {
                monthlyData[monthIndex].expense += Number(t.amount);
            }
        });

        // حساب الصافي لكل شهر
        monthlyData.forEach(month => {
            month.net = month.income - month.expense;
        });

        return monthlyData;
    };

    const getFilteredTransactions = () => {
        if (!selectedReportCar?.history) return [];

        let filtered = [...selectedReportCar.history];
        const today = new Date();

        // 1. Filter by Date Range
        if (reportFilterType === 'daily') {
            const todayStr = today.toISOString().split('T')[0];
            filtered = filtered.filter(t => t.date === todayStr);
        } else if (reportFilterType === 'weekly') {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(today.getDate() - 7);
            filtered = filtered.filter(t => new Date(t.date) >= sevenDaysAgo);
        } else if (reportFilterType === 'monthly') {
            // فلتر الشهر: إذا تم اختيار شهر محدد، عرض حركات هذا الشهر فقط
            if (selectedMonth !== null) {
                filtered = filtered.filter(t => {
                    const txDate = new Date(t.date);
                    return txDate.getFullYear() === selectedYear && txDate.getMonth() === selectedMonth;
                });
            } else {
                // عرض الشهر الحالي فقط
                const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                filtered = filtered.filter(t => new Date(t.date) >= startOfMonth);
            }
        } else if (reportFilterType === 'yearly') {
            // فلتر السنة: عرض السنة المختارة
            filtered = filtered.filter(t => new Date(t.date).getFullYear() === selectedYear);
            // } else if (reportFilterType === 'custom' && reportStartDate && reportEndDate) {
            // filtered = filtered.filter(t => t.date >= reportStartDate && t.date <= reportEndDate);
        }

        // 2. Filter by Transaction Type (Income / Expense / All)
        if (reportTxTypeFilter !== 'all') {
            filtered = filtered.filter(t => t.type === reportTxTypeFilter);
        }

        return filtered;
    };

    const handleExportExcel = (filteredData: Transaction[]) => {
        if (!filteredData.length) return;

        const headers = ['التاريخ', 'النوع', 'التصنيف', 'المبلغ', 'ملاحظات'];
        const rows = filteredData.map(t => [
            t.date,
            t.type === 'income' ? 'إيراد' : 'مصروف',
            getCategoryLabel(t.type, t.category || ''),
            t.amount,
            `"${(t.notes || '').replace(/"/g, '""')}"`
        ]);

        const csvContent =
            "\uFEFF" +
            [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `statement_${selectedReportCar?.plate_number}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Filter Cars based on search
    const filteredCars = cars.filter(car =>
        (car.make || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (car.model || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (car.plate_number || '').includes(searchTerm)
    );

    return (
        <div className="space-y-6 font-[Cairo] animate-in fade-in pb-20">

            {/* Header Actions */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">إدارة السيارات</h1>
                    <p className="text-sm text-slate-500">إدارة الأسطول، الرخص، والعمليات المالية</p>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    {canAddCar && (
                        <button onClick={handleOpenAddCar} disabled={isReadOnly} className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition ${isReadOnly ? 'bg-slate-300 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}>
                            {org && cars.length >= org.max_cars ? <Lock className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            إضافة سيارة
                        </button>
                    )}
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute right-3 top-3.5 text-slate-400 w-5 h-5 pointer-events-none" />
                <input
                    type="text"
                    className="w-full bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-slate-700 rounded-xl py-3 pr-10 pl-4 text-slate-800 dark:text-white outline-none focus:border-blue-500 transition shadow-sm"
                    placeholder="بحث برقم اللوحة، الماركة، أو الموديل..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Cars List */}
            {loading && !cars.length ? (
                <div className="flex justify-center items-center h-40">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                    {filteredCars.map(car => {
                        const isLicenseExpired = car.license_expiry && new Date(car.license_expiry) < new Date();
                        const stats = car.stats || { total_income: 0, total_expense: 0, balance: 0 };

                        return (
                            <div key={car.id} className="bg-white dark:bg-[#1e293b] rounded-3xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col relative">
                                <div className="h-2 w-full bg-gradient-to-r from-blue-500 to-indigo-600"></div>

                                {/* Main Click Area */}
                                <div className="p-5 flex-1 cursor-pointer" onClick={() => handleOpenReport(car)}>
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
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${car.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                                                car.status === 'maintenance' ? 'bg-yellow-100 text-yellow-700' :
                                                    car.status === 'rented' ? 'bg-blue-100 text-blue-700' :
                                                        'bg-slate-100 text-slate-700'
                                                }`}>
                                                {car.status === 'active' ? 'نشطة' :
                                                    car.status === 'maintenance' ? 'صيانة' :
                                                        car.status === 'rented' ? 'مؤجرة' : 'غير محدد'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Odometer Display - Enterprise Feature */}
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
                                        <div className={`p-3 rounded-xl border flex flex-col justify-center items-center text-center ${isLicenseExpired ? 'bg-red-50 border-red-100 text-red-600 dark:bg-red-900/10 dark:border-red-900/30' : 'bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-900/10 dark:border-emerald-900/30'}`}>
                                            <span className="text-[10px] font-bold opacity-80 mb-1">رخصة الربط</span>
                                            <div className="font-bold text-sm mb-1">{car.license_number || 'غير مسجل'}</div>
                                            <div className="flex items-center gap-1 font-bold text-[10px]">
                                                {isLicenseExpired ? <Info className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                                                {isLicenseExpired ? 'منتهية' : 'سارية'}
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
                                </div>

                                {/* Quick Actions */}
                                <div className="grid grid-cols-2 border-t border-gray-100 dark:border-slate-700 divide-x divide-x-reverse divide-gray-100 dark:divide-slate-700 relative z-10 bg-white dark:bg-[#1e293b]">
                                    <button onClick={(e) => { e.stopPropagation(); handleQuickAction(car.id, 'income') }} className="py-4 flex flex-col items-center justify-center gap-1 text-sm font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition group/btn">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4 group-hover/btn:scale-110 transition-transform" /> تسجيل وارد
                                        </div>
                                        <span className="text-[10px] text-emerald-600/60 font-normal">إضافة مبلغ</span>
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleQuickAction(car.id, 'expense') }} className="py-4 flex flex-col items-center justify-center gap-1 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition group/btn">
                                        <div className="flex items-center gap-2">
                                            <TrendingDown className="w-4 h-4 group-hover/btn:scale-110 transition-transform" /> تسجيل منصرف
                                        </div>
                                        <span className="text-[10px] text-red-600/60 font-normal">إضافة مبلغ</span>
                                    </button>
                                </div>

                                {/* Footer (Actions) */}
                                <div className="px-5 py-3 bg-gray-50 dark:bg-slate-800/50 flex justify-between items-center border-t border-gray-100 dark:border-slate-700 relative z-10">
                                    <button onClick={() => handleOpenReport(car)} className="text-blue-600 hover:text-blue-700 text-xs font-bold flex items-center gap-1.5 transition hover:underline">
                                        <FileBarChart className="w-3.5 h-3.5" /> عرض التقرير الكامل
                                    </button>

                                    <div className="flex gap-2">
                                        {canEditCar && (
                                            <button onClick={(e) => { e.stopPropagation(); handleOpenEditCar(car) }} className="w-8 h-8 flex items-center justify-center rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-400 hover:text-blue-500 hover:border-blue-500 transition shadow-sm relative z-20 cursor-pointer">
                                                <Edit className="w-4 h-4" />
                                            </button>
                                        )}
                                        {canDeleteCar && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    initiateDeleteCar(car.id);
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
                    })}
                </div>
            )}

            {/* MODALS */}

            {/* 1. ADD / EDIT CAR MODAL */}
            {(showAddCar || showEditCar) && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
                    onClick={(e) => {
                        // Close on backdrop click
                        if (e.target === e.currentTarget) {
                            setShowAddCar(false);
                            setShowEditCar(false);
                        }
                    }}
                >
                    <div className="bg-white dark:bg-[#1e293b] w-[95%] md:w-full max-w-lg rounded-3xl p-5 md:p-8 shadow-2xl border border-gray-200 dark:border-slate-700 animate-in zoom-in-95 my-auto relative">
                        <button
                            onClick={() => { setShowAddCar(false); setShowEditCar(false) }}
                            className="absolute left-4 top-4 p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 transition"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <h3 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white mb-6 border-b border-gray-100 dark:border-slate-700 pb-4 pr-2">
                            {showEditCar ? 'تعديل بيانات السيارة' : 'إضافة سيارة جديدة'}
                        </h3>
                        <form onSubmit={showEditCar ? handleUpdateCar : handleAddCar} className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-1.5 block">الماركة</label>
                                    <input required className="w-full bg-slate-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl p-3.5 outline-none text-slate-800 dark:text-white focus:border-blue-500 font-bold" placeholder="مثال: Toyota"
                                        value={showEditCar ? currentCar.make : newCar.make}
                                        onChange={e => showEditCar ? setCurrentCar({ ...currentCar, make: e.target.value }) : setNewCar({ ...newCar, make: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-1.5 block">الموديل</label>
                                    <input required className="w-full bg-slate-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl p-3.5 outline-none text-slate-800 dark:text-white focus:border-blue-500 font-bold" placeholder="مثال: Camry"
                                        value={showEditCar ? currentCar.model : newCar.model}
                                        onChange={e => showEditCar ? setCurrentCar({ ...currentCar, model: e.target.value }) : setNewCar({ ...newCar, model: e.target.value })} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-1.5 block">رقم اللوحة</label>
                                    <input required className="w-full bg-slate-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl p-3.5 outline-none text-slate-800 dark:text-white focus:border-blue-500 font-bold text-center" placeholder="1234 ABC"
                                        value={showEditCar ? currentCar.plate_number : newCar.plate_number}
                                        onChange={e => showEditCar ? setCurrentCar({ ...currentCar, plate_number: e.target.value }) : setNewCar({ ...newCar, plate_number: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-1.5 block">سنة الصنع</label>
                                    <input required className="w-full bg-slate-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl p-3.5 outline-none text-slate-800 dark:text-white focus:border-blue-500 font-bold text-center" placeholder="2024"
                                        value={showEditCar ? currentCar.year : newCar.year}
                                        onChange={e => showEditCar ? setCurrentCar({ ...currentCar, year: e.target.value }) : setNewCar({ ...newCar, year: e.target.value })} />
                                </div>
                            </div>

                            {/* Status & Odometer (Enterprise) */}
                            <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-1.5 block">حالة السيارة</label>
                                    <select className="w-full bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl p-3 outline-none text-slate-800 dark:text-white text-sm font-bold"
                                        value={showEditCar ? currentCar.status : newCar.status}
                                        // @ts-ignore
                                        onChange={e => showEditCar ? setCurrentCar({ ...currentCar, status: e.target.value }) : setNewCar({ ...newCar, status: e.target.value })}
                                    >
                                        <option value="active">نشطة (Active)</option>
                                        <option value="maintenance">صيانة (Maintenance)</option>
                                        <option value="rented">مؤجرة (Rented)</option>
                                        <option value="out_of_service">خارج الخدمة</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-1.5 block">عداد المسافات (كم)</label>
                                    <input type="number" min="0" className="w-full bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl p-3 outline-none text-slate-800 dark:text-white text-sm font-bold"
                                        value={showEditCar ? (currentCar.current_odometer || 0) : (newCar.current_odometer || 0)}
                                        onChange={e => showEditCar ? setCurrentCar({ ...currentCar, current_odometer: Number(e.target.value) }) : setNewCar({ ...newCar, current_odometer: Number(e.target.value) })} />
                                </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                                <h4 className="text-xs font-bold text-blue-500 mb-4 flex items-center gap-1"><ShieldCheck className="w-4 h-4" /> بيانات الرخصة</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-1.5 block">رقم الرخصة</label>
                                        <input className="w-full bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl p-3 outline-none text-slate-800 dark:text-white text-sm"
                                            value={showEditCar ? currentCar.license_number : newCar.license_number}
                                            onChange={e => showEditCar ? setCurrentCar({ ...currentCar, license_number: e.target.value }) : setNewCar({ ...newCar, license_number: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-1.5 block">تاريخ الانتهاء</label>
                                        <input type="date" className="w-full bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl p-3 outline-none text-slate-800 dark:text-white text-sm"
                                            value={showEditCar ? (currentCar.license_expiry || '') : (newCar.license_expiry || '')}
                                            onChange={e => showEditCar ? setCurrentCar({ ...currentCar, license_expiry: e.target.value }) : setNewCar({ ...newCar, license_expiry: e.target.value })} />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                                <h4 className="text-xs font-bold text-emerald-500 mb-4 flex items-center gap-1"><PieChart className="w-4 h-4" /> نسب الربح</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-1.5 block">نسبة المالك %</label>
                                        <div className="relative">
                                            <input type="number" min="0" max="100" className="w-full bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl p-3 outline-none text-slate-800 dark:text-white text-sm font-bold pl-8"
                                                value={showEditCar ? currentCar.owner_percentage : newCar.owner_percentage}
                                                onChange={e => {
                                                    const val = parseFloat(e.target.value) || 0;
                                                    if (showEditCar) setCurrentCar({ ...currentCar, owner_percentage: val, driver_percentage: 100 - val });
                                                    else setNewCar({ ...newCar, owner_percentage: val, driver_percentage: 100 - val });
                                                }} />
                                            <span className="absolute left-3 top-3 text-slate-400 font-bold">%</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-1.5 block">نسبة السائق % (تلقائي)</label>
                                        <div className="relative">
                                            <input type="number" readOnly className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 outline-none text-slate-500 dark:text-slate-400 text-sm font-bold cursor-not-allowed pl-8"
                                                value={showEditCar ? currentCar.driver_percentage : newCar.driver_percentage} />
                                            <span className="absolute left-3 top-3 text-slate-400 font-bold">%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-8">
                                <button type="button" onClick={() => { setShowAddCar(false); setShowEditCar(false) }} className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-bold transition">إلغاء</button>
                                <button type="submit" disabled={saveLoading} className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 transition">
                                    {saveLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (showEditCar ? 'حفظ التعديلات' : 'إضافة السيارة')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 2. ADD / EDIT TRANSACTION MODAL (Updated Z-Index) */}
            {showAddTx && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setShowAddTx(false);
                    }}
                >
                    <div className="bg-white dark:bg-[#1e293b] w-[95%] md:w-full max-w-sm rounded-2xl p-5 md:p-6 shadow-2xl border border-gray-200 dark:border-slate-700 animate-in zoom-in-95 relative">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg md:text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                {newTx.type === 'income' ? <TrendingUp className="text-emerald-500" /> : <TrendingDown className="text-red-500" />}
                                {editingTxId ? 'تعديل السجل' : (newTx.type === 'income' ? 'تسجيل إيراد' : 'تسجيل مصروف')}
                            </h3>
                            <button
                                onClick={() => setShowAddTx(false)}
                                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            >
                                <X className="w-5 h-5 text-slate-400 hover:text-red-500" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveTx} className="space-y-4">
                            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
                                <span className="text-xs text-slate-500 block mb-1">السيارة المحددة</span>
                                <span className="font-bold text-slate-800 dark:text-white">
                                    {cars.find(c => c.id === newTx.car_id)?.make} {cars.find(c => c.id === newTx.car_id)?.model}
                                </span>
                            </div>

                            {/* Quick Templates Section */}
                            {templates.filter(t => t.is_active && (t.type === newTx.type || (!t.type && newTx.type === 'expense'))).length > 0 && (
                                <div className="mb-4">
                                    <label className="text-xs font-bold text-slate-500 mb-2 block flex items-center gap-1">
                                        <span className={`w-1.5 h-1.5 rounded-full ${newTx.type === 'income' ? 'bg-emerald-500' : 'bg-red-500'} inline-block`}></span>
                                        {newTx.type === 'income' ? 'إيرادات جاهزة (اختر للتعبئة)' : 'مصروفات جاهزة (اختر للتعبئة)'}
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {templates.filter(t => t.is_active && (t.type === newTx.type || (!t.type && newTx.type === 'expense'))).map(t => (
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
                                    <label className="text-xs font-bold text-slate-500 mb-1 block">المبلغ</label>
                                    <input type="number" required min="0" step="0.01" className="w-full bg-slate-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl p-3 outline-none text-slate-800 dark:text-white font-bold focus:border-blue-500" placeholder="0.00" value={newTx.amount} onChange={e => setNewTx({ ...newTx, amount: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-1 block">التاريخ</label>
                                    <input type="date" required className="w-full bg-slate-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl p-3 outline-none text-slate-800 dark:text-white focus:border-blue-500" value={newTx.date} onChange={e => setNewTx({ ...newTx, date: e.target.value })} />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-xs font-bold text-slate-500 block">التصنيف</label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowCatManager({ show: true, type: newTx.type });
                                        }}
                                        className="text-[10px] font-bold text-blue-500 flex items-center gap-1 hover:underline"
                                    >
                                        <Edit className="w-2.5 h-2.5" /> تعديل القائمة
                                    </button>
                                </div>
                                <div className="relative">
                                    <div className="flex items-center">
                                        <input
                                            type="text"
                                            className="w-full bg-slate-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-r-xl p-3 outline-none text-slate-800 dark:text-white focus:border-blue-500 font-bold"
                                            placeholder="اختر أو اكتب..."
                                            value={newTx.category}
                                            onChange={e => setNewTx({ ...newTx, category: e.target.value })}
                                            onFocus={() => setShowCategoryDropdown(true)}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                                            className="px-3 py-3.5 bg-slate-100 dark:bg-slate-800 border-y border-l border-gray-200 dark:border-slate-700 rounded-l-xl text-slate-500 hover:text-blue-500 transition"
                                        >
                                            <ChevronDown className={`w-5 h-5 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} />
                                        </button>
                                    </div>

                                    {showCategoryDropdown && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                                            {(activeCategories as any)[newTx.type].length > 0 ? (
                                                (activeCategories as any)[newTx.type].map((cat: any) => (
                                                    <button
                                                        key={cat.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setNewTx({ ...newTx, category: cat.label });
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
                                <label className="text-xs font-bold text-slate-500 mb-1 block">ملاحظات</label>
                                <textarea className="w-full bg-slate-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl p-3 outline-none text-slate-800 dark:text-white h-20 focus:border-blue-500" placeholder="تفاصيل إضافية..." value={newTx.notes} onChange={e => setNewTx({ ...newTx, notes: e.target.value })}></textarea>
                            </div>

                            <button disabled={saveLoading} className={`w-full py-3 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 ${newTx.type === 'income' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'}`}>
                                {saveLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                {editingTxId ? 'حفظ التعديلات' : (newTx.type === 'income' ? 'حفظ الإيراد' : 'حفظ المصروف')}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* 3. DELETE CONFIRMATION MODAL (Updated Z-Index & Logic) */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-[#1e293b] w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-gray-200 dark:border-slate-700 animate-in zoom-in-95">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
                                <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-500" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">تأكيد الحذف</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed">
                                {deleteType === 'car' ? (
                                    <>
                                        هل أنت متأكد تماماً من حذف هذه السيارة؟ <br />
                                        <span className="text-red-500 font-bold">سيتم حذف جميع السجلات المالية (الوارد والمنصرف) المرتبطة بها نهائياً ولا يمكن التراجع عن هذا الإجراء.</span>
                                    </>
                                ) : (
                                    <>
                                        هل أنت متأكد من حذف هذا السجل المالي؟ <br />
                                        <span className="text-red-500 font-bold">لا يمكن التراجع عن هذا الإجراء.</span>
                                    </>
                                )}
                            </p>
                            <div className="flex gap-3 w-full">
                                <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition">
                                    إلغاء
                                </button>
                                <button onClick={confirmDelete} disabled={saveLoading} className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-900/20 flex items-center justify-center gap-2 transition">
                                    {saveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'نعم، حذف'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 4. FULL SCREEN REPORT & LEDGER (Updated Print Styles) */}
            {showReportModal && selectedReportCar && (
                <div className="fixed inset-0 z-50 bg-white dark:bg-[#0f172a] overflow-y-auto animate-in fade-in flex flex-col print:fixed print:inset-0 print:w-screen print:h-screen print:z-[100] print:bg-white print:block">

                    {/* TOOLBAR */}
                    <div className="sticky top-0 z-40 bg-white/80 dark:bg-[#1e293b]/90 backdrop-blur-md border-b border-gray-200 dark:border-slate-700 shadow-sm p-4 print:hidden">
                        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="w-full md:w-auto flex justify-between items-center gap-4">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setShowReportModal(false)} className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition">
                                        <X className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                                    </button>
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-800 dark:text-white leading-none mb-1">{selectedReportCar.make} {selectedReportCar.model}</h2>
                                        <p className="text-xs text-slate-500 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded inline-block">{selectedReportCar.plate_number}</p>
                                    </div>
                                </div>

                                {/* Mobile Actions Only */}
                                <div className="flex md:hidden gap-2">
                                    <button onClick={() => handleExportExcel(getFilteredTransactions())} className="bg-emerald-50 text-emerald-600 p-2 rounded-lg">
                                        <Download className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="w-full md:w-auto flex flex-col md:flex-row items-center gap-3">
                                {/* Main Filters Row */}
                                <div className="w-full overflow-x-auto pb-1 md:pb-0 flex items-center gap-3 no-scrollbar">
                                    {/* Period Filter */}
                                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
                                        <button onClick={() => setReportFilterType('all')} className={`px-3 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap ${reportFilterType === 'all' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>الكل</button>
                                        <button onClick={() => setReportFilterType('monthly')} className={`px-3 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap ${reportFilterType === 'monthly' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>شهري</button>
                                        <button onClick={() => setReportFilterType('yearly')} className={`px-3 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap ${reportFilterType === 'yearly' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>سنوي</button>
                                    </div>

                                    {/* Year Selector - يظهر مع yearly و monthly */}
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
                                            <div className="absolute top-1/2 right-2 -translate-y-1/2 pointer-events-none text-slate-500">
                                                <Calendar className="w-3.5 h-3.5" />
                                            </div>
                                        </div>
                                    )}

                                    {/* Month Selector - يظهر فقط مع monthly */}
                                    {reportFilterType === 'monthly' && (
                                        <div className="relative shrink-0">
                                            <select
                                                value={selectedMonth === null ? 'all' : selectedMonth}
                                                onChange={(e) => setSelectedMonth(e.target.value === 'all' ? null : Number(e.target.value))}
                                                className="appearance-none min-w-[120px] bg-white dark:bg-slate-800 border-2 border-blue-500/20 dark:border-blue-500/20 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl py-2.5 pr-8 pl-3 outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                            >
                                                <option value="all" className="text-slate-700 dark:text-slate-300">كل الشهور</option>
                                                {Array.from({ length: 12 }, (_, i) => (
                                                    <option key={i} value={i} className="text-slate-700 dark:text-slate-300">{getArabicMonthName(i)}</option>
                                                ))}
                                            </select>
                                            <div className="absolute top-1/2 right-2 -translate-y-1/2 pointer-events-none text-blue-600 dark:text-blue-400">
                                                <Calendar className="w-3.5 h-3.5" />
                                            </div>
                                        </div>
                                    )}

                                    {/* Transaction Type Filter */}
                                    <div className="relative shrink-0">
                                        <select
                                            value={reportTxTypeFilter}
                                            onChange={(e) => setReportTxTypeFilter(e.target.value as 'all' | 'income' | 'expense')}
                                            className="appearance-none min-w-[140px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl py-2.5 pr-8 pl-3 outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer transition hover:bg-slate-200 dark:hover:bg-slate-700"
                                        >
                                            <option value="all">الكل</option>
                                            <option value="income">⬇️ وارد</option>
                                            <option value="expense">⬆️ منصرف</option>
                                        </select>
                                        <div className="absolute top-1/2 right-2 -translate-y-1/2 pointer-events-none text-slate-500">
                                            <Filter className="w-3.5 h-3.5" />
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="hidden md:flex items-center gap-2 shrink-0">
                                    <button onClick={() => handleExportExcel(getFilteredTransactions())} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow hover:shadow-lg transition">
                                        <Download className="w-3.5 h-3.5" /> Excel
                                    </button>
                                    <button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow hover:shadow-lg transition">
                                        <Printer className="w-3.5 h-3.5" /> طباعة
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* REPORT BODY */}
                    <div className="max-w-7xl mx-auto w-full p-4 md:p-8 flex-1 print:p-0 print:max-w-none print:overflow-visible">

                        {/* Header for Print */}
                        <div className="hidden print:flex justify-between items-start mb-8 pb-6 border-b-2 border-slate-800">
                            <div>
                                <h1 className="text-3xl font-bold mb-2 text-black">{org?.name}</h1>
                                <p className="text-sm text-slate-600">{org?.settings?.address}</p>
                                <p className="text-sm text-slate-600">{org?.settings?.phone}</p>
                            </div>
                            <div className="text-left">
                                <div className="text-xl font-bold mb-2">{selectedReportCar.make} {selectedReportCar.model}</div>
                                <div className="font-mono text-lg border border-black px-2 py-1 inline-block">{selectedReportCar.plate_number}</div>
                                <div className="text-xs text-slate-500 mt-2">تاريخ التقرير: {new Date().toLocaleDateString()}</div>
                            </div>
                        </div>

                        {(() => {
                            const monthlyData = getMonthlyGroupedData();
                            const filteredHist = getFilteredTransactions();

                            // حساب الإجماليات
                            let totalIncome = 0;
                            let totalExpense = 0;

                            if (monthlyData) {
                                // إذا كان العرض شهري، احسب من البيانات المجمعة
                                totalIncome = monthlyData.reduce((sum, m) => sum + m.income, 0);
                                totalExpense = monthlyData.reduce((sum, m) => sum + m.expense, 0);
                            } else {
                                // العرض العادي (يومي/أسبوعي/شهري/مخصص)
                                totalIncome = filteredHist.filter((t: any) => t.type === 'income').reduce((sum: number, t: any) => sum + Number(t.amount), 0);
                                totalExpense = filteredHist.filter((t: any) => t.type === 'expense').reduce((sum: number, t: any) => sum + Number(t.amount), 0);
                            }

                            const netProfit = totalIncome - totalExpense;

                            return (
                                <>
                                    {/* Stats Cards */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                                        <div className="bg-emerald-50 dark:bg-emerald-900/10 p-6 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 print:border print:border-slate-300 print:bg-slate-50">
                                            <div className="text-emerald-600 dark:text-emerald-400 text-sm font-bold mb-1 print:text-black">إجمالي الوارد</div>
                                            <div className="text-3xl font-bold text-slate-800 dark:text-white print:text-black">{totalIncome.toLocaleString()}</div>
                                        </div>
                                        <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-2xl border border-red-100 dark:border-red-900/30 print:border print:border-slate-300 print:bg-slate-50">
                                            <div className="text-red-600 dark:text-red-400 text-sm font-bold mb-1 print:text-black">إجمالي المصاريف</div>
                                            <div className="text-3xl font-bold text-slate-800 dark:text-white print:text-black">{totalExpense.toLocaleString()}</div>
                                        </div>
                                        <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-2xl border border-blue-100 dark:border-blue-900/30 print:border print:border-slate-300 print:bg-slate-50">
                                            <div className="text-blue-600 dark:text-blue-400 text-sm font-bold mb-1 print:text-black">الصافي (الباقي)</div>
                                            <div className={`text-3xl font-bold ${netProfit >= 0 ? 'text-slate-800 dark:text-white' : 'text-red-600'} print:text-black`}>
                                                {netProfit.toLocaleString()}
                                            </div>
                                        </div>
                                    </div>

                                    {/* عرض البيانات الشهرية عند اختيار فلتر سنوي */}
                                    {monthlyData ? (
                                        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm print:shadow-none print:border-none print:overflow-visible">
                                            <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800/50 print:bg-transparent">
                                                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 print:text-black">
                                                    <FileBarChart className="w-5 h-5 text-blue-500" /> التقرير الشهري للعام {new Date().getFullYear()}
                                                </h3>
                                                <span className="text-xs font-bold bg-white dark:bg-slate-700 px-2 py-1 rounded-lg text-slate-500 border border-slate-200 dark:border-slate-600">
                                                    {monthlyData.filter(m => m.transactions.length > 0).length} شهر به حركات
                                                </span>
                                            </div>
                                            {/* Desktop Table View */}
                                            <div className="hidden md:block overflow-x-auto print:block print:overflow-visible">
                                                <table className="w-full text-right text-sm">
                                                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700 print:bg-slate-200 print:text-black">
                                                        <tr>
                                                            <th className="p-4 whitespace-nowrap">الشهر</th>
                                                            <th className="p-4 text-left">الوارد</th>
                                                            <th className="p-4 text-left">المنصرف</th>
                                                            <th className="p-4 text-left">الصافي</th>
                                                            <th className="p-4 text-center">عدد الحركات</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700 print:divide-slate-300">
                                                        {monthlyData.map(month => (
                                                            <tr key={month.monthNumber} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition print:text-black">
                                                                <td className="p-4 font-bold text-slate-700 dark:text-slate-300 print:text-black">
                                                                    {month.monthName}
                                                                </td>
                                                                <td className="p-4 text-left font-bold font-mono text-emerald-600 dark:text-emerald-400 print:text-black">
                                                                    {month.income.toLocaleString()}
                                                                </td>
                                                                <td className="p-4 text-left font-bold font-mono text-red-600 dark:text-red-400 print:text-black">
                                                                    {month.expense.toLocaleString()}
                                                                </td>
                                                                <td className={`p-4 text-left font-bold font-mono ${month.net >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600'} print:text-black`}>
                                                                    {month.net.toLocaleString()}
                                                                </td>
                                                                <td className="p-4 text-center text-slate-500 dark:text-slate-400 print:text-black">
                                                                    {month.transactions.length}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    <tfoot className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2 border-slate-300 dark:border-slate-600 print:bg-slate-200">
                                                        <tr>
                                                            <td className="p-4 text-slate-800 dark:text-white print:text-black">الإجمالي</td>
                                                            <td className="p-4 text-left text-emerald-600 dark:text-emerald-400 print:text-black">
                                                                {totalIncome.toLocaleString()}
                                                            </td>
                                                            <td className="p-4 text-left text-red-600 dark:text-red-400 print:text-black">
                                                                {totalExpense.toLocaleString()}
                                                            </td>
                                                            <td className={`p-4 text-left ${netProfit >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600'} print:text-black`}>
                                                                {netProfit.toLocaleString()}
                                                            </td>
                                                            <td className="p-4 text-center text-slate-500 print:text-black">
                                                                {monthlyData.reduce((sum, m) => sum + m.transactions.length, 0)}
                                                            </td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                            {/* Mobile Cards View */}
                                            <div className="md:hidden print:hidden">
                                                <div className="divide-y divide-gray-100 dark:divide-slate-700">
                                                    {monthlyData.map(month => (
                                                        <div key={month.monthNumber} className="p-4">
                                                            <div className="font-bold text-slate-800 dark:text-white mb-3">
                                                                {month.monthName}
                                                            </div>
                                                            <div className="grid grid-cols-3 gap-3 text-center">
                                                                <div className="bg-emerald-50 dark:bg-emerald-900/10 p-3 rounded-xl">
                                                                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mb-1">الوارد</div>
                                                                    <div className="font-bold text-sm text-slate-800 dark:text-white">
                                                                        {month.income.toLocaleString()}
                                                                    </div>
                                                                </div>
                                                                <div className="bg-red-50 dark:bg-red-900/10 p-3 rounded-xl">
                                                                    <div className="text-[10px] text-red-600 dark:text-red-400 font-bold mb-1">المنصرف</div>
                                                                    <div className="font-bold text-sm text-slate-800 dark:text-white">
                                                                        {month.expense.toLocaleString()}
                                                                    </div>
                                                                </div>
                                                                <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-xl">
                                                                    <div className="text-[10px] text-blue-600 dark:text-blue-400 font-bold mb-1">الصافي</div>
                                                                    <div className={`font-bold text-sm ${month.net >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600'}`}>
                                                                        {month.net.toLocaleString()}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="text-xs text-slate-500 text-center mt-2">
                                                                {month.transactions.length} حركة
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        // العرض العادي (الجدول الحالي للحركات الفردية)
                                        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm print:shadow-none print:border-none print:overflow-visible">
                                            <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800/50 print:bg-transparent">
                                                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 print:text-black">
                                                    <FileBarChart className="w-5 h-5 text-blue-500" /> سجل الحركات
                                                </h3>
                                                <span className="text-xs font-bold bg-white dark:bg-slate-700 px-2 py-1 rounded-lg text-slate-500 border border-slate-200 dark:border-slate-600">{filteredHist.length} عمليات</span>
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
                                                        {filteredHist.map(t => (
                                                            <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition group print:text-black">
                                                                <td className="p-4 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap print:text-black">{t.date}</td>
                                                                <td className="p-4">
                                                                    <span className={`px-2 py-1 rounded text-xs font-bold inline-flex items-center gap-1 ${t.type === 'income' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-red-50 text-red-600 dark:bg-red-900/20'} print:bg-transparent print:text-black print:border print:border-slate-400`}>
                                                                        {t.type === 'income' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                                        {t.type === 'income' ? 'وارد' : 'منصرف'}
                                                                    </span>
                                                                </td>
                                                                <td className="p-4 text-slate-700 dark:text-slate-300 print:text-black font-medium">
                                                                    {getCategoryLabel(t.type, t.category || '')}
                                                                </td>
                                                                <td className="p-4 text-slate-500 dark:text-slate-400 text-xs print:text-black">{t.notes || '-'}</td>
                                                                <td className="p-4 text-left font-bold font-mono text-base">
                                                                    <span className={t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                                                                        {Number(t.amount).toLocaleString()}
                                                                    </span>
                                                                </td>
                                                                <td className="p-4 flex justify-center gap-2 print:hidden opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <button onClick={() => handleEditTransaction(t)} className="p-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100 rounded transition" title="تعديل">
                                                                        <Edit className="w-4 h-4" />
                                                                    </button>
                                                                    <button onClick={() => initiateDeleteTransaction(t.id)} className="p-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100 rounded transition" title="حذف">
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {filteredHist.length === 0 && (
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
                                                    {filteredHist.map(t => (
                                                        <div key={t.id} onClick={() => handleEditTransaction(t)} className="p-4 active:bg-slate-50 dark:active:bg-slate-800/50 transition cursor-pointer">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${t.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                                                        {t.type === 'income' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-sm font-bold text-slate-800 dark:text-white">
                                                                            {getCategoryLabel(t.type, t.category || '')}
                                                                        </div>
                                                                        <div className="text-[10px] text-slate-500 font-mono">{t.date}</div>
                                                                    </div>
                                                                </div>
                                                                <span className={`text-lg font-bold font-mono ${t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                                    {Number(t.amount).toLocaleString()}
                                                                </span>
                                                            </div>

                                                            {(t.notes) && (
                                                                <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg mb-2 line-clamp-2">
                                                                    {t.notes}
                                                                </div>
                                                            )}

                                                            <div className="flex justify-end gap-2 mt-2">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleEditTransaction(t); }}
                                                                    className="flex items-center gap-1 text-[10px] bg-blue-50 text-blue-600 px-2.5 py-1.5 rounded-lg font-bold"
                                                                >
                                                                    <Edit className="w-3 h-3" /> تعديل
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); initiateDeleteTransaction(t.id); }}
                                                                    className="flex items-center gap-1 text-[10px] bg-red-50 text-red-600 px-2.5 py-1.5 rounded-lg font-bold"
                                                                >
                                                                    <Trash2 className="w-3 h-3" /> حذف
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {filteredHist.length === 0 && (
                                                        <div className="p-10 text-center text-slate-400 text-sm flex flex-col items-center">
                                                            <FileBarChart className="w-10 h-10 text-slate-200 mb-2" />
                                                            لا توجد سجلات لعرضها
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </div>

                    {/* Simple Elegant Notification Toast */}
                    {successMsg && (
                        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-bottom-5">
                            <div className="bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-xl font-bold flex items-center gap-2">
                                <CheckCircle className="w-4 h-4" /> {successMsg}
                            </div>
                        </div>
                    )}

                    {/* Print Footer */}
                    <div className="hidden print:block p-8 border-t-2 border-slate-800 text-center text-xs mt-auto">
                        {org?.settings?.footer_text || 'تقرير مالي - نظام إدارة الأسطول'}
                    </div>
                </div>
            )}

            {/* 6. CATEGORY MANAGER MODAL (Refactored for Performance) */}
            {showCatManager.show && (
                <CategoryManagerModal
                    type={showCatManager.type}
                    initialCats={[...(activeCategories as any)[showCatManager.type]]}
                    onClose={() => setShowCatManager({ ...showCatManager, show: false })}
                    onSave={async (newCats) => {
                        await handleUpdateCategories(showCatManager.type, newCats);
                        setShowCatManager({ ...showCatManager, show: false });
                    }}
                />
            )}
        </div>
    );
};

// Sub-component for Category Management to avoid Lag
const CategoryManagerModal: React.FC<{
    type: 'income' | 'expense';
    initialCats: { id: string, label: string }[];
    onClose: () => void;
    onSave: (cats: { id: string, label: string }[]) => Promise<void>;
}> = ({ type, initialCats, onClose, onSave }) => {
    const [cats, setCats] = React.useState(initialCats);
    const [saving, setSaving] = React.useState(false);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#1e293b] w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-gray-200 dark:border-slate-700 animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white">إدارة تصنيفات {type === 'income' ? 'الوارد' : 'المنصرف'}</h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
                </div>

                <div className="space-y-3 mb-6 max-h-60 overflow-y-auto pr-1">
                    {cats.map((cat, idx) => (
                        <div key={cat.id} className="flex gap-2 items-center">
                            <input
                                className="flex-1 bg-slate-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-800 dark:text-white font-bold outline-none focus:border-blue-500 transition"
                                value={cat.label}
                                autoFocus={idx === cats.length - 1 && cat.id.startsWith('custom_')}
                                placeholder="اسم التصنيف..."
                                onChange={(e) => {
                                    const newCats = [...cats];
                                    newCats[idx].label = e.target.value;
                                    setCats(newCats);
                                }}
                            />
                            <button
                                onClick={() => setCats(cats.filter((_, i) => i !== idx))}
                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    {cats.length === 0 && (
                        <div className="text-center py-4 text-slate-400 text-xs">لا توجد تصنيفات حالياً</div>
                    )}
                </div>

                <button
                    onClick={() => setCats([...cats, { id: `custom_${Date.now()}`, label: '' }])}
                    className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 hover:text-blue-500 hover:border-blue-500 transition font-bold text-sm bg-slate-50/50 dark:bg-slate-800/30"
                >
                    <Plus className="w-4 h-4" /> إضافة تصنيف جديد
                </button>

                <div className="flex gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-bold transition hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                        إلغاء
                    </button>
                    <button
                        disabled={saving}
                        onClick={async () => {
                            setSaving(true);
                            await onSave(cats);
                            setSaving(false);
                        }}
                        className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                    >
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        حفظ التعديلات
                    </button>
                </div>
            </div>
        </div>
    );
};


export default Inventory;
