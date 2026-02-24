import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { ShieldCheck, ArrowLeft, Mail, Loader2, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | null>(null);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Get email from login page if passed
    const loginEmail = searchParams.get('email');
    if (loginEmail) {
      setEmail(loginEmail);
    }
  }, [searchParams]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);

    try {
      // 1. Check if email exists
      const { data: existingUsers, error: checkError } = await supabase
        .from('profiles')
        .select('email')
        .eq('email', email)
        .maybeSingle();

      if (checkError) {
        throw new Error('فشل في الاتصال بقاعدة البيانات');
      }

      if (!existingUsers) {
        throw new Error('البريد الإلكتروني غير مسجل في النظام');
      }

      // 2. Send password reset email via Supabase
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);

      if (resetError) {
        throw new Error('فشل إرسال رابط استعادة كلمة المرور');
      }

      // 3. Success
      setMessageType('success');
      setMessage('تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني. يرجى التحقق من بريدك الإلكتروني واتبع التعليمات.');

      // Clear email after 5 seconds
      setTimeout(() => setEmail(''), 5000);

    } catch (err: any) {
      console.error('Password Reset Error:', err);
      setMessageType('error');

      let msg = 'حدث خطأ غير متوقع';

      if (err.message.includes('Email not found') || err.message.includes('not registered')) {
        msg = 'البريد الإلكتروني غير مسجل في النظام';
      } else if (err.message.includes('Failed to send') || err.message.includes('reset')) {
        msg = 'فشل إرسال رابط استعادة كلمة المرور';
      } else if (err.message.includes('Database error')) {
        msg = 'فشل في الاتصال بقاعدة البيانات';
      }

      setMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f172a] flex flex-col items-center justify-center p-4 font-[Cairo] relative overflow-hidden transition-colors duration-300">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20 pointer-events-none">
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-blue-600 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-600 rounded-full blur-[100px]"></div>
      </div>

      <div className="max-w-md w-full bg-white/80 dark:bg-[#1e293b]/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden z-10 relative transition-all duration-300">

        {/* Header */}
        <div className="p-8 pt-10">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-blue-900/50">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">استعادة كلمة المرور</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">أدخل بريدك الإلكتروني لاستعادة الوصول</p>
          </div>

          {message && (
            <div className={`mb-6 p-4 rounded-xl flex flex-col items-start gap-2 text-sm animate-in slide-in-from-top-2 ${messageType === 'success' ? 'bg-green-900/20 border-green-500/30 text-green-300' : 'bg-red-900/20 border-red-500/30 text-red-300'
              }`}>
              <div className="flex items-center gap-2">
                {messageType === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                <span>{message}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleResetPassword} className="space-y-5">
            <div>
              <label htmlFor="reset-email" className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
                البريد الإلكتروني (Email)
              </label>
              <div className="relative group">
                <Mail className="absolute right-3.5 top-3.5 text-slate-400 dark:text-slate-500 group-focus-within:text-blue-500 transition w-5 h-5" />
                <input
                  id="reset-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-600 rounded-xl p-3.5 pr-11 text-slate-900 dark:text-white outline-none focus:border-blue-500 transition shadow-inner"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <button
              disabled={loading}
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl font-bold text-white flex items-center justify-center gap-2 shadow-xl shadow-blue-900/30 transition transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && <Loader2 className="animate-spin w-5 h-5" />}
              إرسال رابط الاستعادة
              {!loading && <ArrowRight className="w-5 h-5" />}
            </button>
          </form>

          {/* Back to Login */}
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-xs text-slate-500 hover:text-white transition flex items-center justify-center gap-1 mx-auto font-bold"
            >
              <ArrowLeft className="w-3 h-3" />
              العودة لتسجيل الدخول
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50/50 dark:bg-[#0f172a]/50 border-t border-gray-200 dark:border-slate-700 p-4 text-center">
          <p className="text-xs text-slate-500">
            &copy; 2024 MyFleet Enterprise. Secure Recovery System.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
