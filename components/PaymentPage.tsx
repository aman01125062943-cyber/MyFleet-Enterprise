
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plan, SystemConfig } from '../types';
import { Copy, ArrowRight, MessageCircle, AlertCircle, Loader2, Upload } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const PaymentPage: React.FC = () => {
    const { planId } = useParams<{ planId: string }>();
    const navigate = useNavigate();

    const [plan, setPlan] = useState<Plan | null>(null);
    const [config, setConfig] = useState<SystemConfig | null>(null);
    const [loading, setLoading] = useState(true);

    const [paymentMethod, setPaymentMethod] = useState<'instapay' | 'vodafone'>('instapay');
    const [referenceNumber, setReferenceNumber] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchData();
    }, [planId]);

    const fetchData = async () => {
        setLoading(true);
        const { data: configData } = await supabase.from('public_config').select('*').eq('id', 1).single();
        if (configData) {
            setConfig(configData);
            const foundPlan = configData.available_plans?.find((p: Plan) => p.id === planId);
            if (foundPlan) setPlan(foundPlan);
        }
        setLoading(false);
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('تم النسخ بنجاح!');
    };

    const handleConfirm = () => {
        if (referenceNumber.length < 4) {
            alert('يرجى إدخال آخر 4 أرقام من الرقم المرجعي بشكل صحيح.');
            return;
        }

        setIsSubmitting(true);

        const managerNumber = config?.whatsapp_number || '201000000000';
        // Fix: Use replace with regex to ensure all '+' are removed if multiple exist, though usually only one at start
        const cleanNumber = managerNumber.replace(/\+/g, '');

        const message = `مرحبا، لقد قمت بالتحويل للاشتراك في باقة:
*${plan?.name_ar}*
السعر: ${plan?.price} ج.م

تفاصيل الدفع:
طريقة الدفع: ${paymentMethod === 'instapay' ? 'InstaPay' : 'Vodafone Cash'}
الرقم المرجعي (آخر 4 أرقام): ${referenceNumber}

يرجى تفعيل حسابي.`;

        const waLink = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;

        setTimeout(() => {
            window.open(waLink, '_blank');
            setIsSubmitting(false);
        }, 1500);
    };

    if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white"><Loader2 className="animate-spin w-8 h-8" /></div>;
    if (!plan) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">الباقة غير موجودة</div>;

    const paymentNumber = "01012345678";

    return (
        <div className="min-h-screen bg-slate-950 font-[Cairo] text-white p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition">
                    <ArrowRight className="w-4 h-4" /> رجوع للباقات
                </button>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Order Summary */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 h-fit">
                        <h2 className="text-xl font-bold mb-6">ملخص الطلب</h2>
                        <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-800">
                            <span className="text-slate-400">الباقة</span>
                            <span className="font-bold text-lg">{plan.name_ar}</span>
                        </div>
                        <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-800">
                            <span className="text-slate-400">المدة</span>
                            <span className="font-bold">{plan.interval === 'yearly' ? 'سنة واحدة' : 'شهر واحد'}</span>
                        </div>
                        {plan.price_before_discount && (
                            <div className="flex items-center justify-between mb-2 text-sm text-slate-500 line-through">
                                <span>السعر الأصلي</span>
                                <span>{plan.price_before_discount} ج.م</span>
                            </div>
                        )}
                        <div className="flex items-center justify-between mt-4 text-xl font-bold text-emerald-400">
                            <span>الإجمالي</span>
                            <span>{plan.price} ج.م</span>
                        </div>
                    </div>

                    {/* Payment Details */}
                    <div>
                        <h1 className="text-3xl font-bold mb-2">إتمام الدفع</h1>
                        <p className="text-slate-400 mb-8">اختر وسيلة الدفع وأكمل عملية التحويل.</p>

                        {/* Methods */}
                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <button
                                onClick={() => setPaymentMethod('instapay')}
                                className={`p-4 rounded-xl border text-center transition ${paymentMethod === 'instapay' ? 'bg-purple-600/10 border-purple-500 text-purple-400' : 'bg-slate-900 border-slate-800 text-slate-500 hover:bg-slate-800'}`}
                            >
                                <div className="font-bold text-lg mb-1">InstaPay</div>
                                <div className="text-xs">تحويل لحظي</div>
                            </button>
                            <button
                                onClick={() => setPaymentMethod('vodafone')}
                                className={`p-4 rounded-xl border text-center transition ${paymentMethod === 'vodafone' ? 'bg-red-600/10 border-red-500 text-red-400' : 'bg-slate-900 border-slate-800 text-slate-500 hover:bg-slate-800'}`}
                            >
                                <div className="font-bold text-lg mb-1">Vodafone Cash</div>
                                <div className="text-xs">محفظة إلكترونية</div>
                            </button>
                        </div>

                        {/* Instruction Card */}
                        <div className="bg-slate-800/50 rounded-2xl p-6 mb-8 border border-slate-700 relative overflow-hidden">
                            <div className="relative z-10">
                                <h3 className="text-sm font-bold text-slate-400 mb-2">حول المبلغ إلى الرقم التالي:</h3>
                                <div className="flex items-center justify-between bg-slate-950 p-4 rounded-xl border border-slate-800">
                                    <span className="font-mono text-xl tracking-wider text-white">{paymentNumber}</span>
                                    <button onClick={() => handleCopy(paymentNumber)} aria-label="Copy number" className="text-blue-500 hover:text-blue-400 p-2"><Copy className="w-5 h-5" /></button>
                                </div>
                                <div className="mt-4 flex items-start gap-2 text-xs text-slate-400">
                                    <AlertCircle className="w-4 h-4 shrink-0 text-yellow-500" />
                                    <span>تأكد من الاحتفاظ بلقطة شاشة لعملية التحويل كإثبات للدفع.</span>
                                </div>
                            </div>
                        </div>

                        {/* Confirmation Form */}
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="ref-input" className="block text-sm font-bold text-slate-300 mb-2">آخر 4 أرقام من الرقم المرجعي (Reference No)</label>
                                <input
                                    id="ref-input"
                                    type="text"
                                    maxLength={4}
                                    placeholder="XXXX"
                                    value={referenceNumber}
                                    onChange={e => setReferenceNumber(e.target.value.replace(/\D/g, ''))}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-center text-2xl tracking-[1em] font-mono focus:border-blue-500 outline-none transition"
                                />
                            </div>

                            {/* Upload Receipt (Visual Only) */}
                            <div role="button" tabIndex={0} aria-label="Upload receipt" className="border-2 border-dashed border-slate-800 rounded-xl p-6 text-center hover:bg-slate-900/50 transition cursor-pointer group" onKeyDown={() => { }}>
                                <Upload className="w-8 h-8 mx-auto text-slate-500 mb-2 group-hover:text-blue-500 transition" />
                                <span className="text-sm text-slate-500 group-hover:text-slate-300">ارفاق صورة الإيصال (اختياري)</span>
                            </div>

                            <button
                                onClick={handleConfirm}
                                disabled={isSubmitting || referenceNumber.length < 4}
                                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {isSubmitting ? <Loader2 className="animate-spin" /> : <MessageCircle className="w-5 h-5" />}
                                تأكيد وإرسال عبر واتساب
                            </button>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentPage;
