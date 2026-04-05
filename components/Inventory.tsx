import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useOutletContext, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { 
    Car, Transaction, ExpenseTemplate, 
    TransactionCategories, TransactionCategory 
} from '../types';
import { LayoutContextType } from './Layout';
import { db, LocalCar, LocalTransaction } from '../lib/db';
import {
    Plus, Search, Loader2, CheckCircle, Lock
} from 'lucide-react';

// --- Sub-components (Extracted) ---
import CarCard from './inventory/CarCard';
import AddEditCarModal from './inventory/AddEditCarModal';
import AddEditTransactionModal from './inventory/AddEditTransactionModal';
import ReportModal from './inventory/ReportModal';
import DeleteConfirmationModal from './inventory/DeleteConfirmationModal';
import CategoryManagerModal from './inventory/CategoryManagerModal';

/**
 * Inventory Component
 * Manages the fleet of cars, including their technical data and financial transactions.
 * Extracted into modular sub-components for better maintainability and performance.
 */
const Inventory: React.FC = () => {
    const location = useLocation();
    const { user, org, isReadOnly, refreshProfile } = useOutletContext<LayoutContextType>();

    // --- State Management ---
    const [cars, setCars] = useState<Car[]>([]);
    const [templates, setTemplates] = useState<ExpenseTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [saveLoading, setSaveLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // Modals Visibility
    const [showAddCar, setShowAddCar] = useState(false);
    const [showEditCar, setShowEditCar] = useState(false);
    const [showAddTx, setShowAddTx] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [showCatManager, setShowCatManager] = useState<{ show: boolean, type: 'income' | 'expense' }>({ show: false, type: 'income' });
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

    // Selected / Editing Data
    const [currentCar, setCurrentCar] = useState<Car>({
        id: '', make: '', model: '', plate_number: '', year: '',
        license_number: '', license_expiry: '', owner_percentage: 100, driver_percentage: 0,
        current_odometer: 0, status: 'active'
    });

    const [newCar, setNewCar] = useState<Partial<Car>>({
        make: '', model: '', plate_number: '', year: '',
        license_number: '', license_expiry: '', owner_percentage: 100, driver_percentage: 0,
        current_odometer: 0, status: 'active'
    });

    const [newTx, setNewTx] = useState<Partial<Transaction>>({
        car_id: '', type: 'income', amount: 0, category: 'daily_rent', notes: '',
        date: new Date().toISOString().split('T')[0]
    });

    const [selectedReportCar, setSelectedReportCar] = useState<Car | null>(null);
    const [editingTxId, setEditingTxId] = useState<string | null>(null);
    const [targetDeleteId, setTargetDeleteId] = useState<string | null>(null);
    const [deleteType, setDeleteType] = useState<'car' | 'transaction'>('transaction');

    // --- Computed Values ---
    const DEFAULT_CAT: TransactionCategories = useMemo(() => ({
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
    }), []);

    const activeCategories: TransactionCategories = useMemo(() => 
        user?.settings?.transaction_categories || org?.settings?.transaction_categories || DEFAULT_CAT,
    [user, org, DEFAULT_CAT]);

    const canAddCar = !isReadOnly && (user?.role === 'owner' || user?.permissions?.inventory?.add);
    const canEditCar = !isReadOnly && (user?.role === 'owner' || user?.permissions?.inventory?.edit);
    const canDeleteCar = !isReadOnly && (user?.role === 'owner' || user?.permissions?.inventory?.delete);

    // --- Data Fetching ---
    const fetchData = useCallback(async (orgId: string) => {
        if (!orgId || !user) return;
        setLoading(true);
        const controller = new AbortController();

        try {
            const [carsRes, txRes, templatesRes] = await Promise.all([
                supabase.from('cars').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).abortSignal(controller.signal),
                supabase.from('transactions').select('car_id, type, amount').eq('org_id', orgId).is('deleted_at', null).abortSignal(controller.signal),
                supabase.from('expense_templates').select('*').eq('user_id', user.id).abortSignal(controller.signal)
            ]);

            if (carsRes.data && txRes.data) {
                const txData = txRes.data as Transaction[];
                const carsWithStats = (carsRes.data as Car[]).map(c => {
                    const carTxs = txData.filter(t => t.car_id === c.id);
                    const income = carTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
                    const expense = carTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
                    return { ...c, stats: { total_income: income, total_expense: expense, balance: income - expense } };
                });
                setCars(carsWithStats);
                await db.cars.bulkPut(carsRes.data as LocalCar[]);
            }
            if (templatesRes.data) setTemplates(templatesRes.data as ExpenseTemplate[]);
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (user?.org_id) fetchData(user.org_id);
    }, [user, fetchData]);

    // Auto-open report if redirected from Dashboard
    useEffect(() => {
        if (location.state?.targetCarId && cars.length > 0) {
            const targetCar = cars.find((c: Car) => c.id === location.state.targetCarId);
            if (targetCar) {
                handleOpenReport(targetCar);
                globalThis.history.replaceState({}, '');
            }
        }
    }, [location.state, cars]);

    // --- Action Handlers ---
    const handleOpenAddCar = useCallback(() => {
        if (isReadOnly || !canAddCar) return;
        if (org && cars.length >= org.max_cars) {
            alert("لقد وصلت للحد الأقصى من السيارات المسموح به في باقتك.");
            return;
        }
        setNewCar({
            make: '', model: '', plate_number: '', year: '',
            license_number: '', license_expiry: '', owner_percentage: 100, driver_percentage: 0,
            current_odometer: 0, status: 'active'
        });
        setShowAddCar(true);
    }, [isReadOnly, canAddCar, org, cars.length]);

    const handleOpenEditCar = useCallback((car: Car) => {
        if (isReadOnly || !canEditCar) return;
        setCurrentCar({
            ...car,
            owner_percentage: car.owner_percentage ?? 100,
            driver_percentage: car.driver_percentage ?? 0
        });
        setShowEditCar(true);
    }, [isReadOnly, canEditCar]);

    const handleAddCar = async (e: React.FormEvent) => {
        e.preventDefault();
        const targetOrgId = user?.org_id || org?.id;
        if (isReadOnly) {
            alert("لا يمكنك إضافة سيارة لأن حسابك في وضع القراءة فقط.");
            return;
        }
        if (!canAddCar) {
            alert("ليس لديك صلاحية لإضافة سيارة.");
            return;
        }
        if (!targetOrgId) {
            alert(`حدث خطأ: لم يتم التعرف على معرف المؤسسة الخاص بك. user.org_id=${user?.org_id}, org.id=${org?.id}`);
            return;
        }
        setSaveLoading(true);
        try {
            const carId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') 
                ? crypto.randomUUID() 
                : `car-${Date.now()}-${Math.floor(Math.random()*1000000)}`;
            const carData = {
                ...newCar,
                id: carId,
                org_id: targetOrgId,
                name: `${newCar.make} ${newCar.model}`,
                license_expiry: newCar.license_expiry || null,
                created_at: new Date().toISOString()
            };
            await db.cars.add({ ...carData, last_updated: Date.now() } as LocalCar);
            if (navigator.onLine) {
                const { error } = await supabase.from('cars').insert(carData);
                if (error) {
                    console.error("Supabase Error details:", error);
                    throw new Error(`خطأ من الخادم (${error.code}): ${error.message}`);
                }
            }
            setShowAddCar(false);
            fetchData(targetOrgId);
        } catch (error) {
            console.error("Error saving car:", error);
            alert("حدث خطأ أثناء الحفظ: " + (error instanceof Error ? error.message : "يرجى المحاولة مرة أخرى."));
        } finally {
            setSaveLoading(false);
        }
    };

    const handleUpdateCar = async (e: React.FormEvent) => {
        e.preventDefault();
        const targetOrgId = user?.org_id || org?.id;
        if (isReadOnly || !canEditCar || !targetOrgId) return;
        setSaveLoading(true);
        try {
            const updatePayload = {
                ...currentCar,
                name: `${currentCar.make} ${currentCar.model}`,
                license_expiry: currentCar.license_expiry || null
            };
            if ('last_updated' in updatePayload) {
                delete (updatePayload as any).last_updated;
            }
            const { error } = await supabase.from('cars').update(updatePayload).eq('id', currentCar.id);
            if (!error) {
                setShowEditCar(false);
                fetchData(targetOrgId);
            } else {
                console.error("Supabase Error updating car:", error);
                alert(`حدث خطأ أثناء التحديث (${error.code}): ${error.message}`);
            }
        } catch (error) {
            console.error("Error updating car:", error);
            alert("حدث خطأ غير متوقع أثناء التحديث.");
        } finally {
            setSaveLoading(false);
        }
    };

    const initiateDeleteCar = useCallback((id: string) => {
        if (isReadOnly || !canDeleteCar) return;
        setTargetDeleteId(id);
        setDeleteType('car');
        setShowDeleteModal(true);
    }, [isReadOnly, canDeleteCar]);

    const initiateDeleteTransaction = useCallback((id: string) => {
        if (isReadOnly) return;
        setTargetDeleteId(id);
        setDeleteType('transaction');
        setShowDeleteModal(true);
    }, [isReadOnly]);

    const confirmDelete = async () => {
        if (!targetDeleteId || !user?.org_id) return;
        setSaveLoading(true);
        try {
            if (deleteType === 'car') {
                await supabase.from('transactions').delete().eq('car_id', targetDeleteId);
                await supabase.from('cars').delete().eq('id', targetDeleteId);
            } else {
                await supabase.from('transactions').update({ deleted_at: new Date().toISOString() }).eq('id', targetDeleteId);
            }
            fetchData(user.org_id);
            setShowDeleteModal(false);
            setTargetDeleteId(null);
            if (deleteType === 'transaction') setSuccessMsg('تم النقل إلى السلة ✨');
        } catch (err) { console.error(err); }
        setSaveLoading(false);
    };

    const handleOpenReport = useCallback(async (car: Car) => {
        setLoading(true);
        const { data } = await supabase.from('transactions')
            .select('*')
            .eq('car_id', car.id)
            .is('deleted_at', null)
            .order('date', { ascending: false });

        if (data) {
            const carWithHistory = { ...car, history: data as Transaction[] };
            setSelectedReportCar(carWithHistory);
            setShowReportModal(true);
        }
        setLoading(false);
    }, []);

    const handleQuickAction = useCallback((carId: string, type: 'income' | 'expense') => {
        if (isReadOnly) return;
        setEditingTxId(null);
        setNewTx({
            car_id: carId,
            type,
            amount: 0,
            category: type === 'income' ? 'daily_rent' : 'daily_expense',
            notes: '',
            date: new Date().toISOString().split('T')[0]
        });
        setShowAddTx(true);
    }, [isReadOnly]);

    const handleEditTransaction = useCallback((tx: Transaction) => {
        if (isReadOnly) return;
        setEditingTxId(tx.id || null);
        setNewTx({ ...tx });
        setShowAddTx(true);
    }, [isReadOnly]);

    const handleSaveTx = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isReadOnly || !user?.org_id) return;

        const amount = Number(newTx.amount) || 0;
        if (amount <= 0) {
            alert('يرجى إدخال مبلغ صحيح أكبر من الصفر');
            return;
        }

        setSaveLoading(true);
        try {
            const targetOrgId = user?.org_id || org?.id;
            const txId = editingTxId || (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `tx-${Date.now()}-${Math.floor(Math.random()*1000000)}`);
            const txData = {
                ...newTx,
                amount,
                id: txId,
                org_id: targetOrgId,
                user_id: user?.id || '',
                created_at: newTx.created_at || new Date().toISOString()
            };
            
            await db.transactions.put({ ...txData, last_updated: Date.now() } as LocalTransaction);
            
            if (navigator.onLine) {
                const { error } = await supabase.from('transactions').upsert(txData);
                if (error) throw error;
            }
            fetchData(targetOrgId || '');
            setShowAddTx(false);
            setSuccessMsg(editingTxId ? 'تم تعديل السجل بنجاح ✨' : (newTx.type === 'income' ? 'تم حفظ الإيراد بنجاح ✨' : 'تم حفظ المصروف بنجاح ✨'));
            setTimeout(() => setSuccessMsg(null), 3000);
            if (showReportModal && selectedReportCar) {
                await handleOpenReport(selectedReportCar);
            }
        } catch (err) {
            console.error(err);
            alert('حدث خطأ أثناء الحفظ، يرجى المحاولة مرة أخرى');
        } finally {
            setSaveLoading(false);
        }
    };

    const handleUpdateCategories = async (type: 'income' | 'expense', newCategories: TransactionCategory[]) => {
        if (!user) return;
        setSaveLoading(true);
        try {
            const updatedCategories = {
                ...(user.settings?.transaction_categories || activeCategories),
                [type]: newCategories
            };

            const { error } = await supabase
                .from('profiles')
                .update({
                    settings: {
                        ...user.settings,
                        transaction_categories: updatedCategories
                    }
                })
                .eq('id', user.id);

            if (error) throw error;
            await refreshProfile();
            setSuccessMsg('تم تحديث التصنيفات بنجاح ✨');
            setTimeout(() => setSuccessMsg(null), 3000);
        } catch (error) {
            console.error('Error updating categories:', error);
        } finally {
            setSaveLoading(false);
        }
    };

    const applyTemplate = useCallback((template: ExpenseTemplate) => {
        setNewTx((prev: Partial<Transaction>) => ({
            ...prev,
            type: template.type,
            amount: template.amount,
            category: template.category,
            notes: (template.title || '') + (prev.notes ? ` - ${prev.notes}` : ''),
            date: prev.date || new Date().toISOString().split('T')[0]
        }));
    }, []);

    // --- Helpers ---
    const getCategoryLabel = useCallback((type: 'income' | 'expense', id: string): string => {
        const cats = activeCategories[type] || [];
        const cat = cats.find((c: TransactionCategory) => c.id === id);
        if (cat) return cat.label;
        const otherType = type === 'income' ? 'expense' : 'income';
        const otherCats = activeCategories[otherType] || [];
        const otherCat = otherCats.find((c: TransactionCategory) => c.id === id);
        if (otherCat) return otherCat.label;
        return id;
    }, [activeCategories]);

    const filteredCars = useMemo(() => cars.filter(car =>
        (car.make || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (car.model || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (car.plate_number || '').includes(searchTerm)
    ), [cars, searchTerm]);

    // --- Render ---
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
                    {filteredCars.map(car => (
                        <CarCard
                            key={car.id}
                            car={car}
                            canEdit={!!canEditCar}
                            canDelete={!!canDeleteCar}
                            isReadOnly={isReadOnly}
                            onOpenReport={handleOpenReport}
                            onQuickAction={handleQuickAction}
                            onEdit={handleOpenEditCar}
                            onDelete={initiateDeleteCar}
                        />
                    ))}
                </div>
            )}

            {/* Modals Container */}
            <AddEditCarModal
                isOpen={showAddCar || showEditCar}
                isEdit={showEditCar}
                saveLoading={saveLoading}
                car={showEditCar ? currentCar : newCar}
                onCarChange={(updates) => {
                    if (showEditCar) setCurrentCar({ ...currentCar, ...updates });
                    else setNewCar({ ...newCar, ...updates });
                }}
                onClose={() => { setShowAddCar(false); setShowEditCar(false); }}
                onSubmit={showEditCar ? handleUpdateCar : handleAddCar}
            />

            <AddEditTransactionModal
                isOpen={showAddTx}
                isEdit={!!editingTxId}
                saveLoading={saveLoading}
                tx={newTx as Transaction}
                cars={cars}
                templates={templates}
                activeCategories={activeCategories}
                showCategoryDropdown={showCategoryDropdown}
                setShowCategoryDropdown={setShowCategoryDropdown}
                onTxChange={(updates) => setNewTx({ ...newTx, ...updates })}
                onClose={() => setShowAddTx(false)}
                onSave={handleSaveTx}
                applyTemplate={applyTemplate}
                getCategoryLabel={getCategoryLabel}
                onEditCategories={(type) => setShowCatManager({ show: true, type })}
            />

            <DeleteConfirmationModal
                isOpen={showDeleteModal}
                saveLoading={saveLoading}
                deleteType={deleteType}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={confirmDelete}
            />

            {showReportModal && selectedReportCar && (
                <ReportModal
                    car={selectedReportCar}
                    org={org}
                    onClose={() => setShowReportModal(false)}
                    getCategoryLabel={getCategoryLabel}
                    onEditTransaction={handleEditTransaction}
                    onDeleteTransaction={initiateDeleteTransaction}
                    fetchHistory={(car) => handleOpenReport(car)}
                />
            )}

            {showCatManager.show && (
                <CategoryManagerModal
                    type={showCatManager.type}
                    initialCats={[...activeCategories[showCatManager.type]]}
                    onClose={() => setShowCatManager({ ...showCatManager, show: false })}
                    onSave={async (newCats) => {
                        await handleUpdateCategories(showCatManager.type, newCats);
                        setShowCatManager({ ...showCatManager, show: false });
                    }}
                />
            )}

            {/* Success Toast */}
            {successMsg && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-bottom-5">
                    <div className="bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-xl font-bold flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" /> {successMsg}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventory;
