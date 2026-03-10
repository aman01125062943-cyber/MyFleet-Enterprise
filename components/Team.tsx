
import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { createClient } from '@supabase/supabase-js'; // Import
import { Profile, UserPermissions } from '../types';
import { LayoutContextType } from './Layout';
import { useToast } from './ToastProvider';
import {
    UserPlus, Search, Shield, Loader2, Lock, Trash2, X, AlertCircle, Crown
} from 'lucide-react';
import { PLAN_MAX_PERMISSIONS, PLAN_NAMES_AR, getDefaultPermissionsForPlan } from '../lib/planPermissionGuard';

// Default empty permissions structure
const defaultPermissions: UserPermissions = {
    dashboard: { view: true },
    inventory: { view: false, add: false, edit: false, delete: false, manage_status: false },
    finance: { view: false, add_income: false, add_expense: false, export: false },
    assets: { view: false, add: false, edit: false, delete: false },
    team: { view: false, manage: false },
    reports: { view: false },
    subscription: {
        view_requests: false,
        approve_requests: false,
        reject_requests: false,
        manage_plans: false,
        manage_discounts: false,
        view_reports: false,
        manage_notifications: false
    }
};

interface TemplatePerms {
    label: string;
    perms: UserPermissions;
}

const templates: Record<string, TemplatePerms> = {
    admin: {
        label: 'Admin (مدير)',
        perms: {
            dashboard: { view: true },
            inventory: { view: true, add: true, edit: true, delete: true, manage_status: true },
            finance: { view: true, add_income: true, add_expense: true, export: true },
            assets: { view: true, add: true, edit: true, delete: true },
            team: { view: true, manage: true },
            reports: { view: true },
            subscription: {
                view_requests: true,
                approve_requests: true,
                reject_requests: true,
                manage_plans: false,
                manage_discounts: false,
                view_reports: true,
                manage_notifications: false
            }
        }
    },
    supervisor: {
        label: 'Supervisor (مشرف)',
        perms: {
            dashboard: { view: true },
            inventory: { view: true, add: true, edit: true, delete: false, manage_status: true },
            finance: { view: true, add_income: true, add_expense: true, export: false },
            assets: { view: true, add: true, edit: true, delete: false },
            team: { view: true, manage: false },
            reports: { view: true },
            subscription: {
                view_requests: false,
                approve_requests: false,
                reject_requests: false,
                manage_plans: false,
                manage_discounts: false,
                view_reports: false,
                manage_notifications: false
            }
        }
    },
    staff: {
        label: 'Staff (موظف)',
        perms: {
            dashboard: { view: true },
            inventory: { view: true, add: true, edit: false, delete: false, manage_status: true },
            finance: { view: false, add_income: false, add_expense: false, export: false },
            assets: { view: false, add: false, edit: false, delete: false },
            team: { view: false, manage: false },
            reports: { view: false },
            subscription: {
                view_requests: false,
                approve_requests: false,
                reject_requests: false,
                manage_plans: false,
                manage_discounts: false,
                view_reports: false,
                manage_notifications: false
            }
        }
    },
    // قالب جديد لمدير الاشتراكات
    subscription_manager: {
        label: 'مدير الاشتراكات',
        perms: {
            dashboard: { view: false },
            inventory: { view: false, add: false, edit: false, delete: false, manage_status: false },
            finance: { view: true, add_income: false, add_expense: false, export: true },
            assets: { view: false, add: false, edit: false, delete: false },
            team: { view: true, manage: false },
            reports: { view: true },
            subscription: {
                view_requests: true,
                approve_requests: true,
                reject_requests: true,
                manage_plans: false,
                manage_discounts: true,
                view_reports: true,
                manage_notifications: true
            }
        }
    }
};

