
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Plan } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react';
import PricingSection from './PricingSection';

const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [configLoading, setConfigLoading] = useState(true);

  useEffect(() => {
    const checkConfig = async () => {
      try {
        const { data, error } = await supabase
          .from('public_config')
          .select('show_pricing_page')
          .eq('id', 1)
          .single();

        if (error || (data && !data.show_pricing_page)) {
          // If page is hidden or error, redirect to home
          console.warn('Pricing page is disabled or config missing');
          navigate('/');
          return;
        }
      } catch (err) {
        console.error('Config check failed', err);
      } finally {
        setConfigLoading(false);
      }
    };

    const fetchPlans = async () => {
      try {
        const { data, error } = await supabase
          .from('plans')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (error) throw error;
        if (data) {
          setPlans(data as Plan[]);
        }
      } catch (err) {
        console.error('Error fetching plans:', err);
      } finally {
        setLoading(false);
      }
    };

    checkConfig();
    fetchPlans();
  }, [navigate]);

  if (loading || configLoading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-white font-[Cairo]">
      {/* Simple Navbar */}
      <nav className="p-6 border-b border-slate-800 bg-[#0f172a]/90 backdrop-blur top-0 sticky z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2 text-white font-bold text-lg">
            <ShieldCheck className="w-6 h-6 text-blue-500" />
            <span className="text-xl font-bold">MyFleet <span className="text-blue-500">Pro</span></span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-slate-400 hover:text-white flex items-center gap-2 font-medium">
              <ArrowLeft className="w-4 h-4" /> العودة للدخول
            </Link>
            <Link to="/login?mode=register" className="hidden md:block bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl font-bold text-sm transition shadow-lg shadow-blue-900/20">
              ابدأ مجاناً
            </Link>
          </div>
        </div>
      </nav>

      {/* Pricing Section Wrapper */}
      <div className="min-h-[calc(100vh-80px)]">
        {/* We reuse the shared PricingSection component which already handles the UI/Logic for display */}
        <PricingSection
          plans={plans}
          onSelectPlan={() => navigate('/login?mode=register')}
        />
      </div>

      {/* Simple Footer */}
      <footer className="border-t border-slate-800 py-8 bg-[#020617] text-center text-slate-500 text-sm">
        <div className="max-w-7xl mx-auto px-6">
          © {new Date().getFullYear()} MyFleet Pro. جميع الحقوق محفوظة.
        </div>
      </footer>
    </div>
  );
};

export default PricingPage;
