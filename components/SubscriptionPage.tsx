import React, { useState, useEffect } from 'react';
import {
    CreditCard,
    Smartphone,
    Upload,
    Send,
    Check,
    X,
    Loader2,
    Crown,
    Zap,
    Building2,
    Clock,
    Users,
    Car,
    FileText,
    Bell,
    Download,
    Headphones,
    Package,
    Tag,
    CheckCircle2,
    ArrowLeft,
    Wallet,
    Wrench,
    BarChart3
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Plan, PaymentMethod, Organization, Profile, SystemConfig } from '../types';

interface SubscriptionPageProps {
    organization: Organization;
    user: Profile;
    whatsappNumber: string;
    onClose?: () => void;
}

// ==================== صفحة الاشتراك الرئيسية ====================
const SubscriptionPage: React.FC<SubscriptionPageProps> = ({
    organization,
    user,
    whatsappNumber,
    onClose
}) => {
    const [step, setStep] = useState<'plans' | 'payment' | 'confirm'>('plans');
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    const [discountCode, setDiscountCode] = useState('');
    const [discountValidation, setDiscountValidation] = useState<{
        valid: boolean;
        type?: 'percentage' | 'fixed';
        value?: number;
        error?: string;
    } | null>(null);
    const [validatingCode, setValidatingCode] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
    const [referenceNumber, setReferenceNumber] = useState('');
    const [receiptFile, setReceiptFile] = useState<globalThis.File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [config, setConfig] = useState<SystemConfig | null>(null);

    useEffect(() => {
        const fetchConfig = async () => {
            const { data } = await supabase.from('public_config').select('*').eq('id', 1).single();
            if (data) setConfig(data);
        };
        fetchConfig();
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('plans')
            .select('*')
            .eq('is_active', true)
            .order('sort_order');

        if (data) {
            // تجاهل الباقة التجريبية إذا تم استخدامها مسبقاً
            const filteredPlans = data.filter(p => !(p.is_trial && organization.has_used_trial));
            setPlans(filteredPlans);
        }
        setLoading(false);
    };

    const validateDiscountCode = async () => {
        if (!discountCode.trim() || !selectedPlan) return;

        setValidatingCode(true);
        const { data, error } = await supabase.rpc('validate_discount_code', {
            p_code: discountCode.trim(),
            p_plan_id: selectedPlan.id
        });

        if (error) {
            setDiscountValidation({ valid: false, error: 'حدث خطأ أثناء التحقق' });
        } else if (data) {
            setDiscountValidation({
                valid: data.valid,
                type: data.discount_type,
                value: data.discount_value,
                error: data.error
            });
        }
        setValidatingCode(false);
    };

    const calculatePrice = () => {
        if (!selectedPlan) return { original: 0, discount: 0, final: 0 };

        const original = billingCycle === 'yearly'
            ? selectedPlan.price_yearly
            : selectedPlan.price_monthly;

        let discount = 0;
        if (discountValidation?.valid) {
            if (discountValidation.type === 'percentage') {
                discount = (original * (discountValidation.value || 0)) / 100;
            } else {
                discount = discountValidation.value || 0;
            }
        }

        return {
            original,
            discount,
            final: Math.max(0, original - discount)
        };
    };

    const handleFileUpload = async (file: globalThis.File) => {
        setReceiptFile(file);
    };

    const submitPaymentRequest = async () => {
        if (!selectedPlan || !paymentMethod || !receiptFile) return;

        // منع إرسال الطلب في وضع المعاينة
        if (organization.id === 'preview_mode') {
            alert('⚠️ وضع المعاينة: لا يمكن إرسال طلب دفع فعلي. يرجى تسجيل الدخول بحساب مستخدم عادي لإتمام العملية.');
            setSubmitting(false);
            return;
        }

        setSubmitting(true);

        try {
            // رفع صورة الإيصال
            const fileExt = receiptFile.name.split('.').pop();
            const fileName = `receipts/${organization.id}/${Date.now()}.${fileExt}`;

            setUploading(true);
            const { error: uploadError } = await supabase.storage
                .from('payments')
                .upload(fileName, receiptFile);

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
                .from('payments')
                .getPublicUrl(fileName);

            const receiptUrl = urlData?.publicUrl || '';
            setUploading(false);

            const prices = calculatePrice();

            // إنشاء طلب الدفع
            const { error: insertError } = await supabase
                .from('payment_requests')
                .insert({
                    org_id: organization.id,
                    user_id: user.id,
                    plan_id: selectedPlan.id,
                    billing_cycle: billingCycle,
                    amount: prices.original,
                    discount_code: discountValidation?.valid ? discountCode : null,
                    discount_amount: prices.discount,
                    final_amount: prices.final,
                    payment_method: paymentMethod,
                    reference_number: referenceNumber,
                    receipt_url: receiptUrl,
                    status: 'pending'
                });

            if (insertError) throw insertError;

            // إرسال إلى WhatsApp
            sendToWhatsApp(receiptUrl, prices);

            setSubmitSuccess(true);
        } catch {
            alert('حدث خطأ أثناء إرسال الطلب. يرجى المحاولة مرة أخرى.');
        }

        setSubmitting(false);
    };

    const sendToWhatsApp = (receiptUrl: string, prices: { original: number; discount: number; final: number }) => {
        const paymentMethodDisplay = paymentMethod === 'instapay'
            ? `💳 *InstaPay*`
            : `📱 *Vodafone Cash*`;

        const message = `
━━━━━━━━━━━━━━━━━━━━━
🚗 *طلب اشتراك جديد*
   *مدير الأسطول*
━━━━━━━━━━━━━━━━━━━━━

👤 *العميل:*
▪️ الاسم: ${user.full_name}
▪️ المنشأة: ${organization.name}
▪️ البريد: ${user.email || 'غير متوفر'}

━━━━━━━━━━━━━━━━━━━━━
📦 *تفاصيل الاشتراك:*
▪️ الباقة: ${selectedPlan?.name_ar}
▪️ الدورة: ${billingCycle === 'yearly' ? '📅 سنوي' : '📆 شهري'}
▪️ السعر: ${prices.original} جنيه
${prices.discount > 0 ? `▪️ 💰 الخصم: ${prices.discount} جنيه` : ''}
▪️ ✅ *الإجمالي: ${prices.final} جنيه*

━━━━━━━━━━━━━━━━━━━━━
${paymentMethodDisplay}
▪️ الرقم المرجعي: ${referenceNumber || 'غير متوفر'}

━━━━━━━━━━━━━━━━━━━━━
📎 *إيصال الدفع:*
${receiptUrl}

━━━━━━━━━━━━━━━━━━━━━
⏰ ${new Date().toLocaleDateString('ar-EG')} - ${new Date().toLocaleTimeString('ar-EG')}
        `.trim();

        const encodedMessage = encodeURIComponent(message);
        const cleanNumber = whatsappNumber.replaceAll(/\D/g, '');
        const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodedMessage}`;

        window.open(whatsappUrl, '_blank');
    };

    const getPlanIcon = (planId: string) => {
        switch (planId) {
            case 'trial': return <Clock className="w-8 h-8" />;
            case 'starter': return <Zap className="w-8 h-8" />;
            case 'pro': return <Crown className="w-8 h-8" />;
            case 'business': return <Building2 className="w-8 h-8" />;
            default: return <Package className="w-8 h-8" />;
        }
    };

    const getPlanColor = (planId: string) => {
        switch (planId) {
            case 'trial': return 'from-slate-500 to-slate-600';
            case 'starter': return 'from-blue-500 to-blue-600';
            case 'pro': return 'from-purple-500 to-purple-600';
            case 'business': return 'from-amber-500 to-amber-600';
            default: return 'from-gray-500 to-gray-600';
        }
    };

    const renderPlansStep = () => (
        <div className="space-y-6">
            {/* Billing Toggle */}
            <div className="flex justify-center mb-8">
                <div className="bg-slate-900 p-1 rounded-xl inline-flex">
                    <button
                        onClick={() => setBillingCycle('monthly')}
                        className={`px-6 py-2 rounded-lg font-medium transition ${billingCycle === 'monthly'
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        شهري
                    </button>
                    <button
                        onClick={() => setBillingCycle('yearly')}
                        className={`px-6 py-2 rounded-lg font-medium transition ${billingCycle === 'yearly'
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        سنوي <span className="text-emerald-400 text-xs mr-1">وفّر 17%</span>
                    </button>
                </div>
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {plans.map(plan => {
                    const price = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
                    const isSelected = selectedPlan?.id === plan.id;

                    return (
                        <button
                            key={plan.id}
                            type="button"
                            onClick={() => setSelectedPlan(plan)}
                            className={`w-full text-right relative bg-slate-900 border-2 rounded-2xl p-6 cursor-pointer transition-all hover:scale-[1.02] ${isSelected
                                ? 'border-blue-500 ring-4 ring-blue-500/20'
                                : 'border-slate-800 hover:border-slate-700'
                                }`}
                        >
                            {/* Featured Badge */}
                            {plan.id === 'pro' && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                                    الأكثر شعبية ⭐
                                </div>
                            )}

                            {/* Plan Icon */}
                            <div className={`w-16 h-16 bg-gradient-to-br ${getPlanColor(plan.id)} rounded-2xl flex items-center justify-center text-white mb-4`}>
                                {getPlanIcon(plan.id)}
                            </div>

                            {/* Plan Name */}
                            <h3 className="text-xl font-bold text-white mb-1">{plan.name_ar}</h3>
                            <p className="text-sm text-slate-500 mb-4">{plan.description_ar}</p>

                            {/* Price */}
                            <div className="mb-6">
                                {plan.is_trial ? (
                                    <div className="text-3xl font-bold text-emerald-400">مجاني</div>
                                ) : (
                                    <>
                                        <div className="text-3xl font-bold text-white">
                                            {price} <span className="text-lg text-slate-500">ج.م</span>
                                        </div>
                                        <div className="text-sm text-slate-500">
                                            / {billingCycle === 'yearly' ? 'سنة' : 'شهر'}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Features Comparison List */}
                            <ul className="space-y-3 mt-6 border-t border-slate-800 pt-6">
                                {/* Base Stats */}
                                <li className="flex items-center gap-3 text-sm">
                                    <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                                        <Car className="w-3 h-3 text-blue-400" />
                                    </div>
                                    <span className="text-slate-300">
                                        {plan.features.max_cars === 9999 ? 'عدد غير محدود' : plan.features.max_cars} <span className="text-slate-500">سيارة</span>
                                    </span>
                                </li>
                                <li className="flex items-center gap-3 text-sm">
                                    <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                                        <Users className="w-3 h-3 text-blue-400" />
                                    </div>
                                    <span className="text-slate-300">
                                        {plan.features.max_users === 9999 ? 'عدد غير محدود' : plan.features.max_users} <span className="text-slate-500">مستخدمين</span>
                                    </span>
                                </li>

                                {/* Feature List */}
                                {[
                                    { k: 'inventory', l: 'إدارة المخزون والسيارات', i: Car },
                                    { k: 'reports', l: 'التقارير المالية الأساسية', i: FileText },
                                    { k: 'advanced_reports', l: 'تحليلات وإحصائيات متقدمة', i: BarChart3 },
                                    { k: 'finance', l: 'إدارة الحركات المالية', i: Wallet },
                                    { k: 'maintenance', l: 'تتبع الصيانة الدورية', i: Wrench },
                                    { k: 'team', l: 'إدارة فريق العمل', i: Users },
                                    { k: 'assets', l: 'إدارة الأصول الثابتة', i: Building2 },
                                    { k: 'alerts', l: 'نظام التنبيهات الذكي', i: Bell },
                                    { k: 'export', l: 'تصدير البيانات Excel/PDF', i: Download },
                                    { k: 'priority_support', l: 'دعم فني أولوية VIP', i: Headphones },
                                ].map((feature) => {
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    const hasFeature = (plan.features as any)[feature.k] === true;
                                    const Icon = feature.i;

                                    return (
                                        <li key={feature.k} className="flex items-center gap-3 text-sm">
                                            {hasFeature ? (
                                                <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                                                    <Check className="w-3 h-3 text-emerald-500" />
                                                </div>
                                            ) : (
                                                <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center shrink-0 opacity-50">
                                                    <X className="w-3 h-3 text-slate-500" />
                                                </div>
                                            )}

                                            <span className={`flex items-center gap-2 ${hasFeature ? 'text-white font-medium' : 'text-slate-500 decoration-slate-600'}`}>
                                                {hasFeature && <Icon className="w-3 h-3 text-slate-400" />}
                                                {feature.l}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>

                            {/* Select Indicator */}
                            {isSelected && (
                                <div className="absolute top-4 right-4 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                                    <Check className="w-4 h-4 text-white" />
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Continue Button */}
            <div className="flex justify-center mt-8">
                <button
                    onClick={() => selectedPlan && setStep('payment')}
                    disabled={!selectedPlan}
                    className="px-12 py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-bold text-lg hover:from-blue-500 hover:to-blue-400 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25"
                >
                    متابعة للدفع
                </button>
            </div>
        </div>
    );

    const renderPaymentStep = () => (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Selected Plan Summary */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">ملخص الطلب</h3>
                <div className="flex items-center justify-between py-3 border-b border-slate-800">
                    <span className="text-slate-400">الباقة</span>
                    <span className="text-white font-medium">{selectedPlan?.name_ar}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-slate-800">
                    <span className="text-slate-400">الدورة</span>
                    <span className="text-white font-medium">{billingCycle === 'yearly' ? 'سنوي' : 'شهري'}</span>
                </div>
                <div className="flex items-center justify-between py-3">
                    <span className="text-slate-400">السعر</span>
                    <span className="text-2xl font-bold text-white">{calculatePrice().original} ج.م</span>
                </div>
            </div>

            {/* Discount Code */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Tag className="w-5 h-5 text-purple-400" />
                    كود الخصم
                </h3>
                <div className="flex gap-3">
                    <input
                        type="text"
                        value={discountCode}
                        onChange={e => {
                            setDiscountCode(e.target.value.toUpperCase());
                            setDiscountValidation(null);
                        }}
                        placeholder="أدخل كود الخصم"
                        className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 outline-none focus:border-purple-500"
                    />
                    <button
                        onClick={validateDiscountCode}
                        disabled={validatingCode || !discountCode.trim()}
                        className="px-6 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-500 transition disabled:opacity-50"
                    >
                        {validatingCode ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تحقق'}
                    </button>
                </div>
                {discountValidation && (
                    <div className={`mt-3 p-3 rounded-lg flex items-center gap-2 ${discountValidation.valid
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-red-500/10 text-red-400'
                        }`}>
                        {discountValidation.valid ? (
                            <>
                                <Check className="w-5 h-5" />
                                <span>
                                    تم تطبيق خصم {discountValidation.type === 'percentage'
                                        ? `${discountValidation.value}%`
                                        : `${discountValidation.value} ج.م`
                                    }
                                </span>
                            </>
                        ) : (
                            <>
                                <X className="w-5 h-5" />
                                <span>{discountValidation.error}</span>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Final Price */}
            {discountValidation?.valid && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-slate-400 line-through">{calculatePrice().original} ج.م</div>
                            <div className="text-emerald-400">وفّرت {calculatePrice().discount} ج.م</div>
                        </div>
                        <div className="text-3xl font-bold text-white">{calculatePrice().final} ج.م</div>
                    </div>
                </div>
            )}

            {/* Payment Methods */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">اختر طريقة الدفع</h3>
                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => setPaymentMethod('instapay')}
                        className={`p-6 rounded-xl border-2 transition flex flex-col items-center gap-3 ${paymentMethod === 'instapay'
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-slate-700 hover:border-slate-600'
                            }`}
                    >
                        <CreditCard className={`w-10 h-10 ${paymentMethod === 'instapay' ? 'text-blue-400' : 'text-slate-400'}`} />
                        <span className={`font-bold ${paymentMethod === 'instapay' ? 'text-blue-400' : 'text-slate-300'}`}>
                            InstaPay
                        </span>
                    </button>
                    <button
                        onClick={() => setPaymentMethod('vodafone_cash')}
                        className={`p-6 rounded-xl border-2 transition flex flex-col items-center gap-3 ${paymentMethod === 'vodafone_cash'
                            ? 'border-red-500 bg-red-500/10'
                            : 'border-slate-700 hover:border-slate-600'
                            }`}
                    >
                        <Smartphone className={`w-10 h-10 ${paymentMethod === 'vodafone_cash' ? 'text-red-400' : 'text-slate-400'}`} />
                        <span className={`font-bold ${paymentMethod === 'vodafone_cash' ? 'text-red-400' : 'text-slate-300'}`}>
                            Vodafone Cash
                        </span>
                    </button>
                </div>
            </div>

            {/* Payment Instructions */}
            {paymentMethod && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6">
                    <h4 className="font-bold text-amber-400 mb-3">تعليمات الدفع:</h4>
                    {paymentMethod === 'instapay' ? (
                        <ol className="list-decimal list-inside space-y-2 text-slate-300">
                            <li>افتح تطبيق البنك الخاص بك</li>
                            <li>اختر "تحويل InstaPay"</li>
                            <li>أدخل عنوان الدفع (UPA): <span className="font-mono bg-slate-800 px-2 py-1 rounded text-blue-400">{config?.instapay_handle || whatsappNumber}</span></li>
                            <li>أدخل المبلغ: <span className="font-bold text-white">{calculatePrice().final} ج.م</span></li>
                            <li>أكمل عملية التحويل واحتفظ بالإيصال</li>
                        </ol>
                    ) : (
                        <ol className="list-decimal list-inside space-y-2 text-slate-300">
                            <li>افتح تطبيق Vodafone Cash أو اتصل بـ *9*المبلغ*الرقم#</li>
                            <li>أرسل المبلغ إلى: <span className="font-mono bg-slate-800 px-2 py-1 rounded text-red-400">{config?.vodafone_cash_number || whatsappNumber}</span></li>
                            <li>المبلغ المطلوب: <span className="font-bold text-white">{calculatePrice().final} ج.م</span></li>
                            <li>احتفظ برسالة التأكيد</li>
                        </ol>
                    )}
                </div>
            )}

            {/* Navigation */}
            <div className="flex gap-4">
                <button
                    onClick={() => setStep('plans')}
                    className="flex-1 py-4 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition"
                >
                    رجوع
                </button>
                <button
                    onClick={() => paymentMethod && setStep('confirm')}
                    disabled={!paymentMethod}
                    className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 transition disabled:opacity-50"
                >
                    متابعة
                </button>
            </div>
        </div >
    );

    const renderConfirmStep = () => (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Upload Receipt */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Upload className="w-5 h-5 text-blue-400" />
                    رفع إيصال الدفع
                </h3>

                <label className="block">
                    <div className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${receiptFile
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-slate-700 hover:border-slate-600'
                        }`}>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                            className="hidden"
                        />
                        {receiptFile ? (
                            <div className="text-emerald-400">
                                <Check className="w-12 h-12 mx-auto mb-2" />
                                <p className="font-bold">{receiptFile.name}</p>
                                <p className="text-sm text-slate-400 mt-1">اضغط لتغيير الصورة</p>
                            </div>
                        ) : (
                            <div className="text-slate-400">
                                <Upload className="w-12 h-12 mx-auto mb-2" />
                                <p className="font-bold">اضغط لرفع صورة الإيصال</p>
                                <p className="text-sm mt-1">JPG, PNG أو PDF</p>
                            </div>
                        )}
                    </div>
                </label>
            </div>

            {/* Reference Number */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">الرقم المرجعي (اختياري)</h3>
                <input
                    type="text"
                    value={referenceNumber}
                    onChange={e => setReferenceNumber(e.target.value)}
                    placeholder="آخر 4 أرقام من رقم العملية"
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 outline-none focus:border-blue-500"
                />
            </div>

            {/* Final Summary */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">ملخص نهائي</h3>
                <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                        <span className="text-slate-400">الباقة</span>
                        <span className="text-white">{selectedPlan?.name_ar}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400">الدورة</span>
                        <span className="text-white">{billingCycle === 'yearly' ? 'سنوي' : 'شهري'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400">طريقة الدفع</span>
                        <span className="text-white">{paymentMethod === 'instapay' ? 'InstaPay' : 'Vodafone Cash'}</span>
                    </div>
                    <div className="border-t border-slate-800 pt-3 flex justify-between">
                        <span className="text-slate-400 font-bold">المبلغ الإجمالي</span>
                        <span className="text-xl font-bold text-white">{calculatePrice().final} ج.م</span>
                    </div>
                </div>
            </div>

            {/* Submit */}
            <div className="flex gap-4">
                <button
                    onClick={() => setStep('payment')}
                    className="flex-1 py-4 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition"
                >
                    رجوع
                </button>
                <button
                    onClick={submitPaymentRequest}
                    disabled={!receiptFile || submitting}
                    className="flex-1 py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-xl font-bold hover:from-emerald-500 hover:to-emerald-400 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {submitting ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            {uploading ? 'جاري رفع الإيصال...' : 'جاري الإرسال...'}
                        </>
                    ) : (
                        <>
                            <Send className="w-5 h-5" />
                            إرسال الطلب
                        </>
                    )}
                </button>
            </div>
        </div>
    );

    // ==================== عرض الخطوات ====================
    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            </div>
        );
    }

    if (submitSuccess) {
        return (
            <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center">
                    <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-3">تم إرسال طلبك بنجاح! 🎉</h2>
                    <p className="text-slate-400 mb-6">
                        سيتم مراجعة طلبك وتفعيل اشتراكك خلال 24 ساعة كحد أقصى.
                        سيتم إخطارك عند التفعيل.
                    </p>
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 transition"
                    >
                        العودة للوحة التحكم
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0f1a] p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-white">اختر باقتك</h1>
                        <p className="text-slate-400 mt-1">ابدأ رحلتك مع مدير الأسطول</p>
                    </div>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="flex items-center gap-2 text-slate-400 hover:text-white transition"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span>رجوع</span>
                        </button>
                    )}
                </div>

                {/* Progress Steps */}
                <div className="flex items-center justify-center gap-4 mb-8">
                    {[
                        { id: 'plans', label: 'الباقة' },
                        { id: 'payment', label: 'الدفع' },
                        { id: 'confirm', label: 'التأكيد' }
                    ].map((s, index) => {
                        const stepOrder = ['plans', 'payment', 'confirm'];
                        const currentStepIndex = stepOrder.indexOf(step);
                        const isCurrentStep = step === s.id;
                        const isCompletedStep = currentStepIndex > index;

                        let stepClass = 'bg-slate-800 text-slate-500';
                        if (isCurrentStep) {
                            stepClass = 'bg-blue-600 text-white';
                        } else if (isCompletedStep) {
                            stepClass = 'bg-emerald-600 text-white';
                        }

                        return (
                            <React.Fragment key={s.id}>
                                <div className={`flex items-center gap-2 ${step === s.id ? 'text-blue-400' : 'text-slate-500'}`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${stepClass}`}>
                                        {isCompletedStep ? <Check className="w-4 h-4" /> : index + 1}
                                    </div>
                                    <span className="hidden md:inline font-medium">{s.label}</span>
                                </div>
                                {index < 2 && <div className="w-12 h-0.5 bg-slate-800" />}
                            </React.Fragment>
                        );
                    })}
                </div>

                {/* Step 1: Plans Selection */}
                {step === 'plans' && renderPlansStep()}

                {/* Step 2: Payment Method */}
                {step === 'payment' && selectedPlan && renderPaymentStep()}

                {/* Step 3: Upload & Confirm */}
                {step === 'confirm' && selectedPlan && paymentMethod && renderConfirmStep()}
            </div>
        </div>
    );
};

export default SubscriptionPage;