const getRoleBadgeStyles = (role?: string) => {
    switch (role) {
        case 'owner': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
        case 'admin': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
        default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
};

const Team: React.FC = () => {
    const { user, org, isReadOnly } = useOutletContext<LayoutContextType>();
    const { showToast } = useToast();

    const [members, setMembers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
    const [deleteModal, setDeleteModal] = useState({ open: false, id: '', name: '' });

    // Form State
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        password: '',
        role: 'staff',
        subscription_plan: org?.subscription_plan || 'starter',
        permissions: defaultPermissions
    });

    // Permission Logic
    const canManageTeam = !isReadOnly && (user?.role === 'owner' || user?.permissions?.team?.manage);

    useEffect(() => {
        // SECURITY: Only fetch if valid org
        if (user?.org_id) fetchData(user.org_id);
    }, [user]);

    const fetchData = async (orgId: string) => {
        // Safety check
        if (!orgId) return;

        // DATA ISOLATION: Fetch only this org's members
        const { data } = await supabase.from('profiles').select().eq('org_id', orgId).order('created_at');
        if (data) setMembers(data as Profile[]);
    };

    const applyTemplate = (roleKey: string) => {
        const t = templates[roleKey];
        if (t) {
            setFormData(prev => ({ ...prev, role: roleKey, permissions: t.perms }));
        }
    };

    // تحديث الصلاحيات عند تغيير الباقة
    const handlePlanChange = (planId: string) => {
        setFormData(prev => ({
            ...prev,
            subscription_plan: planId,
            // الصلاحيات تأتي تلقائياً من الباقة
            permissions: getDefaultPermissionsForPlan(planId)
        }));
    };

    // الحصول على الصلاحيات القصوى للباقة المحددة
    const maxPermissionsForCurrentPlan = PLAN_MAX_PERMISSIONS[formData.subscription_plan as keyof typeof PLAN_MAX_PERMISSIONS] || PLAN_MAX_PERMISSIONS.starter;

    const handleOpenCreate = () => {
        // SECURITY GUARD: Read Only
        if (isReadOnly) return;
        if (!canManageTeam) return;

        // Gatekeeper Logic
        if (org && members.length >= org.max_users) {
            setIsLimitModalOpen(true);
            return;
        }

        const defaultPlan = org?.subscription_plan || 'starter';
        setEditMode(false);
        setFormData({
            full_name: '',
            email: '',
            password: '',
            role: 'staff',
            subscription_plan: defaultPlan,
            permissions: getDefaultPermissionsForPlan(defaultPlan)
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (targetUser: Profile) => {
        if (isReadOnly) return;
        if (!canManageTeam) return;

        setEditMode(true);
        setSelectedUser(targetUser);
        const userPlan = org?.subscription_plan || 'starter';
        setFormData({
            full_name: targetUser.full_name,
            email: targetUser.username, // Fallback mapping for edit
            password: '',
            role: targetUser.role || 'staff',
            subscription_plan: userPlan,
            permissions: targetUser.permissions || getDefaultPermissionsForPlan(userPlan)
        });
        setIsModalOpen(true);
    };

    const handleToggleStatus = async (targetUser: Profile) => {
        // SECURITY GUARD
        if (isReadOnly) return;
        if (!canManageTeam) return;

        const newStatus = targetUser.status === 'active' ? 'disabled' : 'active';
        if (!confirm(`هل أنت متأكد من ${newStatus === 'active' ? 'تفعيل' : 'تعطيل'} حساب ${targetUser.full_name}؟`)) return;

        const { error } = await supabase.rpc('toggle_user_status', {
            p_target_user_id: targetUser.id,
            p_status: newStatus,
            p_admin_id: user?.id
        });

        if (!error) {
            if (user?.org_id) fetchData(user.org_id);
            showToast('تم تحديث حالة الحساب بنجاح', 'success');
        } else {
            showToast(error.message, 'error');
        }
    };

    const handleDeleteUser = (targetUser: Profile) => {
        if (isReadOnly) {
            showToast('لا يمكنك الحذف في وضع القراءة فقط', 'error');
            return;
        }
        if (!canManageTeam) {
            showToast('ليس لديك صلاحية الحذف', 'error');
            return;
        }
        setDeleteModal({ open: true, id: targetUser.id, name: targetUser.full_name });
    };

    const confirmDeleteUser = async () => {
        setLoading(true);
        const { error } = await supabase.from('profiles').delete().eq('id', deleteModal.id);

        if (!error) {
            showToast('تم حذف المستخدم بنجاح', 'success');
            setDeleteModal({ open: false, id: '', name: '' });
            if (user?.org_id) await fetchData(user.org_id);
        } else {
            showToast('خطأ أثناء الحذف: ' + error.message, 'error');
        }
        setLoading(false);
    };

    const handleUpdateUser = async () => {
        if (!selectedUser) return;

        const { error: rpcError } = await supabase.rpc('update_permissions', {
            p_target_user_id: selectedUser.id,
            p_new_permissions: formData.permissions,
            p_new_role: formData.role,
            p_admin_id: user?.id
        });

        if (rpcError) {
            showToast(rpcError.message, 'error');
            return;
        }

        const { error: updateError } = await supabase.from('profiles').update({
            full_name: formData.full_name,
            username: formData.email,
            ...(formData.password ? { password: formData.password } : {})
        }).eq('id', selectedUser.id);

        if (!updateError) {
            showToast('تم تحديث البيانات والصلاحيات بنجاح', 'success');
            setIsModalOpen(false);
            if (user?.org_id) await fetchData(user.org_id);
        } else {
            showToast('تم تحديث الصلاحيات ولكن فشل تحديث البيانات: ' + updateError.message, 'warning');
        }
    };

    const handleCreateUser = async () => {
        if (formData.password.length < 6) {
            showToast('كلمة المرور يجب أن تكون 6 خانات على الأقل', 'warning');
            return;
        }

        try {
            // @ts-expect-error: import.meta might not be available
            const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
            // @ts-expect-error: import.meta might not be available
            const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

            // SECURITY: Validate credentials exist - no hardcoded fallbacks
            if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
                throw new Error('Missing Supabase configuration. Please contact system administrator.');
            }

            const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

            let userId = '';
            const { data: authData, error: authError } = await tempClient.auth.signUp({
                email: formData.email,
                password: formData.password,
            });

            if (authError) {
                if (authError.message.includes('already registered')) {
                    const { data: loginData, error: loginError } = await tempClient.auth.signInWithPassword({
                        email: formData.email,
                        password: formData.password,
                    });
                    if (loginError) throw new Error('المستخدم مسجل بالفعل وكلمة المرور غير صحيحة');
                    if (loginData.session) userId = loginData.session.user.id;
                } else {
                    throw authError;
                }
            } else if (authData.user) {
                userId = authData.user.id;
            }

            if (!userId) throw new Error("فشل في إنشاء الحساب");

            const { error: rpcError } = await supabase.rpc('org_create_user', {
                p_user_id: userId,
                p_org_id: user?.org_id,
                p_username: formData.email,
                p_full_name: formData.full_name,
                p_role: formData.role,
                p_permissions: formData.permissions
            });

            if (rpcError) throw rpcError;

            showToast('تم إنشاء الموظف بنجاح', 'success');
            setIsModalOpen(false);

            const newUserProfile: Profile = {
                id: userId,
                full_name: formData.full_name,
                username: formData.email,
                email: formData.email,
                org_id: user?.org_id,
                role: formData.role,
                permissions: formData.permissions,
                status: 'active',
                // @ts-expect-error: created_at might be missing from base Profile type but returned from DB
                created_at: new Date().toISOString()
            };
            setMembers(prev => [...prev, newUserProfile]);

            if (user?.org_id) await fetchData(user.org_id);

        } catch (err: unknown) {
            console.error('Creation Error:', err);
            const msg = err instanceof Error ? err.message : 'خطأ في إنشاء المستخدم';
            showToast(msg, 'error');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isReadOnly || !canManageTeam) {
            if (!canManageTeam) showToast('غير مصرح لك بإدارة الفريق', 'error');
            return;
        }

        setLoading(true);
        if (editMode && selectedUser) {
            await handleUpdateUser();
        } else {
            await handleCreateUser();
        }
        setLoading(false);
    };

    const togglePerm = (category: keyof UserPermissions, key: string) => {
        if (isReadOnly) return;

        const currentValue = (formData.permissions[category] as any)?.[key] || false;
        const newValue = !currentValue;

        // إذا كان المحاولة تفعيل صلاحية، تأكد أنها مسموحة في الباقة
        if (newValue === true) {
            const allowedInPlan = maxPermissionsForCurrentPlan[category]?.[key] === true;
            if (!allowedInPlan) {
                // الصلاحية غير مسموحة في الباقة - لا تسمح بالتفعيل
                return;
            }
        }

        setFormData(prev => ({
            ...prev,
            permissions: {
                ...prev.permissions,
                [category]: {
                    ...prev.permissions[category],
                    [key]: newValue
                }
            }
        }));
    };

    return (
        <div className="space-y-6 font-[Cairo] pb-20">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-1">فريق العمل</h1>
                    <p className="text-slate-500 text-sm">إدارة المستخدمين والصلاحيات</p>
                </div>

                <div className="flex gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute right-3 top-3 text-slate-400 w-4 h-4" />
                        <input className="w-full bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-slate-700 rounded-xl py-2.5 pr-9 pl-4 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500" placeholder="بحث بالاسم..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    {canManageTeam && (
                        <button onClick={handleOpenCreate} disabled={isReadOnly} className={`bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-blue-900/20 ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            {org && members.length >= org.max_users ? <Lock className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                            مستخدم جديد
                        </button>
                    )}
                </div>
            </div>

            {/* Notifications */}


            {/* Rich List Table */}
            <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-right">
                        <thead className="bg-gray-50 dark:bg-slate-800/50 text-slate-500 text-xs font-bold border-b border-gray-100 dark:border-slate-700">
                            <tr>
                                <th className="p-5">الموظف</th>
                                <th className="p-5">الدور (Role)</th>
                                <th className="p-5">الحالة</th>
                                <th className="p-5">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                            {members.filter(m => m.full_name.includes(searchTerm)).map(member => (
                                <tr key={member.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition group">
                                    <td className="p-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-600">
                                                {member.full_name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800 dark:text-white text-sm">{member.full_name}</div>
                                                <div className="text-xs text-slate-500 font-mono">@{member.username}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide border ${getRoleBadgeStyles(member.role)}`}>
                                            {member.role}
                                        </span>
                                    </td>
                                    <td className="p-5">
                                        {member.role !== 'owner' && canManageTeam ? (
                                            <button onClick={() => handleToggleStatus(member)} disabled={isReadOnly} className={`relative w-10 h-6 rounded-full transition-colors ${isReadOnly ? 'opacity-50' : ''} ${member.status === 'active' ? 'bg-emerald-500' : 'bg-slate-600'}`}>
                                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${member.status === 'active' ? 'left-5' : 'left-1'}`}></div>
                                            </button>
                                        ) : (
                                            <span className={`text-xs font-bold ${member.status === 'active' ? 'text-emerald-500' : 'text-slate-500'}`}>
                                                {member.status === 'active' ? 'نشط' : 'معطل'}
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-5">
                                        {canManageTeam && member.role !== 'owner' && (
                                            <div className="flex gap-2 transition">
                                                <button onClick={() => handleOpenEdit(member)} disabled={isReadOnly} className="p-2 bg-slate-100 dark:bg-slate-800 hover:text-blue-600 rounded-lg text-slate-400 transition" title="تعديل الصلاحيات">
                                                    <Shield className="w-4 h-4" />
                                                </button>
                                                <button type="button" onClick={() => handleDeleteUser(member)} className="p-2 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 text-red-400 hover:text-red-600 rounded-lg transition" title="حذف">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* LIMIT REACHED MODAL */}
            {isLimitModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-[#1e293b] w-full max-w-sm rounded-2xl p-8 shadow-2xl border border-gray-200 dark:border-slate-700 text-center">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Lock className="w-8 h-8 text-red-500" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">وصلت للحد الأقصى</h3>
                        <p className="text-slate-500 text-sm mb-6">لقد استهلكت جميع المقاعد المتاحة للمستخدمين ({org?.max_users} مستخدم). يرجى الترقية لإضافة المزيد.</p>
                        <button onClick={() => setIsLimitModalOpen(false)} className="w-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white font-bold py-3 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition">إغلاق</button>
                    </div>
                </div>
            )}

            {/* PERMISSIONS MATRIX MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-[#0f172a] w-full max-w-4xl rounded-3xl border border-slate-700 shadow-2xl flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-[#1e293b] rounded-t-3xl">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800 dark:text-white">{editMode ? 'تعديل الصلاحيات' : 'إضافة مستخدم جديد'}</h2>
                                <p className="text-xs text-slate-500 mt-1">{editMode ? `للمستخدم: ${selectedUser?.full_name}` : 'قم بتحديد بيانات الدخول والصلاحيات'}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-500 hidden md:block">قوالب سريعة:</span>
                                <div className="flex bg-white dark:bg-[#0f172a] p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                                    {Object.keys(templates).map(key => (
                                        <button key={key} type="button" onClick={() => applyTemplate(key)} className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${formData.role === key ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                                            {templates[key].label.split(' ')[0]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)}><X className="text-slate-400 hover:text-white" /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-2 block">الاسم الكامل</label>
                                    <input className="w-full bg-slate-50 dark:bg-[#1e293b] border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-slate-800 dark:text-white focus:border-blue-500 outline-none"
                                        value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} disabled={editMode} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-2 block">البريد الإلكتروني (Email)</label>
                                    <input className="w-full bg-slate-50 dark:bg-[#1e293b] border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-slate-800 dark:text-white focus:border-blue-500 outline-none font-mono"
                                        type="email"
                                        value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} disabled={editMode} />
                                </div>
                                {!editMode && (
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-2 block">كلمة المرور</label>
                                        <input type="password" className="w-full bg-slate-50 dark:bg-[#1e293b] border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-slate-800 dark:text-white focus:border-blue-500 outline-none"
                                            value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                                    </div>
                                )}
                            </div>

                            {/* Plan Selector - NEW */}
                            <div className="md:col-span-3">
                                <label className="text-xs font-bold text-slate-500 mb-2 block flex items-center gap-2">
                                    <Crown className="w-4 h-4 text-amber-500" />
                                    باقة الصلاحيات
                                </label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {Object.keys(PLAN_MAX_PERMISSIONS).map(planId => {
                                        const isSelected = formData.subscription_plan === planId;
                                        const planName = PLAN_NAMES_AR[planId as keyof typeof PLAN_NAMES_AR] || planId;
                                        return (
                                            <button
                                                key={planId}
                                                type="button"
                                                onClick={() => handlePlanChange(planId)}
                                                className={`p-4 rounded-xl border-2 transition-all text-center ${
                                                    isSelected
                                                        ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20'
                                                        : 'border-gray-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 bg-slate-50 dark:bg-[#1e293b]'
                                                }`}
                                            >
                                                <div className={`font-bold text-sm mb-1 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                    {planName}
                                                </div>
                                                {isSelected && (
                                                    <div className="text-xs text-blue-500 dark:text-blue-400">
                                                        ✓ الباقة الحالية
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    💡 الصلاحيات تُحدد تلقائياً حسب الباقة المختارة. يمكنك تقليل الصلاحيات لكن لا يمكنك زيادتها عن حدود الباقة.
                                </p>
                            </div>

                            <div>
                                <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-blue-500" /> مصفوفة الصلاحيات
                                    <span className="text-xs font-normal text-slate-500">(الباقة: {PLAN_NAMES_AR[formData.subscription_plan as keyof typeof PLAN_NAMES_AR] || formData.subscription_plan})</span>
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Inventory */}
                                    <div className={`bg-slate-50 dark:bg-[#1e293b] p-4 rounded-xl border ${maxPermissionsForCurrentPlan.inventory?.view ? 'border-gray-200 dark:border-slate-700' : 'border-amber-200 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-900/10'}`}>
                                        <div className="font-bold text-slate-700 dark:text-slate-300 mb-3 border-b border-gray-200 dark:border-slate-700 pb-2 flex items-center justify-between">
                                            <span>🚗 إدارة الأسطول</span>
                                            {!maxPermissionsForCurrentPlan.inventory?.view && (
                                                <Lock className="w-4 h-4 text-amber-500" title="غير متاح في هذه الباقة" />
                                            )}
                                        </div>
                                        <div className="space-y-3">
                                            <label className={`flex items-center gap-3 ${maxPermissionsForCurrentPlan.inventory?.view ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
                                                <div className="relative">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.permissions.inventory.view}
                                                        onChange={() => togglePerm('inventory', 'view')}
                                                        disabled={!maxPermissionsForCurrentPlan.inventory?.view}
                                                        className="w-4 h-4 accent-blue-600 rounded"
                                                    />
                                                    {!maxPermissionsForCurrentPlan.inventory?.view && (
                                                        <Lock className="absolute -top-1 -right-1 w-3 h-3 bg-slate-700 rounded-full p-0.5 text-slate-300" />
                                                    )}
                                                </div>
                                                <span className="text-sm text-slate-600 dark:text-slate-400">عرض السيارات</span>
                                            </label>
                                            <label className={`flex items-center gap-3 ${maxPermissionsForCurrentPlan.inventory?.add ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
                                                <div className="relative">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.permissions.inventory.add}
                                                        onChange={() => togglePerm('inventory', 'add')}
                                                        disabled={!maxPermissionsForCurrentPlan.inventory?.add}
                                                        className="w-4 h-4 accent-blue-600 rounded"
                                                    />
                                                    {!maxPermissionsForCurrentPlan.inventory?.add && (
                                                        <Lock className="absolute -top-1 -right-1 w-3 h-3 bg-slate-700 rounded-full p-0.5 text-slate-300" />
                                                    )}
                                                </div>
                                                <span className="text-sm text-slate-600 dark:text-slate-400">إضافة سيارات</span>
                                            </label>
                                            <label className={`flex items-center gap-3 ${maxPermissionsForCurrentPlan.inventory?.manage_status ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
                                                <div className="relative">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.permissions.inventory.manage_status}
                                                        onChange={() => togglePerm('inventory', 'manage_status')}
                                                        disabled={!maxPermissionsForCurrentPlan.inventory?.manage_status}
                                                        className="w-4 h-4 accent-blue-600 rounded"
                                                    />
                                                    {!maxPermissionsForCurrentPlan.inventory?.manage_status && (
                                                        <Lock className="absolute -top-1 -right-1 w-3 h-3 bg-slate-700 rounded-full p-0.5 text-slate-300" />
                                                    )}
                                                </div>
                                                <span className="text-sm text-slate-600 dark:text-slate-400">تغيير الحالة</span>
                                            </label>
                                            <label className={`flex items-center gap-3 ${maxPermissionsForCurrentPlan.inventory?.delete ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
                                                <div className="relative">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.permissions.inventory.delete}
                                                        onChange={() => togglePerm('inventory', 'delete')}
                                                        disabled={!maxPermissionsForCurrentPlan.inventory?.delete}
                                                        className="w-4 h-4 accent-red-600 rounded"
                                                    />
                                                    {!maxPermissionsForCurrentPlan.inventory?.delete && (
                                                        <Lock className="absolute -top-1 -right-1 w-3 h-3 bg-slate-700 rounded-full p-0.5 text-slate-300" />
                                                    )}
                                                </div>
                                                <span className="text-sm text-red-500">حذف سيارات (خطر)</span>
                                            </label>
                                        </div>
                                    </div>
                                    {/* Finance */}
                                    <div className={`bg-slate-50 dark:bg-[#1e293b] p-4 rounded-xl border ${maxPermissionsForCurrentPlan.finance?.view ? 'border-gray-200 dark:border-slate-700' : 'border-amber-200 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-900/10'}`}>
                                        <div className="font-bold text-slate-700 dark:text-slate-300 mb-3 border-b border-gray-200 dark:border-slate-700 pb-2 flex items-center justify-between">
                                            <span>💰 المالية</span>
                                            {!maxPermissionsForCurrentPlan.finance?.view && (
                                                <Lock className="w-4 h-4 text-amber-500" title="غير متاح في هذه الباقة" />
                                            )}
                                        </div>
                                        <div className="space-y-3">
                                            <label className={`flex items-center gap-3 ${maxPermissionsForCurrentPlan.finance?.view ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
                                                <div className="relative">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.permissions.finance.view}
                                                        onChange={() => togglePerm('finance', 'view')}
                                                        disabled={!maxPermissionsForCurrentPlan.finance?.view}
                                                        className="w-4 h-4 accent-blue-600 rounded"
                                                    />
                                                    {!maxPermissionsForCurrentPlan.finance?.view && (
                                                        <Lock className="absolute -top-1 -right-1 w-3 h-3 bg-slate-700 rounded-full p-0.5 text-slate-300" />
                                                    )}
                                                </div>
                                                <span className="text-sm text-slate-600 dark:text-slate-400">الاطلاع على المالية</span>
                                            </label>
                                            <label className={`flex items-center gap-3 ${maxPermissionsForCurrentPlan.finance?.add_income ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
                                                <div className="relative">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.permissions.finance.add_income}
                                                        onChange={() => togglePerm('finance', 'add_income')}
                                                        disabled={!maxPermissionsForCurrentPlan.finance?.add_income}
                                                        className="w-4 h-4 accent-blue-600 rounded"
                                                    />
                                                    {!maxPermissionsForCurrentPlan.finance?.add_income && (
                                                        <Lock className="absolute -top-1 -right-1 w-3 h-3 bg-slate-700 rounded-full p-0.5 text-slate-300" />
                                                    )}
                                                </div>
                                                <span className="text-sm text-slate-600 dark:text-slate-400">تسجيل إيرادات</span>
                                            </label>
                                            <label className={`flex items-center gap-3 ${maxPermissionsForCurrentPlan.finance?.add_expense ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
                                                <div className="relative">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.permissions.finance.add_expense}
                                                        onChange={() => togglePerm('finance', 'add_expense')}
                                                        disabled={!maxPermissionsForCurrentPlan.finance?.add_expense}
                                                        className="w-4 h-4 accent-blue-600 rounded"
                                                    />
                                                    {!maxPermissionsForCurrentPlan.finance?.add_expense && (
                                                        <Lock className="absolute -top-1 -right-1 w-3 h-3 bg-slate-700 rounded-full p-0.5 text-slate-300" />
                                                    )}
                                                </div>
                                                <span className="text-sm text-slate-600 dark:text-slate-400">تسجيل مصروفات</span>
                                            </label>
                                        </div>
                                    </div>
                                    {/* Assets */}
                                    <div className={`bg-slate-50 dark:bg-[#1e293b] p-4 rounded-xl border ${maxPermissionsForCurrentPlan.assets?.view ? 'border-gray-200 dark:border-slate-700' : 'border-amber-200 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-900/10'}`}>
                                        <div className="font-bold text-slate-700 dark:text-slate-300 mb-3 border-b border-gray-200 dark:border-slate-700 pb-2 flex items-center justify-between">
                                            <span>🏗️ الأصول</span>
                                            {!maxPermissionsForCurrentPlan.assets?.view && (
                                                <Lock className="w-4 h-4 text-amber-500" title="غير متاح في هذه الباقة" />
                                            )}
                                        </div>
                                        <div className="space-y-3">
                                            <label className={`flex items-center gap-3 ${maxPermissionsForCurrentPlan.assets?.view ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
                                                <div className="relative">
                                                    <input type="checkbox" checked={formData.permissions.assets.view} onChange={() => togglePerm('assets', 'view')} disabled={!maxPermissionsForCurrentPlan.assets?.view} className="w-4 h-4 accent-blue-600 rounded" />
                                                    {!maxPermissionsForCurrentPlan.assets?.view && <Lock className="absolute -top-1 -right-1 w-3 h-3 bg-slate-700 rounded-full p-0.5 text-slate-300" />}
                                                </div>
                                                <span className="text-sm text-slate-600 dark:text-slate-400">عرض الأصول</span>
                                            </label>
                                            <label className={`flex items-center gap-3 ${maxPermissionsForCurrentPlan.assets?.add ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
                                                <div className="relative">
                                                    <input type="checkbox" checked={formData.permissions.assets.add} onChange={() => togglePerm('assets', 'add')} disabled={!maxPermissionsForCurrentPlan.assets?.add} className="w-4 h-4 accent-blue-600 rounded" />
                                                    {!maxPermissionsForCurrentPlan.assets?.add && <Lock className="absolute -top-1 -right-1 w-3 h-3 bg-slate-700 rounded-full p-0.5 text-slate-300" />}
                                                </div>
                                                <span className="text-sm text-slate-600 dark:text-slate-400">إضافة أصول</span>
                                            </label>
                                            <label className={`flex items-center gap-3 ${maxPermissionsForCurrentPlan.assets?.edit ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
                                                <div className="relative">
                                                    <input type="checkbox" checked={formData.permissions.assets.edit} onChange={() => togglePerm('assets', 'edit')} disabled={!maxPermissionsForCurrentPlan.assets?.edit} className="w-4 h-4 accent-blue-600 rounded" />
                                                    {!maxPermissionsForCurrentPlan.assets?.edit && <Lock className="absolute -top-1 -right-1 w-3 h-3 bg-slate-700 rounded-full p-0.5 text-slate-300" />}
                                                </div>
                                                <span className="text-sm text-slate-600 dark:text-slate-400">تعديل الأصول</span>
                                            </label>
                                        </div>
                                    </div>
                                    {/* Team */}
                                    <div className={`bg-slate-50 dark:bg-[#1e293b] p-4 rounded-xl border ${maxPermissionsForCurrentPlan.team?.view ? 'border-gray-200 dark:border-slate-700' : 'border-amber-200 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-900/10'}`}>
                                        <div className="font-bold text-slate-700 dark:text-slate-300 mb-3 border-b border-gray-200 dark:border-slate-700 pb-2 flex items-center justify-between">
                                            <span>👥 الإدارة</span>
                                            {!maxPermissionsForCurrentPlan.team?.view && (
                                                <Lock className="w-4 h-4 text-amber-500" title="غير متاح في هذه الباقة" />
                                            )}
                                        </div>
                                        <div className="space-y-3">
                                            <label className={`flex items-center gap-3 ${maxPermissionsForCurrentPlan.team?.view ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
                                                <div className="relative">
                                                    <input type="checkbox" checked={formData.permissions.team.view} onChange={() => togglePerm('team', 'view')} disabled={!maxPermissionsForCurrentPlan.team?.view} className="w-4 h-4 accent-blue-600 rounded" />
                                                    {!maxPermissionsForCurrentPlan.team?.view && <Lock className="absolute -top-1 -right-1 w-3 h-3 bg-slate-700 rounded-full p-0.5 text-slate-300" />}
                                                </div>
                                                <span className="text-sm text-slate-600 dark:text-slate-400">عرض الفريق</span>
                                            </label>
                                            <label className={`flex items-center gap-3 ${maxPermissionsForCurrentPlan.team?.manage ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
                                                <div className="relative">
                                                    <input type="checkbox" checked={formData.permissions.team.manage} onChange={() => togglePerm('team', 'manage')} disabled={!maxPermissionsForCurrentPlan.team?.manage} className="w-4 h-4 accent-blue-600 rounded" />
                                                    {!maxPermissionsForCurrentPlan.team?.manage && <Lock className="absolute -top-1 -right-1 w-3 h-3 bg-slate-700 rounded-full p-0.5 text-slate-300" />}
                                                </div>
                                                <span className="text-sm text-slate-600 dark:text-slate-400">إدارة المستخدمين</span>
                                            </label>
                                        </div>
                                    </div>
                                    {/* Reports */}
                                    <div className={`bg-slate-50 dark:bg-[#1e293b] p-4 rounded-xl border ${maxPermissionsForCurrentPlan.reports?.view ? 'border-gray-200 dark:border-slate-700' : 'border-amber-200 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-900/10'}`}>
                                        <div className="font-bold text-slate-700 dark:text-slate-300 mb-3 border-b border-gray-200 dark:border-slate-700 pb-2 flex items-center justify-between">
                                            <span>📊 التقارير</span>
                                            {!maxPermissionsForCurrentPlan.reports?.view && (
                                                <Lock className="w-4 h-4 text-amber-500" title="غير متاح في هذه الباقة" />
                                            )}
                                        </div>
                                        <div className="space-y-3">
                                            <label className={`flex items-center gap-3 ${maxPermissionsForCurrentPlan.dashboard?.view ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
                                                <div className="relative">
                                                    <input type="checkbox" checked={formData.permissions.dashboard.view} onChange={() => togglePerm('dashboard', 'view')} disabled={!maxPermissionsForCurrentPlan.dashboard?.view} className="w-4 h-4 accent-blue-600 rounded" />
                                                    {!maxPermissionsForCurrentPlan.dashboard?.view && <Lock className="absolute -top-1 -right-1 w-3 h-3 bg-slate-700 rounded-full p-0.5 text-slate-300" />}
                                                </div>
                                                <span className="text-sm text-slate-600 dark:text-slate-400">لوحة القيادة (Dashboard)</span>
                                            </label>
                                            <label className={`flex items-center gap-3 ${maxPermissionsForCurrentPlan.reports?.view ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
                                                <div className="relative">
                                                    <input type="checkbox" checked={formData.permissions.reports.view} onChange={() => togglePerm('reports', 'view')} disabled={!maxPermissionsForCurrentPlan.reports?.view} className="w-4 h-4 accent-blue-600 rounded" />
                                                    {!maxPermissionsForCurrentPlan.reports?.view && <Lock className="absolute -top-1 -right-1 w-3 h-3 bg-slate-700 rounded-full p-0.5 text-slate-300" />}
                                                </div>
                                                <span className="text-sm text-slate-600 dark:text-slate-400">عرض التقارير التفصيلية</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-[#1e293b] rounded-b-3xl flex justify-end gap-3">
                            <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 transition">إلغاء</button>
                            <button onClick={handleSubmit} disabled={loading} className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 flex items-center gap-2">
                                {loading && <Loader2 className="w-5 h-5 animate-spin" />} {editMode ? 'حفظ الصلاحيات والبيانات' : 'حفظ وإنشاء الحساب'}
                            </button>
                        </div>

                    </div>
                </div>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {deleteModal.open && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-[#1e293b] w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-gray-200 dark:border-slate-700 text-center animate-in zoom-in-95">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertCircle className="w-8 h-8 text-red-600" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">تأكيد الحذف</h3>
                        <p className="text-slate-500 text-sm mb-6">هل أنت متأكد من حذف المستخدم <b>"{deleteModal.name}"</b>؟ لا يمكن التراجع عن هذا الإجراء.</p>
                        <div className="flex gap-3 justify-center">
                            <button onClick={() => setDeleteModal({ open: false, id: '', name: '' })} className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition">إلغاء</button>
                            <button onClick={confirmDeleteUser} disabled={loading} className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-red-900/20">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} حذف نهائي
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Team;
