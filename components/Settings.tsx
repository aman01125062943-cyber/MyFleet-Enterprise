import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Organization, OrgSettings, Driver } from '../types';
import { useOutletContext } from 'react-router-dom';
import { LayoutContextType } from './Layout';
import { useToast } from './ToastProvider';
import {
  User, Users, LogOut, Shield, Plus, Trash2, AlertCircle, FileText,
  Building, CreditCard, Lock, Save, Loader2, Printer, TrendingUp, TrendingDown, Edit
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { performGlobalLogout } from '../lib/authUtils';

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'general' | 'branding' | 'drivers' | 'templates' | 'security' | 'announcements'>('general');

  const { user: currentUser, org: contextOrg } = useOutletContext<LayoutContextType>();

  // Use context org if available, or local state if we need to fetch/update it separately (usually context is enough)
  const [org, setOrg] = useState<Organization | null>(null);

  // Sync context org to local state for editing
  useEffect(() => {
    if (contextOrg) {
      setOrg(contextOrg);
      if (contextOrg.settings) setBranding(contextOrg.settings);
    }
  }, [contextOrg]);

  const [loading, setLoading] = useState(true); // Initial loading state
  const [actionLoading, setActionLoading] = useState(false);

  // Drivers State
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [newDriver, setNewDriver] = useState({ full_name: '', phone_number: '', license_number: '' });

  // Expense Templates State
  const [templates, setTemplates] = useState<any[]>([]);
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null); // To track editing
  const [newTemplate, setNewTemplate] = useState({ title: '', amount: '', category: '', type: 'expense', is_active: true });

  // Password Change State
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });

  // Branding Settings State
  const [branding, setBranding] = useState<OrgSettings>({
    logo_url: '',
    address: '',
    phone: '',
    footer_text: ''
  });

  useEffect(() => {
    const loadData = async () => {
      // Use currentUser from context instead of localStorage
      if (currentUser && currentUser.org_id) {
        // 2. Fetch Drivers
        const { data: driversData } = await supabase.from('drivers').select().eq('org_id', currentUser.org_id).order('created_at', { ascending: false });
        if (driversData) setDrivers(driversData as Driver[]);

        // 3. Fetch Templates
        const { data: templatesData } = await supabase.from('expense_templates').select().eq('user_id', currentUser.id).order('created_at', { ascending: false });
        if (templatesData) setTemplates(templatesData);
      }
      setLoading(false);
    };

    if (currentUser) {
      loadData();
    }
  }, [currentUser]);

  // --- Handlers ---

  const handleLogout = () => {
    // Use centralized logout function
    performGlobalLogout({ reason: 'user_initiated' });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (passwordData.new !== passwordData.confirm) {
      showToast('كلمة المرور الجديدة غير متطابقة', 'error'); return;
    }
    if (passwordData.new.length < 6) {
      showToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error'); return;
    }
    setActionLoading(true);
    // استخدام Supabase Auth API بدلاً من RPC القديم
    const { error } = await supabase.auth.updateUser({
      password: passwordData.new
    });
    setActionLoading(false);
    if (!error) {
      showToast('تم تغيير كلمة المرور بنجاح', 'success');
      setPasswordData({ current: '', new: '', confirm: '' });
    } else {
      showToast('خطأ: ' + error.message, 'error');
    }
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org) {
      showToast('خطأ: لم يتم العثور على بيانات المنشأة. يرجى إعادة تسجيل الدخول.', 'error');
      return;
    }

    setActionLoading(true);
    const { error } = await supabase.from('organizations').update({ settings: branding }).eq('id', org.id);
    setActionLoading(false);

    if (!error) {
      showToast('تم حفظ إعدادات الهوية بنجاح', 'success');
    } else {
      console.error('Save Error:', error);
      showToast('خطأ أثناء الحفظ: ' + error.message, 'error');
    }
  };

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.org_id) {
      showToast('عذراً، لم يتم العثور على معرف المنشأة. يرجى تسجيل الدخول مجدداً.', 'error');
      return;
    }

    setActionLoading(true);
    const { data, error } = await supabase.from('drivers').insert({
      org_id: currentUser.org_id,
      full_name: newDriver.full_name,
      phone_number: newDriver.phone_number,
      license_number: newDriver.license_number,
      status: 'active'
    }).select().single();

    setActionLoading(false);

    if (!error && data) {
      setDrivers([data, ...drivers]);
      setShowAddDriver(false);
      setNewDriver({ full_name: '', phone_number: '', license_number: '' });
      showToast('تم إضافة السائق بنجاح', 'success');
    } else {
      showToast('خطأ في الإضافة: ' + error?.message, 'error');
    }
  };

  const handleDeleteDriver = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا السائق؟')) return;
    const { error } = await supabase.from('drivers').delete().eq('id', id);
    if (!error) {
      setDrivers(drivers.filter(d => d.id !== id));
      showToast('تم حذف السائق بنجاح', 'success');
    } else {
      showToast('خطأ أثناء الحذف', 'error');
    }
  };

  const handleAddTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Attempting to add template...', newTemplate);

    if (!currentUser) {
      showToast('خطأ: لم يتم التعرف على المستخدم الحالي. يرجى إعادة تسجيل الدخول.', 'error');
      return;
    }

    if (!newTemplate.title || !newTemplate.category) {
      showToast('يرجى ملء جميع الحقول المطلوبة', 'warning');
      return;
    }

    setActionLoading(true);

    // --- Auto-Add New Category Logic ---
    try {
      const type = newTemplate.type as 'income' | 'expense';
      const currentSettings = currentUser.settings || {};
      const categories = currentSettings.transaction_categories || { income: [], expense: [] };

      // Initialize if undefined
      if (!categories.income) categories.income = [];
      if (!categories.expense) categories.expense = [];

      const existingList = categories[type];
      const isExisting = existingList.some((c: any) => c.label === newTemplate.category || c.id === newTemplate.category);

      if (!isExisting) {
        // Add new category
        const newCatId = newTemplate.category.trim().replace(/\s+/g, '_').toLowerCase();
        const newCategoryObj = { id: newCatId, label: newTemplate.category };

        categories[type].push(newCategoryObj);

        // Update Profile
        await supabase.from('profiles').update({
          settings: {
            ...currentSettings,
            transaction_categories: categories
          }
        }).eq('id', currentUser.id);

        console.log('Auto-added new category:', newCategoryObj);
      }
    } catch (err) {
      console.error('Error auto-adding category:', err);
      // Continue even if this fails, main task is adding template
    }
    // -----------------------------------

    const payload = {
      user_id: currentUser.id,
      title: newTemplate.title,
      amount: parseFloat(newTemplate.amount) || 0,
      category: newTemplate.category,
      type: newTemplate.type,
      is_active: newTemplate.is_active
    };
    console.log('Payload:', payload);

    let result;
    if (editingTemplateId) {
      // Update existing
      result = await supabase.from('expense_templates').update(payload).eq('id', editingTemplateId).select().single();
    } else {
      // Insert new
      result = await supabase.from('expense_templates').insert(payload).select().single();
    }

    const { data, error } = result;

    setActionLoading(false);

    if (!error && data) {
      if (editingTemplateId) {
        setTemplates(templates.map(t => t.id === editingTemplateId ? data : t));
        showToast('تم تحديث القالب بنجاح', 'success');
      } else {
        setTemplates([data, ...templates]);
        showToast('تم إضافة القالب بنجاح', 'success');
      }
      setShowAddTemplate(false);
      setEditingTemplateId(null); // Reset
      setNewTemplate({ title: '', amount: '', category: '', type: 'expense', is_active: true });
    } else {
      console.error('Supabase Error:', error);
      showToast('خطأ أثناء الحفظ: ' + (error?.message || 'Unknown error'), 'error');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('هل تريد حذف هذا القالب؟')) return;
    const { error } = await supabase.from('expense_templates').delete().eq('id', id);
    if (!error) {
      setTemplates(templates.filter(t => t.id !== id));
      showToast('تم حذف القالب', 'success');
    } else {
      showToast('خطأ أثناء الحذف', 'error');
    }
  };

  // --- Render Helpers ---

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-8 animate-pulse">
        <div className="h-8 bg-slate-800 rounded w-1/3"></div>
        <div className="flex gap-4 border-b border-slate-700 pb-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-10 bg-slate-800 rounded w-24"></div>)}
        </div>
        <div className="h-64 bg-slate-800 rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 font-[Cairo] pb-20">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-slate-800 dark:text-white">
        <div>
          <h1 className="text-3xl font-bold mb-1">الإعدادات</h1>
          <p className="text-slate-500 text-sm">إدارة بيانات المنشأة، السائقين، والأمان</p>
        </div>
        <button onClick={handleLogout} className="bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-500 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition">
          <LogOut className="w-4 h-4" /> تسجيل خروج
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-700 pb-1">
        {[
          { id: 'general', label: 'عام واشتراكي', icon: Building },
          { id: 'branding', label: 'هوية التقرير', icon: Printer },
          { id: 'drivers', label: 'إدارة السائقين', icon: Users },
          { id: 'templates', label: 'قوالب المصاريف', icon: FileText }, // New!
          { id: 'security', label: 'الأمان', icon: Lock },
          // Only show Announcements for Super Admin (Platform Owner) who has NO org_id
          ...(currentUser?.role === 'admin' && !currentUser?.org_id ? [{ id: 'announcements', label: 'إدارة التحديثات', icon: AlertCircle }] : []),
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-3 rounded-t-xl font-bold text-sm flex items-center gap-2 transition border-b-2 ${activeTab === tab.id
              ? 'bg-white dark:bg-slate-800 border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
              }`}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="min-h-[400px]">

        {/* 1. GENERAL TAB */}
        {activeTab === 'general' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-2 fade-in">
            {/* Subscription Card */}
            <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden relative group shadow-sm">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-bl-full -mr-8 -mt-8 transition group-hover:bg-emerald-500/20"></div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-500" /> تفاصيل الباقة
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 dark:bg-[#0f172a] p-4 rounded-xl border border-gray-100 dark:border-slate-700">
                    <div className="text-slate-500 dark:text-slate-400 text-xs mb-1">الخطة الحالية</div>
                    <div className="text-emerald-600 dark:text-emerald-400 font-bold text-xl uppercase">{org?.subscription_plan || 'Free'}</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-[#0f172a] p-4 rounded-xl border border-gray-100 dark:border-slate-700">
                    <div className="text-slate-500 dark:text-slate-400 text-xs mb-1">تاريخ الانتهاء</div>
                    <div className="text-slate-800 dark:text-white font-mono font-bold">{org?.subscription_end || 'غير محدود'}</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-[#0f172a] p-4 rounded-xl border border-gray-100 dark:border-slate-700 flex flex-col justify-center items-center text-center">
                    <div className="text-slate-500 dark:text-slate-400 text-xs mb-1">حالة الاشتراك</div>
                    <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full text-xs font-bold">نشط</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Info */}
            <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-500" /> ملفي الشخصي
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1">الاسم الكامل</label>
                  <div className="bg-gray-50 dark:bg-[#0f172a] p-3 rounded-xl text-slate-800 dark:text-white font-bold">{currentUser?.full_name}</div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1">اسم المستخدم</label>
                  <div className="bg-gray-50 dark:bg-[#0f172a] p-3 rounded-xl text-slate-800 dark:text-white font-mono">{currentUser?.username}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. BRANDING TAB */}
        {activeTab === 'branding' && (
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-gray-200 dark:border-slate-700 p-6 animate-in slide-in-from-bottom-2 fade-in shadow-sm">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1 flex items-center gap-2">
              <Printer className="w-5 h-5 text-purple-500" /> هوية التقارير
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">تخصيص الشعار والبيانات التي تظهر عند طباعة التقارير</p>

            <form onSubmit={handleSaveBranding} className="space-y-4 max-w-2xl">
              <div>
                <label className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2 block">رابط الشعار (Logo URL)</label>
                <input type="text" className="w-full px-4 py-3 bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-left ltr placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:border-purple-500 outline-none"
                  placeholder="https://example.com/logo.png"
                  value={branding.logo_url || ''} onChange={e => setBranding({ ...branding, logo_url: e.target.value })} />
                {branding.logo_url && (
                  <img src={branding.logo_url} alt="Logo Preview" className="h-12 mt-2 object-contain bg-slate-100 dark:bg-white/10 rounded p-1" />
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2 block">العنوان</label>
                  <input type="text" className="w-full px-4 py-3 bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-purple-500 outline-none"
                    placeholder="الرياض - العليا"
                    value={branding.address || ''} onChange={e => setBranding({ ...branding, address: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2 block">الهاتف</label>
                  <input type="text" className="w-full px-4 py-3 bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-purple-500 outline-none"
                    placeholder="011-xxxxxxx"
                    value={branding.phone || ''} onChange={e => setBranding({ ...branding, phone: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2 block">نص التذييل (Footer)</label>
                <input type="text" className="w-full px-4 py-3 bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-purple-500 outline-none"
                  placeholder="شكرا لتعاملكم معنا..."
                  value={branding.footer_text || ''} onChange={e => setBranding({ ...branding, footer_text: e.target.value })} />
              </div>
              <button disabled={actionLoading} className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 mt-4 transition">
                {actionLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />} حفظ الإعدادات
              </button>
            </form>
          </div>
        )}

        {/* 3. DRIVERS TAB (New Feature 🚀) */}
        {activeTab === 'drivers' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-2 fade-in">
            {/* Stats / Header */}
            <div className="flex justify-between items-center bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-orange-500" /> قائمة السائقين
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">إجمالي السائقين المسجلين: <span className="text-slate-800 dark:text-white font-bold">{drivers.length}</span></p>
              </div>
              <button onClick={() => setShowAddDriver(true)} className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-orange-900/20 transition">
                <Plus className="w-4 h-4" /> إضافة سائق
              </button>
            </div>

            {/* Drivers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {drivers.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-500 border-2 border-dashed border-slate-700 rounded-2xl">
                  <User className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>لا يوجد سائقين مسجلين حالياً</p>
                </div>
              ) : (
                drivers.map(driver => (
                  <div key={driver.id} className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-gray-200 dark:border-slate-700 hover:border-orange-500/50 transition group relative shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center font-bold text-slate-600 dark:text-slate-300">
                          {driver.full_name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 dark:text-white">{driver.full_name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">{driver.phone_number}</div>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteDriver(driver.id)} className="text-slate-400 hover:text-red-500 transition opacity-0 group-hover:opacity-100">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-700/50 flex justify-between items-center text-xs">
                      <span className="text-slate-500">رخصة: <span className="text-slate-800 dark:text-slate-300 font-mono">{driver.license_number || '-'}</span></span>
                      <span className={`px-2 py-0.5 rounded-full ${driver.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        {driver.status === 'active' ? 'نشط' : 'إجازة'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add Driver Modal */}
            {showAddDriver && (
              <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-[#1e293b] w-full max-w-sm rounded-2xl border border-gray-200 dark:border-slate-700 p-6 animate-in zoom-in-95 shadow-2xl">
                  <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4">إضافة سائق جديد</h3>
                  <form onSubmit={handleAddDriver} className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">الاسم الثلاثي</label>
                      <input required className="w-full bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white focus:border-orange-500 outline-none"
                        value={newDriver.full_name} onChange={e => setNewDriver({ ...newDriver, full_name: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">رقم الجوال</label>
                      <input required className="w-full bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white focus:border-orange-500 outline-none"
                        value={newDriver.phone_number} onChange={e => setNewDriver({ ...newDriver, phone_number: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">رقم الرخصة</label>
                      <input className="w-full bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white focus:border-orange-500 outline-none"
                        value={newDriver.license_number} onChange={e => setNewDriver({ ...newDriver, license_number: e.target.value })} />
                    </div>
                    <div className="flex gap-3 mt-6">
                      <button type="button" onClick={() => setShowAddDriver(false)} className="flex-1 py-3 bg-slate-800 text-slate-400 rounded-xl font-bold hover:bg-slate-700">إلغاء</button>
                      <button type="submit" disabled={actionLoading} className="flex-1 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-500">
                        {actionLoading ? <Loader2 className="animate-spin w-4 h-4 mx-auto" /> : 'حفظ'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. TEMPLATES TAB */}
        {activeTab === 'templates' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-2 fade-in">
            <div className="flex justify-between items-center bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-500" /> قوالب المصاريف الجاهزة
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">أنشئ قوالب سريعة (مثل: بنزين، تغيير زيت) لاستخدامها في صفحة تسجيل المصاريف.</p>
              </div>
              <button onClick={() => {
                setEditingTemplateId(null);
                setNewTemplate({ title: '', amount: '', category: '', type: 'expense', is_active: true });
                setShowAddTemplate(true);
              }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition shadow-lg shadow-blue-500/20">
                <Plus className="w-4 h-4" /> إضافة قالب جديد
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-500 border-2 border-dashed border-slate-700 rounded-2xl">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>لا توجد قوالب مضافة. أضف قالبك الأول الآن!</p>
                </div>
              ) : (
                templates.map(t => (
                  <div key={t.id} className={`p-4 rounded-2xl border relative group shadow-sm transition-all hover:shadow-md ${t.type === 'income' ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800' : 'bg-red-50/50 border-red-200 dark:bg-red-900/10 dark:border-red-800'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${t.type === 'income' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30' : 'bg-red-100 text-red-600 dark:bg-red-900/30'}`}>
                          {t.type === 'income' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 dark:text-white text-base">{t.title}</div>
                          <div className={`text-xs ${t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                            {t.type === 'income' ? 'قالب إيراد' : 'قالب مصروف'}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => {
                          setEditingTemplateId(t.id);
                          setNewTemplate({
                            title: t.title,
                            amount: t.amount.toString(),
                            category: t.category,
                            type: t.type,
                            is_active: t.is_active
                          });
                          setShowAddTemplate(true);
                        }} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition" title="تعديل">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteTemplate(t.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition" title="حذف">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-sm mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50">
                      <span className="bg-white dark:bg-slate-800 px-2 py-1 rounded text-slate-600 dark:text-slate-300 text-xs shadow-sm border border-gray-100 dark:border-slate-700">{t.category}</span>
                      <span className={`font-bold text-lg ${t.type === 'income' ? 'text-emerald-600' : 'text-slate-700 dark:text-slate-300'}`}>{t.amount} <span className="text-xs text-slate-400 font-normal">ج.م</span></span>
                    </div>
                  </div>
                )))}

            </div>

            {/* Add Template Modal */}
            {showAddTemplate && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-[#1e293b] w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-gray-200 dark:border-slate-700 animate-in zoom-in-95">
                  <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6">
                    {editingTemplateId ? 'تعديل القالب' : 'إضافة قالب جديد'}
                  </h3>

                  <form onSubmit={handleAddTemplate} className="space-y-4">

                    {/* Type Selection */}
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                      <button type="button" onClick={() => setNewTemplate({ ...newTemplate, type: 'expense' })}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${newTemplate.type === 'expense' ? 'bg-white dark:bg-slate-700 shadow text-red-600' : 'text-slate-500'}`}>
                        مصروف
                      </button>
                      <button type="button" onClick={() => setNewTemplate({ ...newTemplate, type: 'income' })}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${newTemplate.type === 'income' ? 'bg-white dark:bg-slate-700 shadow text-emerald-600' : 'text-slate-500'}`}>
                        إيراد
                      </button>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">اسم القالب (يظهر في الزر)</label>
                      <input required className="w-full bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white focus:border-blue-500 outline-none"
                        placeholder="مثال: بنزين 92"
                        value={newTemplate.title} onChange={e => setNewTemplate({ ...newTemplate, title: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">المبلغ (اختياري)</label>
                      <input type="number" step="0.01" className="w-full bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white focus:border-blue-500 outline-none"
                        placeholder="0.00"
                        value={newTemplate.amount} onChange={e => setNewTemplate({ ...newTemplate, amount: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">التصنيف الافتراضي (يدوي)</label>
                      <input required type="text" className="w-full bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white focus:border-blue-500 outline-none"
                        placeholder="اكتب التصنيف هنا..."
                        value={newTemplate.category} onChange={e => setNewTemplate({ ...newTemplate, category: e.target.value })} />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={() => setShowAddTemplate(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold rounded-xl hover:bg-slate-200 transition">إلغاء</button>
                      <button disabled={actionLoading} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition">
                        {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {editingTemplateId ? 'حفظ التعديلات' : 'حفظ القالب'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 5. SECURITY TAB Starts Here... (Renumbered logically) */}
        {activeTab === 'security' && (
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-gray-200 dark:border-slate-700 p-6 max-w-lg animate-in slide-in-from-bottom-2 fade-in shadow-sm">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
              <Shield className="w-5 h-5 text-red-500" /> المنطقة الأمنة
            </h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-2">كلمة المرور الجديدة</label>
                <input type="password" required className="w-full px-4 py-3 bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-red-500 outline-none"
                  value={passwordData.new} onChange={e => setPasswordData({ ...passwordData, new: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-2">تأكيد كلمة المرور</label>
                <input type="password" required className="w-full px-4 py-3 bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-red-500 outline-none"
                  value={passwordData.confirm} onChange={e => setPasswordData({ ...passwordData, confirm: e.target.value })} />
              </div>
              <button disabled={actionLoading} className="w-full bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition">
                {actionLoading && <Loader2 className="animate-spin w-4 h-4" />}
                تغيير كلمة المرور
              </button>
            </form>
          </div>
        )}

        {/* 5. ANNOUNCEMENTS TAB (SUPER ADMIN ONLY) */}
        {activeTab === 'announcements' && (currentUser?.role === 'owner' || currentUser?.role === 'admin') && (
          <AnnouncementSettings />
        )}
      </div>
    </div>
  );
};

// --- Sub-Component for Announcement Settings ---
const AnnouncementSettings: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    title: '', body: '', target_plans: [] as string[], show: false, version: '1.0'
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    const { data } = await supabase.from('public_config').select('announcement_data, show_announcement').eq('id', 1).single();
    if (data) {
      setData({
        title: data.announcement_data?.title || '',
        body: data.announcement_data?.body || '',
        target_plans: data.announcement_data?.target_plans || [],
        show: data.show_announcement || false,
        version: data.announcement_data?.version || '1.0',
      });
    }
  };

  const handleSave = async () => {
    setLoading(true);
    const payload = {
      title: data.title,
      body: data.body,
      target_plans: data.target_plans,
      date: new Date().toISOString().split('T')[0],
      version: new Date().getTime().toString() // New version to force re-show
    };

    const { error } = await supabase.from('public_config').update({
      announcement_data: payload,
      show_announcement: data.show
    }).eq('id', 1);

    setLoading(false);
    if (!error) alert('تم حفظ ونشر التحديث بنجاح ✅');
    else alert('خطأ: ' + error.message);
  };

  const togglePlan = (plan: string) => {
    if (data.target_plans.includes(plan)) {
      setData({ ...data, target_plans: data.target_plans.filter(p => p !== plan) });
    } else {
      setData({ ...data, target_plans: [...data.target_plans, plan] });
    }
  };

  return (
    <div className="bg-[#1e293b] rounded-2xl border border-slate-700 p-6 animate-in slide-in-from-bottom-2 fade-in relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-bl-full -mr-8 -mt-8"></div>

      <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-blue-500" /> إدارة نافذة التحديثات
      </h3>

      <div className="space-y-4 max-w-2xl">
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 mb-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={data.show}
              onChange={e => setData({ ...data, show: e.target.checked })}
              className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <div className="font-bold text-white">تفعيل نافذة التحديثات</div>
              <div className="text-xs text-slate-400">عند التفعيل، ستظهر النافذة للمستخدمين المستهدفين عند فتح التطبيق.</div>
            </div>
          </label>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-300 mb-2">عنوان التحديث</label>
          <input
            value={data.title}
            onChange={e => setData({ ...data, title: e.target.value })}
            className="w-full px-4 py-3 bg-[#0f172a] border border-slate-700 rounded-xl text-white focus:border-blue-500 outline-none"
            placeholder="مثال: ميزة جديدة: إدارة الأصول والموظفين"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-300 mb-2">نص التحديث</label>
          <textarea
            value={data.body}
            onChange={e => setData({ ...data, body: e.target.value })}
            rows={4}
            className="w-full px-4 py-3 bg-[#0f172a] border border-slate-700 rounded-xl text-white focus:border-blue-500 outline-none"
            placeholder="اكتب تفاصيل التحديث هنا..."
          ></textarea>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-300 mb-2">الباقات المستهدفة</label>
          <div className="flex gap-4">
            <button
              onClick={() => togglePlan('pro')}
              className={`px-4 py-2 rounded-lg border text-sm font-bold transition-all ${data.target_plans.includes('pro') ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
            >
              باقة المحترف (Pro)
            </button>
            <button
              onClick={() => togglePlan('starter')}
              className={`px-4 py-2 rounded-lg border text-sm font-bold transition-all ${data.target_plans.includes('starter') ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
            >
              باقة البداية (Starter)
            </button>
            <button
              onClick={() => togglePlan('trial')}
              className={`px-4 py-2 rounded-lg border text-sm font-bold transition-all ${data.target_plans.includes('trial') ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
            >
              نسخة تجريبية (Trial)
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">* اترك الجميع غير محدد لإظهارها للكافة.</p>
        </div>

        <button
          onClick={handleSave}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 mt-4 transition shadow-lg shadow-blue-500/20"
        >
          {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
          حفظ ونشر التحديث
        </button>
      </div>
    </div>
  );
};

export default Settings;
