import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, Car, BarChart3, Users, ArrowRight,
  Calculator, Smartphone, Globe, Menu, X, Mail, Phone, MapPin,
  Package, Truck, Megaphone
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Plan } from '../types';
import PricingSection from './PricingSection';

const LandingPage: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [showPricing, setShowPricing] = useState(false);

  // Smooth scroll to section
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingPlans(true);
        console.log('🔍 LandingPage: Fetching data...');

        // 1. Fetch visibility config
        const { data: configData, error: configError } = await supabase
          .from('public_config')
          .select('show_pricing_page')
          .single();

        console.log('📊 Config data:', configData);
        console.log('⚠️ Config error:', configError);

        if (configError) throw configError;

        const showPricingValue = configData?.show_pricing_page || false;
        console.log('✅ show_pricing_page value:', showPricingValue);
        setShowPricing(showPricingValue);

        // 2. Fetch plans from 'plans' table
        const { data: plansData, error: plansError } = await supabase
          .from('plans')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        console.log('📊 Plans data:', plansData);
        console.log('⚠️ Plans error:', plansError);

        if (plansError) throw plansError;
        if (plansData) {
          setPlans(plansData as Plan[]);
        }

        console.log('✅ LandingPage: Data fetched successfully');

      } catch (err) {
        console.error('❌ Error fetching data:', err);
      } finally {
        setLoadingPlans(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f172a] text-slate-900 dark:text-white font-[Cairo] overflow-x-hidden transition-colors duration-300">

      {/* 1. Navbar */}
      <nav className="border-b border-gray-200 dark:border-slate-800 bg-white/90 dark:bg-[#0f172a]/90 backdrop-blur-md sticky top-0 z-50 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2.5 rounded-xl shadow-lg shadow-blue-500/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold block leading-none">MyFleet <span className="text-blue-500">Pro</span></span>
              <span className="text-[10px] text-slate-400 tracking-wide">SMART FLEET MANAGER</span>
            </div>
          </div>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-8">
            <button onClick={() => scrollToSection('features')} className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-white font-medium transition text-sm bg-transparent border-none cursor-pointer">المميزات</button>
            {showPricing && <button onClick={() => scrollToSection('pricing')} className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-white font-medium transition text-sm bg-transparent border-none cursor-pointer">الأسعار</button>}
            <div className="h-6 w-px bg-gray-200 dark:bg-slate-800"></div>
            <Link to="/login" className="text-slate-900 dark:text-white font-bold text-sm hover:text-blue-600 dark:hover:text-blue-400 transition">تسجيل دخول</Link>
            <Link to="/login?mode=register" className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition shadow-lg shadow-blue-900/20 hover:scale-105">
              جرب مجاناً لمدة 14 يوم
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-white p-2">
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu Content */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#1e293b] border-b border-slate-700 p-4 space-y-4 animate-in slide-in-from-top-5">
            <button onClick={() => { scrollToSection('features'); setMobileMenuOpen(false); }} className="block text-slate-300 hover:text-white font-bold bg-transparent border-none cursor-pointer w-full text-right">المميزات</button>
            {showPricing && <button onClick={() => { scrollToSection('pricing'); setMobileMenuOpen(false); }} className="block text-slate-300 hover:text-white font-bold bg-transparent border-none cursor-pointer w-full text-right">الأسعار</button>}
            <Link to="/login" className="block text-blue-400 font-bold" onClick={() => setMobileMenuOpen(false)}>تسجيل دخول</Link>
          </div>
        )}
      </nav>

      {/* 2. Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background Glows */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[100px] -z-10"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-[100px] -z-10"></div>

        <div className="max-w-7xl mx-auto px-6 py-20 md:py-32 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold mb-6 animate-in fade-in zoom-in duration-500">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            الأنسب للشركات السعودية
          </div>

          <h1 className="text-4xl md:text-7xl font-bold mb-6 leading-tight animate-in fade-in slide-in-from-bottom-4 duration-700">
            نظام <span className="bg-gradient-to-r from-blue-400 to-emerald-400 text-transparent bg-clip-text">مدير الأسطول</span><br />
            الأذكى لأعمالك
          </h1>

          <p className="text-slate-600 dark:text-slate-400 text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-5 duration-700 delay-100">
            أول نظام يجمع بين إدارة السيارات وحساب أرباح كل رحلة بدقة متناهية.
            وفر فلوسك، راقب سياراتك، واعرف مكسبك الحقيقي في ثواني!
          </p>

          <div className="flex flex-col md:flex-row justify-center gap-4 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200">
            <Link to="/login?mode=register" className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 shadow-xl shadow-emerald-900/30 transition hover:-translate-y-1">
              ابدأ تجربة 14 يوم مجاناً <ArrowRight className="w-5 h-5" />
            </Link>
            <button onClick={() => scrollToSection('features')} className="bg-white dark:bg-[#1e293b] hover:bg-gray-50 dark:hover:bg-slate-700 text-slate-900 dark:text-white px-8 py-4 rounded-2xl font-bold text-lg border border-gray-200 dark:border-slate-700 transition flex items-center justify-center gap-2 shadow-lg dark:shadow-none cursor-pointer">
              اكتشف المميزات
            </button>
          </div>

          {/* Stats Preview */}
          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 border-t border-slate-800 pt-10">
            <div>
              <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">+500</div>
              <div className="text-sm text-slate-600 dark:text-slate-500">سيارة تدار يومياً</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-emerald-400 mb-1">100%</div>
              <div className="text-sm text-slate-500">حسابات دقيقة</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-400 mb-1">24/7</div>
              <div className="text-sm text-slate-500">نظام يعمل سحابياً</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-purple-400 mb-1">0</div>
              <div className="text-sm text-slate-500">مجهود في الحسابات</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Features Section (Grid) */}
      <div id="features" className="bg-gray-50 dark:bg-[#0f172a] py-24 relative transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-slate-900 dark:text-white">كل ما تحتاجه في مكان واحد</h2>
            <p className="text-slate-600 dark:text-slate-400 text-lg">مميزات صممت خصيصاً لتحل مشاكل "الحسبة" ومتابعة السائقين</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white dark:bg-[#1e293b] p-8 rounded-3xl border border-gray-200 dark:border-slate-700 hover:border-blue-500/50 transition group shadow-lg dark:shadow-none">
              <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-500 group-hover:text-white transition-colors duration-300">
                <Calculator className="w-7 h-7 text-blue-500 group-hover:text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">حاسبة الرحلة الذكية</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                ميزة حصرية تحسب لك "صافي الربح" لكل مشوار فوراً بعد خصم البنزين والزيت. النظام يقولك: الرحلة دي كسبانة ✅ ولا خسرانة ⚠️.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-[#1e293b] p-8 rounded-3xl border border-slate-700 hover:border-emerald-500/50 transition group">
              <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-300">
                <BarChart3 className="w-7 h-7 text-emerald-500 group-hover:text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">التقارير المالية</h3>
              <p className="text-slate-400 leading-relaxed">
                انسى الدفتر والقلم! ضغطة زر واحدة ترحل كل المصاريف والإيرادات لدفتر اليومية. اعرف دخلك الشهري وتكلفة كل كيلو بيمشيه أسطولك.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-[#1e293b] p-8 rounded-3xl border border-slate-700 hover:border-purple-500/50 transition group">
              <div className="w-14 h-14 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-purple-500 group-hover:text-white transition-colors duration-300">
                <Car className="w-7 h-7 text-purple-500 group-hover:text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">إدارة ذكية للسيارات</h3>
              <p className="text-slate-400 leading-relaxed">
                ملف كامل لكل عربية (رخصة، صيانة، سائق). النظام ينبهك قبل انتهاء الرخصة عشان تتجنب الغرامات، ويحسب نسب الشركاء تلقائياً.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-[#1e293b] p-8 rounded-3xl border border-slate-700 hover:border-orange-500/50 transition group">
              <div className="w-14 h-14 bg-orange-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-orange-500 group-hover:text-white transition-colors duration-300">
                <Users className="w-7 h-7 text-orange-500 group-hover:text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">صلاحيات الفريق</h3>
              <p className="text-slate-400 leading-relaxed">
                لكل واحد دوره. المالك يشوف الأرباح، المشرف يتابع العربيات، والسائق ليه صلاحيات محدودة. أمان تام لبياناتك.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-[#1e293b] p-8 rounded-3xl border border-slate-700 hover:border-pink-500/50 transition group">
              <div className="w-14 h-14 bg-pink-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-pink-500 group-hover:text-white transition-colors duration-300">
                <Smartphone className="w-7 h-7 text-pink-500 group-hover:text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">سريع ويعمل سحابياً</h3>
              <p className="text-slate-400 leading-relaxed">
                تطبيق خفيف جداً، يفتح من الموبايل أو اللابتوب في أي وقت ومن أي مكان. بياناتك محفوظة سحابياً بأمان تام.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-[#1e293b] p-8 rounded-3xl border border-slate-700 hover:border-cyan-500/50 transition group">
              <div className="w-14 h-14 bg-cyan-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-cyan-500 group-hover:text-white transition-colors duration-300">
                <Globe className="w-7 h-7 text-cyan-500 group-hover:text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">واجهة عربية بالكامل</h3>
              <p className="text-slate-400 leading-relaxed">
                صمم بأيدي عربية ليفهمه الجميع بسهولة. لا يحتاج لخبرة تقنية معقدة، وأزرار واضحة ومباشرة.
              </p>
            </div>

            {/* Feature 7: Inventory */}
            <div className="bg-[#1e293b] p-8 rounded-3xl border border-slate-700 hover:border-yellow-500/50 transition group">
              <div className="w-14 h-14 bg-yellow-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-yellow-500 group-hover:text-white transition-colors duration-300">
                <Package className="w-7 h-7 text-yellow-500 group-hover:text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">إدارة المخزون وقطع الغيار</h3>
              <p className="text-slate-400 leading-relaxed">
                تتبع دقيق لقطع الغيار، ومعرفة المخزون المتاح، وربط المصروفات بالصيانة تلقائياً.
              </p>
            </div>

            {/* Feature 8: Assets */}
            <div className="bg-[#1e293b] p-8 rounded-3xl border border-slate-700 hover:border-red-500/50 transition group">
              <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-red-500 group-hover:text-white transition-colors duration-300">
                <Truck className="w-7 h-7 text-red-500 group-hover:text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">إدارة الأصول والمعدات</h3>
              <p className="text-slate-400 leading-relaxed">
                لا تدير السيارات فقط! نظامنا يدعم المعدات الثقيلة والأصول الثابتة مع تتبع إهلاكاتها.
              </p>
            </div>

            {/* Feature 9: Announcements */}
            <div className="bg-[#1e293b] p-8 rounded-3xl border border-slate-700 hover:border-indigo-500/50 transition group">
              <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-indigo-500 group-hover:text-white transition-colors duration-300">
                <Megaphone className="w-7 h-7 text-indigo-500 group-hover:text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">نظام التعاميم والإشعارات</h3>
              <p className="text-slate-400 leading-relaxed">
                تواصل مع فريقك بلمسة زر. أرسل تعاميم للسائقين والموظفين وتأكد من وصولها للجميع.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Pricing Section (Dynamic) */}
      {showPricing && (
        <div id="pricing" className="py-24 bg-gradient-to-b from-[#0f172a] to-[#1e293b]">
          {loadingPlans ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-slate-400">جاري تحميل الباقات...</p>
            </div>
          ) : (
            <PricingSection
              plans={plans}
              onSelectPlan={(_plan) => window.location.href = '/login?mode=register'}
            />
          )}
        </div>
      )}

      {/* 5. Footer */}
      <footer className="bg-[#020617] border-t border-slate-800 py-12">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-6 h-6 text-blue-600" />
              <span className="text-xl font-bold text-white">MyFleet Pro</span>
            </div>
            <p className="text-slate-400 text-sm max-w-sm">
              نظامك المتكامل لإدارة الأسطول، الحسابات، والموظفين.
              نساعدك تحول بياناتك لأرباح حقيقية.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">روابط سريعة</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="hover:text-white bg-transparent border-none cursor-pointer text-slate-400">الرئيسية</button></li>
              <li><button onClick={() => scrollToSection('features')} className="hover:text-white bg-transparent border-none cursor-pointer text-slate-400">المميزات</button></li>
              {showPricing && <li><button onClick={() => scrollToSection('pricing')} className="hover:text-white bg-transparent border-none cursor-pointer text-slate-400">الأسعار</button></li>}
              <li><Link to="/login" className="hover:text-white">تسجيل الدخول</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">تواصل معنا</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-center gap-2"><Mail className="w-4 h-4" /> support@myfleet.sa</li>
              <li className="flex items-center gap-2"><Phone className="w-4 h-4" /> +966 50 000 0000</li>
              <li className="flex items-center gap-2"><MapPin className="w-4 h-4" /> الرياض، المملكة العربية السعودية</li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 pt-8 border-t border-slate-800 text-center text-sm text-slate-600">
          © {new Date().getFullYear()} MyFleet Pro. جميع الحقوق محفوظة.
        </div>
      </footer>

    </div>
  );
};

export default LandingPage;
