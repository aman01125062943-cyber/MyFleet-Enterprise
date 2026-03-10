import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Asset, Car, Driver, Transaction } from '../types';
import { Plus, Car as CarIcon, Truck, Building, FileText, Trash2, Edit, TrendingUp, TrendingDown, Wallet } from 'lucide-react';

const Assets: React.FC = () => {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [cars, setCars] = useState<Car[]>([]);
    const [drivers, setDrivers] = useState<Driver[]>([]);

    // New States for User Assignment
    const [orgUsers, setOrgUsers] = useState<{ id: string, full_name: string }[]>([]);

    // Driver Management State
    const [showDriverModal, setShowDriverModal] = useState(false);
    const [newDriver, setNewDriver] = useState({ full_name: '', phone_number: '', license_number: '' });
    const [driverActionLoading, setDriverActionLoading] = useState(false);


    const [currentUserRole, setCurrentUserRole] = useState<string>('');
    const [currentUser, setCurrentUser] = useState<{ id: string, org_id: string, role: string } | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<Asset>>({
        asset_type: 'car',
        status: 'active',
        purchase_price: 0,
        current_value: 0
    });

    useEffect(() => {
        fetchCurrentUser();
    }, []);

    // 🔒 Security Fix: Only fetch data AFTER currentUser is fully loaded
    useEffect(() => {
        if (currentUser) {
            fetchAssets();
            fetchCars();
            fetchDrivers();
            fetchOrgUsers();
        } else if (currentUser === null && !loading) {
            // Optional: Handle case where user is not logged in / failed to load
        }
    }, [currentUser]);

    const fetchCurrentUser = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            const { data } = await supabase.from('profiles').select('id, org_id, role').eq('id', session.user.id).maybeSingle();
            if (data) {
                setCurrentUserRole(data.role || '');
                setCurrentUser(data);
            }
        }
    };

    const fetchOrgUsers = async () => {
        // Get current user from localStorage as fallback
        const session = JSON.parse(localStorage.getItem('securefleet_session') || '{}');
        const userOrgId = currentUser?.org_id || session.org_id;

        let query = supabase.from('profiles').select('id, full_name').neq('status', 'disabled');

        if (userOrgId) {
            query = query.eq('org_id', userOrgId);
        } else {
            // 🔒 Fix: If Super Admin (no org_id), ONLY fetch platform staff (no org_id), 
            // do NOT show users from other organizations to preserve privacy.
            query = query.is('org_id', null);
        }

        const { data } = await query;
        if (data) setOrgUsers(data);
    };

    const fetchAssets = async () => {
        try {
            // Get current user from localStorage as fallback
            const session = JSON.parse(localStorage.getItem('securefleet_session') || '{}');
            const userOrgId = currentUser?.org_id || session.org_id;


            // Build query - Super Admin (no org_id) can see all assets
            let query = supabase
                .from('assets')
                .select(`
          *,
          car:cars(name, make, model, plate_number),
          driver:drivers(full_name)
        `);

            // Only filter by org_id if user has one (not Super Admin)
            if (userOrgId) {
                query = query.eq('org_id', userOrgId);
            }

            // 1. Fetch Assets
            const { data: assetsData, error: assetsError } = await query.order('created_at', { ascending: false });

            if (assetsError) throw assetsError;

            const currentAssets = assetsData || [];

            // 2. Fetch Transactions for Assets linked to Cars
            const carIds = currentAssets
                .filter(a => a.car_id)
                .map(a => a.car_id);

            let transactions: Transaction[] = [];
            if (carIds.length > 0) {
                const { data: txData } = await supabase
                    .from('transactions')
                    .select('*')
                    .in('car_id', carIds);
                transactions = txData || [];
            }

            // 3. Calculate Stats for each asset
            const assetsWithStats = currentAssets.map(asset => {
                const assetTx = asset.car_id ? transactions.filter(t => t.car_id === asset.car_id) : [];

                const total_income = assetTx
                    .filter(t => t.type === 'income')
                    .reduce((sum, t) => sum + Number(t.amount), 0);

                const total_expense = assetTx
                    .filter(t => t.type === 'expense')
                    .reduce((sum, t) => sum + Number(t.amount), 0);

                // ROI = Net Profit 
                const roi = total_income - total_expense;

                return {
                    ...asset,
                    total_income,
                    total_expense,
                    roi
                };
            });

            setAssets(assetsWithStats);
        } catch (error) {
            console.error('Error fetching assets:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCars = async () => {
        const session = JSON.parse(localStorage.getItem('securefleet_session') || '{}');
        const userOrgId = currentUser?.org_id || session.org_id;

        let query = supabase.from('cars').select('*');
        if (userOrgId) {
            query = query.eq('org_id', userOrgId);
        }

        const { data } = await query;
        if (data) setCars(data);
    };

    const fetchDrivers = async () => {
        const session = JSON.parse(localStorage.getItem('securefleet_session') || '{}');
        const userOrgId = currentUser?.org_id || session.org_id;

        let query = supabase.from('drivers').select('*');
        if (userOrgId) {
            query = query.eq('org_id', userOrgId);
        }

        const { data } = await query;
        if (data) setDrivers(data);
    };

    const handleAddDriver = async () => {
        if (!currentUser?.org_id) return;
        setDriverActionLoading(true);

        const { data, error } = await supabase.from('drivers').insert({
            org_id: currentUser.org_id,
            full_name: newDriver.full_name,
            phone_number: newDriver.phone_number,
            license_number: newDriver.license_number,
            status: 'active'
        }).select().single();

        setDriverActionLoading(false);

        if (error) {
            alert('خطأ في الإضافة: ' + error.message);
        } else if (data) {
            setDrivers([data, ...drivers]);
            setNewDriver({ full_name: '', phone_number: '', license_number: '' });
        }
    };

    const handleDeleteDriver = async (id: string) => {
        if (!confirm('هل أنت متأكد من حذف هذا السائق؟')) return;
        const { error } = await supabase.from('drivers').delete().eq('id', id);
        if (!error) {
            setDrivers(drivers.filter(d => d.id !== id));
        } else {
            alert('خطأ في الحذف');
        }
    };

    const handleSave = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).maybeSingle();
            if (!profile?.org_id) return;

            // Remove calculated fields before saving
            const payload: any = {
                ...formData,
                org_id: profile.org_id
            };
            delete payload.total_income;
            delete payload.total_expense;
            delete payload.roi;
            delete payload.car;
            delete payload.driver;

            if (formData.id) {
                // Update
                const { error } = await supabase.from('assets').update(payload).eq('id', formData.id);
                if (error) throw error;
            } else {
                // Create
                const { error } = await supabase.from('assets').insert([payload]);
                if (error) throw error;
            }

            setShowModal(false);
            fetchAssets();
            setFormData({ asset_type: 'car', status: 'active', purchase_price: 0, current_value: 0 });
        } catch (error) {
            alert('حدث خطأ أثناء الحفظ');
            console.error(error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('هل أنت متأكد من حذف هذا الأصل؟')) return;
        try {
            const { error } = await supabase.from('assets').delete().eq('id', id);
            if (error) throw error;
            fetchAssets();
        } catch (error) {
            alert('حدث خطأ أثناء الحذف');
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'car': return <CarIcon className="w-5 h-5" />;
            case 'equipment': return <Truck className="w-5 h-5" />;
            case 'property': return <Building className="w-5 h-5" />;
            default: return <FileText className="w-5 h-5" />;
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">إدارة الأصول</h1>
                    <p className="text-slate-500 dark:text-slate-400">تتبع ممتلكات الشركة وحساب العائد الاستثماري</p>
                </div>
                <button
                    onClick={() => { setFormData({ asset_type: 'car', status: 'active', purchase_price: 0 }); setShowModal(true); }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-lg"
                >
                    <Plus className="w-4 h-4" />
                    <span>إضافة أصل جديد</span>
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="text-slate-500 dark:text-slate-400 text-sm mb-1">إجمالي قيمة الأصول (شراء)</div>
                    <div className="text-2xl font-bold text-slate-800 dark:text-white">
                        {assets.reduce((sum, a) => sum + (Number(a.purchase_price) || 0), 0).toLocaleString()} ر.س
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="text-slate-500 dark:text-slate-400 text-sm mb-1">صافي العائد الكلي</div>
                    <div className="text-2xl font-bold text-emerald-500">
                        {assets.reduce((sum, a) => sum + (Number(a.roi) || 0), 0).toLocaleString()} ر.س
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="text-slate-500 dark:text-slate-400 text-sm mb-1">عدد الأصول</div>
                    <div className="text-2xl font-bold text-slate-800 dark:text-white">{assets.length}</div>
                </div>
            </div>

            {/* Assets Grid */}
            {loading ? (
                <div className="text-center text-slate-400 py-10">جاري التحميل...</div>
            ) : assets.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                    <p className="text-slate-500 dark:text-slate-400">لا توجد أصول مضافة بعد (أو لا توجد أصول مسندة إليك)</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {assets.map((asset) => (
                        <div key={asset.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                            <div className="p-5">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-blue-50 dark:bg-slate-700 rounded-xl text-blue-600 dark:text-blue-400">
                                            {getIcon(asset.asset_type)}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-800 dark:text-white text-lg">{asset.name}</h3>
                                            <div className="text-xs text-slate-500 flex items-center gap-1">
                                                {asset.asset_type === 'car' ? 'سيارة' : asset.asset_type === 'equipment' ? 'معدة' : asset.asset_type === 'property' ? 'عقار' : 'أخرى'}
                                                {asset.car_details && ` • ${asset.car_details.plate_number}`}
                                            </div>
                                        </div>
                                    </div>
                                    <div className={`px-2 py-1 rounded-full text-xs font-bold ${asset.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400'}`}>
                                        {asset.status === 'active' ? 'نشط' : asset.status === 'sold' ? 'مباع' : 'غير نشط'}
                                    </div>
                                </div>

                                {/* Financial Summary */}
                                <div className="grid grid-cols-3 gap-2 mb-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                                    <div className="text-center">
                                        <div className="text-[10px] text-slate-500 mb-1 flex justify-center items-center gap-1">
                                            <TrendingUp className="w-3 h-3 text-emerald-500" /> الدخل
                                        </div>
                                        <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                                            {(asset.total_income || 0).toLocaleString()} <span className="text-[9px]">ر.س</span>
                                        </div>
                                    </div>
                                    <div className="text-center border-x border-slate-200 dark:border-slate-700">
                                        <div className="text-[10px] text-slate-500 mb-1 flex justify-center items-center gap-1">
                                            <TrendingDown className="w-3 h-3 text-red-500" /> المصروف
                                        </div>
                                        <div className="font-bold text-red-600 dark:text-red-400 text-sm">
                                            {(asset.total_expense || 0).toLocaleString()} <span className="text-[9px]">ر.س</span>
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-[10px] text-slate-500 mb-1 flex justify-center items-center gap-1">
                                            <Wallet className="w-3 h-3 text-blue-500" /> الصافي
                                        </div>
                                        <div className={`font-bold text-sm ${(asset.roi || 0) >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                                            {(asset.roi || 0).toLocaleString()} <span className="text-[9px]">ر.س</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2 mb-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500 dark:text-slate-400">سعر الشراء:</span>
                                        <span className="text-slate-800 dark:text-white font-medium">{Number(asset.purchase_price).toLocaleString()} <span className="text-xs">ر.س</span></span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500 dark:text-slate-400">القيمة الحالية (تقديري):</span>
                                        <span className="text-slate-800 dark:text-white font-bold">{Number(asset.current_value || asset.purchase_price).toLocaleString()} <span className="text-xs">ر.س</span></span>
                                    </div>

                                    {/* Progress Bar for Recovery */}
                                    {Number(asset.purchase_price) > 0 && (
                                        <div className="mt-2">
                                            <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                                                <span>نسبة استرداد رأس المال</span>
                                                <span>{Math.min(100, Math.max(0, ((asset.roi || 0) / asset.purchase_price) * 100)).toFixed(1)}%</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${(asset.roi || 0) >= asset.purchase_price ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                                    style={{ width: `${Math.min(100, Math.max(0, ((asset.roi || 0) / asset.purchase_price) * 100))}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex gap-2">
                                    <button
                                        onClick={() => { setFormData(asset); setShowModal(true); }}
                                        className="flex-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Edit className="w-4 h-4" /> تعديل
                                    </button>
                                    <button
                                        onClick={() => handleDelete(asset.id)}
                                        className="p-2 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">
                            {formData.id ? 'تعديل بيانات الأصل' : 'إضافة أصل جديد'}
                        </h2>

                        <div className="space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar p-1">
                            {/* Asset Type */}
                            <div>
                                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">نوع الأصل</label>
                                <select
                                    value={formData.asset_type}
                                    onChange={(e) => setFormData({ ...formData, asset_type: e.target.value as any })}
                                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg p-3 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                >
                                    <option value="car">سيارة</option>
                                    <option value="equipment">معدة</option>
                                    <option value="property">عقار</option>
                                    <option value="other">أخرى</option>
                                </select>
                            </div>

                            {/* Linked Car */}
                            {formData.asset_type === 'car' && (
                                <div>
                                    <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">ربط بسيارة (اختياري)</label>
                                    <select
                                        value={formData.car_id || ''}
                                        onChange={(e) => {
                                            const car = cars.find(c => c.id === e.target.value);
                                            setFormData({
                                                ...formData,
                                                car_id: e.target.value,
                                                name: car ? `${car.make} ${car.model} (${car.plate_number})` : formData.name,
                                                purchase_price: formData.purchase_price
                                            });
                                        }}
                                        className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg p-3 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    >
                                        <option value="">-- اختر سيارة --</option>
                                        {cars.map(c => (
                                            <option key={c.id} value={c.id}>{c.make} {c.model} - {c.plate_number}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Name */}
                            <div>
                                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">اسم الأصل</label>
                                <input
                                    type="text"
                                    value={formData.name || ''}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg p-3 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    placeholder="مثال: شاحنة نقل بضائع"
                                />
                            </div>

                            {/* Price & Date */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">سعر الشراء</label>
                                    <input
                                        type="number"
                                        value={formData.purchase_price || ''}
                                        onChange={(e) => setFormData({ ...formData, purchase_price: Number(e.target.value) })}
                                        className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg p-3 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">تاريخ الشراء</label>
                                    <input
                                        type="date"
                                        value={formData.purchase_date || ''}
                                        onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                                        className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg p-3 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Driver & User Assignment */}
                            <div>
                                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">السائق المسؤول (للسجل فقط)</label>
                                <div className="flex gap-2">
                                    <select
                                        value={formData.assigned_driver_id || ''}
                                        onChange={(e) => setFormData({ ...formData, assigned_driver_id: e.target.value })}
                                        className="flex-1 bg-slate-100 dark:bg-slate-800 border-none rounded-lg p-3 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    >
                                        <option value="">-- بدون سائق --</option>
                                        {drivers.filter(d => d.status === 'active').map(d => (
                                            <option key={d.id} value={d.id}>{d.full_name}</option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => setShowDriverModal(true)}
                                        className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 p-3 rounded-lg text-slate-600 dark:text-slate-300 transition"
                                        title="إدارة السائقين"
                                    >
                                        <Edit className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {(currentUserRole === 'admin' || currentUserRole === 'owner') && orgUsers.filter(u => u.id !== currentUser?.id).length > 0 && (
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                                    <label className="block text-sm text-blue-600 dark:text-blue-400 mb-1 font-bold">إسناد لموظف (صلاحية المشاهدة)</label>
                                    <select
                                        value={formData.assigned_user_id || ''}
                                        onChange={(e) => setFormData({ ...formData, assigned_user_id: e.target.value })}
                                        className="w-full bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    >
                                        <option value="">-- يظهر للمسؤولين فقط --</option>
                                        {orgUsers.filter(u => u.id !== currentUser?.id).map(u => (
                                            <option key={u.id} value={u.id}>{u.full_name}</option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-blue-500 mt-1">
                                        * تحديد موظف هنا سيجعل هذا الأصل مرئياً له فقط في حسابه.
                                    </p>
                                </div>
                            )}


                            <div>
                                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">الحالة</label>
                                <select
                                    value={formData.status || 'active'}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg p-3 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                >
                                    <option value="active">نشط</option>
                                    <option value="inactive">غير نشط</option>
                                    <option value="sold">مباع</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">ملاحظات</label>
                                <textarea
                                    value={formData.notes || ''}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg p-3 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all h-20"
                                ></textarea>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 py-3 text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors font-bold"
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={handleSave}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl transition-colors font-bold shadow-lg shadow-blue-500/20"
                            >
                                حفظ البيانات
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* Manage Drivers Modal */}
            {showDriverModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-[#1e293b] w-full max-w-lg rounded-2xl border border-slate-700 p-6 flex flex-col max-h-[85vh]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white">إدارة السائقين</h3>
                            <button onClick={() => setShowDriverModal(false)}><Trash2 className="w-5 h-5 text-slate-400 rotate-45" /></button>
                        </div>

                        {/* Add Driver Section */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-6">
                            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">إضافة سائق جديد</h4>
                            <div className="space-y-3">
                                <input
                                    placeholder="الاسم الثلاثي"
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500"
                                    value={newDriver.full_name} onChange={e => setNewDriver({ ...newDriver, full_name: e.target.value })}
                                />
                                <div className="flex gap-2">
                                    <input
                                        placeholder="رقم الرخصة"
                                        className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500"
                                        value={newDriver.license_number} onChange={e => setNewDriver({ ...newDriver, license_number: e.target.value })}
                                    />
                                    <input
                                        placeholder="رقم الجوال"
                                        className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500"
                                        value={newDriver.phone_number} onChange={e => setNewDriver({ ...newDriver, phone_number: e.target.value })}
                                    />
                                </div>
                                <button
                                    onClick={handleAddDriver}
                                    disabled={driverActionLoading || !newDriver.full_name}
                                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg py-2.5 font-bold text-sm transition"
                                >
                                    {driverActionLoading ? 'جاري الإضافة...' : 'إضافة للقائمة'}
                                </button>
                            </div>
                        </div>

                        {/* List Section */}
                        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                            {drivers.length === 0 ? (
                                <p className="text-center text-slate-500 text-sm py-4">لا يوجد سائقين مسجلين</p>
                            ) : (
                                drivers.map(driver => (
                                    <div key={driver.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 group">
                                        <div>
                                            <div className="font-bold text-slate-800 dark:text-white text-sm">{driver.full_name}</div>
                                            <div className="text-xs text-slate-500 font-mono">{driver.license_number || 'بدون رخصة'}</div>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteDriver(driver.id)}
                                            className="p-2 text-slate-400 hover:text-red-500 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition opacity-0 group-hover:opacity-100"
                                            title="حذف"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Assets;
