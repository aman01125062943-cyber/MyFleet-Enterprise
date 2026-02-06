
import React, { useState } from 'react';
import { Check, Zap, Crown } from 'lucide-react';
import { Plan } from '../types';

interface PricingSectionProps {
    plans: Plan[];
    onSelectPlan: (plan: Plan) => void;
}

const PricingSection: React.FC<PricingSectionProps> = ({ plans, onSelectPlan }) => {
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

    const trialPlan = plans.find(p => p.price === 0);
    const displayedPlans = plans.filter(p => p.interval === billingCycle && p.price > 0);

    return (
        <div className="py-12 bg-slate-950" id="pricing">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">خطط أسعار تناسب الجميع</h2>
                    <p className="text-slate-400 text-lg">اختر الخطة المناسبة لحجم أعمالك، وابدأ رحلة النمو معنا.</p>

                    {/* Toggle Switch */}
                    <div className="flex items-center justify-center mt-8 gap-4">
                        <span className={`text-sm font-bold ${billingCycle === 'monthly' ? 'text-white' : 'text-slate-500'}`}>شهري</span>
                        <button
                            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
                            className="relative w-16 h-8 bg-slate-800 rounded-full transition-colors focus:outline-none"
                            aria-label="Toggle billing cycle"
                        >
                            <div className={`absolute top-1 left-1 w-6 h-6 bg-blue-600 rounded-full transition-transform ${billingCycle === 'yearly' ? 'translate-x-8' : 'translate-x-0'}`} />
                        </button>
                        <span className={`text-sm font-bold ${billingCycle === 'yearly' ? 'text-white' : 'text-slate-500'}`}>
                            سنوي <span className="text-emerald-500 text-xs">(خصم يصل 20%)</span>
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {billingCycle === 'monthly' && trialPlan && (
                        <PricingCard plan={trialPlan} onSelect={onSelectPlan} />
                    )}

                    {displayedPlans.map(plan => (
                        <PricingCard key={plan.id} plan={plan} onSelect={onSelectPlan} billingCycle={billingCycle} />
                    ))}
                </div>
            </div>
        </div>
    );
};

const PricingCard: React.FC<{ plan: Plan, onSelect: (p: Plan) => void, billingCycle?: 'monthly' | 'yearly' }> = ({ plan, onSelect, billingCycle }) => {
    const isTrial = plan.price === 0;
    const isFeatured = plan.is_featured;

    let buttonClass = "w-full py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 ";
    if (isTrial) {
        buttonClass += "bg-slate-800 text-white hover:bg-slate-700";
    } else if (isFeatured) {
        buttonClass += "bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/25";
    } else {
        buttonClass += "bg-slate-800 text-white hover:bg-slate-700";
    }

    return (
        <div className={`relative flex flex-col p-6 rounded-3xl border transition-all duration-300 hover:scale-105 ${isFeatured ? 'bg-blue-600/10 border-blue-500 shadow-xl shadow-blue-500/10' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}>
            {isFeatured && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg flex items-center gap-1">
                    <Crown className="w-3 h-3" /> الأكثر طلباً
                </div>
            )}

            <div className="mb-6">
                <h3 className="text-xl font-bold text-white mb-2">{plan.name_ar}</h3>
                <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">{plan.price === 0 ? 'مجاناً' : plan.price}</span>
                    <span className="text-sm text-slate-400">{plan.price === 0 ? '' : 'ج.م'}</span>
                    <span className="text-sm text-slate-500">/{billingCycle === 'yearly' ? 'سنوياً' : 'شهرياً'}</span>
                </div>
                {plan.price_before_discount && (
                    <div className="mt-1 flex items-center gap-2">
                        <span className="text-sm text-slate-500 line-through">{plan.price_before_discount} ج.م</span>
                        {plan.discount_text && (
                            <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">{plan.discount_text}</span>
                        )}
                    </div>
                )}
            </div>

            <div className="flex-1 space-y-4 mb-8">
                {Object.entries(plan.features).filter(([_, v]) => v === true).map(([key]) => ( // Naive feature list, mapping needed for proper labels
                    <div key={key} className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${isTrial ? 'bg-slate-800 text-slate-400' : 'bg-blue-500/20 text-blue-400'}`}>
                            <Check className="w-3 h-3" />
                        </div>
                        <span className="text-slate-300 text-sm">{getFeatureLabel(key)}</span>
                    </div>
                ))}
            </div>

            <button
                onClick={() => onSelect(plan)}
                className={buttonClass}
            >
                {isTrial ? 'بدء التجربة مجاناً' : 'اشترك الآن'}
                {!isTrial && <Zap className="w-4 h-4" />}
            </button>
        </div>
    );
};

// Helper for labels
const getFeatureLabel = (key: string): string => {
    const labels: Record<string, string> = {
        reports: 'تقارير متقدمة',
        export: 'تصدير البيانات (Excel/PDF)',
        priority_support: 'دعم فني ذو أولوية',
        inventory: 'إدارة أسطول السيارات',
        finance: 'الإدارة المالية والمصروفات',
        team: 'إدارة فريق العمل',
        maintenance: 'جدولة الصيانة الدورية',
        assets: 'إدارة الأصول الثابتة',
        max_users: 'عدد غير محدود من المستخدمين', // Needs logic if number
        max_cars: 'عدد غير محدود من السيارات'
    };
    return labels[key] || key;
}

export default PricingSection;
