
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Plan } from '../types';
import { Link } from 'react-router-dom';
import { ShieldCheck, Check, X, ArrowLeft } from 'lucide-react';

const PricingPage: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase.from('public_config').select('available_plans').single();
      if (data && data.available_plans) {
        setPlans(data.available_plans.filter((p: Plan) => p.is_active));
      }
      setLoading(false);
    };
    fetchConfig();
  }, []);

  return (
    <div className="min-h-screen bg-[#0f172a] text-white font-[Cairo]">
      <nav className="p-6 border-b border-slate-800">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
             <Link to="/" className="flex items-center gap-2 text-white font-bold text-lg"><ShieldCheck className="w-6 h-6 text-blue-500"/> MyFleet</Link>
             <Link to="/login" className="text-slate-400 hover:text-white flex items-center gap-2"><ArrowLeft className="w-4 h-4"/> العودة للدخول</Link>
          </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-16 text-center">
        <h1 className="text-3xl md:text-5xl font-bold mb-4">خطط أسعار مرنة تناسب حجم وكالتك</h1>
        <p className="text-slate-400 mb-12">اختر الباقة المناسبة لاحتياجاتك وابدأ في تنظيم أسطولك اليوم</p>

        {loading ? <div className="text-slate-500">جاري تحميل الباقات...</div> : (
            <div className="grid md:grid-cols-3 gap-8 text-right">
                {plans.map(plan => (
                    <div key={plan.id} className={`bg-[#1e293b] rounded-3xl p-8 border ${plan.id === 'pro' ? 'border-blue-500 shadow-xl shadow-blue-900/20 relative' : 'border-slate-700'}`}>
                        {plan.id === 'pro' && <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1 rounded-b-xl text-xs font-bold">الأكثر مبيعاً</div>}
                        <h3 className="text-xl font-bold mb-2">{plan.name_ar}</h3>
                        <div className="text-4xl font-bold mb-2 text-white">
                            {plan.price_monthly === 0 ? 'مجاناً' : `${plan.price_monthly} ر.س`}
                            <span className="text-sm text-slate-500 font-normal mr-1">/ شهر</span>
                        </div>
                        <p className="text-slate-400 text-sm mb-6">{plan.billing_cycle === 'trial' ? 'تجربة لمدة محدودة' : 'فوترة شهرية'}</p>
                        
                        <Link to="/login" className={`block w-full py-3 rounded-xl font-bold mb-8 transition ${plan.id === 'pro' ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}>
                            اختر الباقة
                        </Link>

                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <Check className="w-5 h-5 text-emerald-500"/>
                                <span className="text-sm">{plan.max_cars} سيارة كحد أقصى</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <Check className="w-5 h-5 text-emerald-500"/>
                                <span className="text-sm">{plan.max_users} مستخدمين للنظام</span>
                            </div>
                            <div className="flex items-center gap-3">
                                {plan.features.reports ? <Check className="w-5 h-5 text-emerald-500"/> : <X className="w-5 h-5 text-slate-600"/>}
                                <span className={`text-sm ${plan.features.reports ? 'text-slate-300' : 'text-slate-600'}`}>تقارير مالية متقدمة</span>
                            </div>
                            <div className="flex items-center gap-3">
                                {plan.features.export ? <Check className="w-5 h-5 text-emerald-500"/> : <X className="w-5 h-5 text-slate-600"/>}
                                <span className={`text-sm ${plan.features.export ? 'text-slate-300' : 'text-slate-600'}`}>تصدير البيانات Excel</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
};

export default PricingPage;
