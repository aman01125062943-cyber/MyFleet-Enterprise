import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck, Loader2, Building2, User, Key, AlertCircle, ArrowRight, Lock, Mail, Eye, EyeOff, ArrowRight as ArrowRightIcon } from 'lucide-react';
import { db } from '../lib/db';
import { SystemConfig } from '../types';

const AuthScreen: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState<SystemConfig | null>(null);

    // Login Data
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    // ✨ NEW: Remember Me state
    const [rememberMe, setRememberMe] = useState(false);

    // Register Data (Only if allowed)
    const [orgName, setOrgName] = useState('');
    const [ownerName, setOwnerName] = useState('');
    const [regUsername, setRegUsername] = useState('');
    const [regPassword, setRegPassword] = useState('');

    // ✨ NEW: Show/Hide Password state
    const [showLoginPassword, setShowLoginPassword] = useState(false);
    const [showRegisterPassword, setShowRegisterPassword] = useState(false);

    const [errorMsg, setErrorMsg] = useState('');
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // Fix: Move state up to avoid "not defined" errors and detect mode
    const [whatsappNumber, setWhatsappNumber] = useState('');

    useEffect(() => {
        // Smart Redirect: Check if mode is register
        if (searchParams.get('mode') === 'register') {
            setIsLogin(false);
        }

        const fetchConfig = async () => {
            const { data } = await supabase.from('public_config').select().maybeSingle();
            if (data) {
                setConfig(data);
            } else {
                // Fallback: Allow registration if config is missing
                setConfig({ allow_registration: true, show_landing_page: true } as SystemConfig);
            }
        };
        fetchConfig();
    }, []);

    const handleOfflineLogin = async () => {
        const sessions = await db.sessions.toArray();
        // Lowercase comparison to be safe
        const matchedSession = sessions.find(s =>
            (s.profile.email && s.profile.email.toLowerCase() === username.toLowerCase()) ||
            (s.id === username)
        );

        if (matchedSession) {
            // Check Expiration
            if (Date.now() > matchedSession.expires_at) {
                throw new Error('انتهت صلاحية الجلسة المحفوظة. يرجى الاتصال بالإنترنت لتجديد الدخول.');
            }
            // Simulate login success
            navigate('/dashboard');
        } else {
            throw new Error('يجب تسجيل الدخول لأول مرة وأنت متصل بالإنترنت لمتابعة العمل أوفلاين.');
        }
    };

    const registerDevice = async () => {
        const generateUUID = () => {
            if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
            // Safer fallback using getRandomValues
            const rnds = new Uint8Array(16);
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                crypto.getRandomValues(rnds);
            } else {
                // Fallback for very old browsers (unlikely but safe)
                for (let i = 0; i < 16; i++) rnds[i] = Math.floor(Math.random() * 256);
            }

            // Adjust for UUID v4
            rnds[6] = (rnds[6] & 0x0f) | 0x40;
            rnds[8] = (rnds[8] & 0x3f) | 0x80;

            return [...rnds].map(b => b.toString(16).padStart(2, '0')).join('').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
        };

        const deviceId = localStorage.getItem('securefleet_device_id') || generateUUID();
        localStorage.setItem('securefleet_device_id', deviceId);
        try {
            await supabase.rpc('register_device_session', { p_device_id: deviceId, p_device_info: navigator.userAgent });
        } catch (e) { console.warn("Device reg failed", e); }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        setLoading(true);

        try {
            // Check Connectivity
            if (!navigator.onLine) {
                await handleOfflineLogin();
                return; // Exit after offline handling
            }

            // 1. Supabase Auth Login (ONLINE)
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: username,
                password: password
            });

            if (authError) throw authError;

            if (authData.session) {
                // 2. Fetch User Profile & Org
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', authData.user.id)
                    .maybeSingle();

                if (profileError || !profileData) {
                    throw new Error('فشل في جلب بيانات الملف الشخصي.');
                }

                let orgData = null;
                if (profileData.org_id) {
                    const { data: org } = await supabase.from('organizations').select('*').eq('id', profileData.org_id).maybeSingle();
                    orgData = org;
                }

                // 3. Cache for Offline Use with extended expiry if rememberMe is checked
                const sessionExpiry = rememberMe 
                    ? Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days if rememberMe
                    : Date.now() + (authData.session.expires_in * 1000); // Default expiry

                await db.sessions.put({
                    id: authData.user.id,
                    token: authData.session.access_token,
                    role: profileData.role,
                    profile: { ...profileData, email: username }, // Store email explicitly
                    org: orgData,
                    expires_at: sessionExpiry // Use calculated expiry
                });

                // 4. Save Remember Me preference
                if (rememberMe) {
                    localStorage.setItem('securefleet_remember_me', 'true');
                } else {
                    localStorage.removeItem('securefleet_remember_me');
                }

                // 5. Register Device (Optional Sync)
                await registerDevice();

                navigate('/dashboard');
            }

        } catch (err: unknown) {
            console.error(err);
            let msg = 'حدث خطأ أثناء تسجيل الدخول.';

            if (err instanceof Error) {
                msg = err.message;
            } else if (typeof err === 'object' && err !== null && 'message' in err) {
                msg = String((err as any).message);
            }

            // Login Errors (Localized)
            if (msg.includes('Invalid login credentials')) {
                msg = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
            } else if (msg.includes('Email not confirmed')) {
                msg = 'يرجى تفعيل حسابك من الرابط المرسل لبريدك الإلكتروني.';
            } else if (msg.includes('network')) {
                msg = 'يرجى التحقق من اتصال الإنترنت.';
            }

            setErrorMsg(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');

        // Validation: Email Format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(regUsername)) {
            setErrorMsg('يرجى إدخال عنوان بريد إلكتروني صحيح (مثال: name@company.com)');
            return;
        }

        if (regPassword.length < 6) {
            setErrorMsg('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
            return;
        }

        if (whatsappNumber.length < 10) {
            setErrorMsg('يرجى إدخال رقم واتساب صحيح للتواصل.');
            return;
        }

        setLoading(true);

        try {
            // 0. البريد الإلكتروني أو الواتساب مسجل مسبقاً؟ (Pre-check to avoid scary 500 errors)
            const { data: existingProfiles, error: checkError } = await supabase
                .from('profiles')
                .select('username, whatsapp_number')
                .or(`username.eq.${regUsername},whatsapp_number.eq.${whatsappNumber}`);

            if (checkError) {
                console.warn('Pre-check error:', checkError);
            } else if (existingProfiles && existingProfiles.length > 0) {
                const hasEmail = existingProfiles.some(p => p.username?.toLowerCase() === regUsername.toLowerCase());
                const hasWhatsApp = existingProfiles.some(p => p.whatsapp_number === whatsappNumber);

                if (hasEmail) {
                    setErrorMsg('عذراً، هذا البريد الإلكتروني مسجل مسبقاً.');
                    setLoading(false);
                    return;
                }
                if (hasWhatsApp) {
                    setErrorMsg('عذراً، رقم الواتساب هذا مسجل مسبقاً.');
                    setLoading(false);
                    return;
                }
            }

            // 1. Create Auth User
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: regUsername,
                password: regPassword,
            });

            if (authError) throw authError;

            if (authData.user) {
                // 2. Setup Tenant Data (Org + Profile) via Secure RPC
                const { error: rpcError } = await supabase.rpc('complete_signup', {
                    p_org_name: orgName,
                    p_owner_name: ownerName,
                    p_whatsapp_number: whatsappNumber // Pass WhatsApp Number
                });

                if (rpcError) throw rpcError;

                // 3. إرسال رسالة ترحيب عبر واتساب (في الخلفية - لا يوقف التسجيل)
                try {
                    const whatsappServerUrl = `http://${window.location.hostname}:3002`;

                    // جلب أول جلسة متصلة
                    const sessionsRes = await fetch(`${whatsappServerUrl}/api/sessions`);
                    const sessionsData = await sessionsRes.json();

                    if (sessionsData.success && sessionsData.sessions?.length > 0) {
                        const connectedSession = sessionsData.sessions.find(
                            (s: { status: string }) => s.status === 'connected'
                        );

                        if (connectedSession) {
                            // حساب تاريخ انتهاء الـ 14 يوم
                            const endDate = new Date();
                            endDate.setDate(endDate.getDate() + 14);
                            const endDateStr = endDate.toLocaleDateString('ar-EG');

                            const welcomeMessage = `مرحباً ${ownerName}! 👋

تم تسجيل حسابك بنجاح في MyFleet Enterprise.

📦 باقتك: النسخة التجريبية (14 يوم)
📆 تاريخ الانتهاء: ${endDateStr}

لمساعدة تواصل معنا على هذا الرقم.`;

                            // إرسال الرسالة
                            await fetch(`${whatsappServerUrl}/api/messages/send`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    sessionId: connectedSession.id,
                                    phoneNumber: whatsappNumber.replace(/\D/g, ''), // أرقام فقط
                                    message: welcomeMessage
                                })
                            });
                            console.log('✅ Welcome WhatsApp message sent successfully');
                        }
                    }
                } catch (whatsappError) {
                    // لا نوقف التسجيل إذا فشل إرسال الرسالة
                    console.warn('⚠️ Could not send WhatsApp welcome message:', whatsappError);
                }

                // 4. Navigate (Assuming Auto-Login if email confirm is disabled)
                if (authData.session) {
                    navigate('/dashboard');
                } else {
                    // If Email Confirmation is enabled
                    setErrorMsg('تم إنشاء الحساب بنجاح! يرجى التحقق من بريدك الإلكتروني لتفعيل الحساب.');
                    setIsLogin(true);
                }
            }

        } catch (err: any) {
            console.error('Registration Error:', err);
            let msg = 'حدث خطأ غير متوقع أثناء إنشاء الحساب.';

            const errorString = err.message || String(err);

            // تحويل الأخطاء التقنية لرسائل مفهومة بالعربية
            if (errorString.includes('profiles_whatsapp_number_key')) {
                msg = 'عذراً، رقم الواتساب هذا مسجل مسبقاً بنظامنا.';
            } else if (errorString.includes('already registered') || errorString.includes('Email already in use') || errorString.includes('profiles_username_key')) {
                msg = 'هذا البريد الإلكتروني مسجل مسبقاً بالفعل.';
            } else if (errorString.includes('Password should be at least')) {
                msg = 'كلمة السر قصيرة جداً (يجب أن تكون 6 أحرف على الأقل).';
            } else if (errorString.includes('invalid email')) {
                msg = 'البريد الإلكتروني المدخل غير صحيح.';
            } else if (errorString.includes('rate limit')) {
                msg = 'تم إرسال محاولات كثيرة جداً، يرجى الانتظار قليلاً.';
            } else if (errorString.includes('Database error saving new user') || errorString.includes('500')) {
                // رسالة عامة للمدير/المستخدم بدلاً من الرسالة التقنية المرعبة
                msg = 'حدث خطأ أثناء حفظ البيانات، يرجى التأكد من أن الإيميل أو رقم الواتساب لم يتم استخدامهما من قبل.';
            } else {
                msg = errorString;
            }

            setErrorMsg(msg);
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

                {/* Access Control Logic */}
                {config?.allow_registration ? (
                    <div className="flex border-b border-slate-700">
                        <button onClick={() => { setIsLogin(true); setErrorMsg(''); }} className={`flex-1 py-5 text-sm font-bold transition ${isLogin ? 'bg-gray-100 dark:bg-[#1e293b]/50 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' : 'bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>تسجيل دخول</button>
                        <button onClick={() => { setIsLogin(false); setErrorMsg(''); }} className={`flex-1 py-5 text-sm font-bold transition ${!isLogin ? 'bg-gray-100 dark:bg-[#1e293b]/50 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' : 'bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>تسجيل وكالة جديدة</button>
                    </div>
                ) : (
                    <div className="py-6 border-b border-gray-200 dark:border-slate-700 flex justify-center">
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-bold">
                            <Lock className="w-4 h-4" /> منطقة الأعضاء فقط
                        </div>
                    </div>
                )}

                <div className="p-8 pt-10">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-blue-900/50">
                            <ShieldCheck className="w-8 h-8" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">MyFleet Enterprise</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">أدخل بيانات اعتمادك للمتابعة</p>
                    </div>

                    {errorMsg && (
                        <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-xl flex flex-col items-start gap-2 text-red-300 text-sm animate-in slide-in-from-top-2">
                            <div className="flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 shrink-0" />
                                <span>{errorMsg}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => { localStorage.clear(); window.location.reload(); }}
                                className="text-xs underline text-red-500 hover:text-red-300 mt-1 font-bold"
                            >
                                واجهت مشكلة؟ اضغط هنا لتحديث التطبيق (Clear Cache)
                            </button>
                        </div>
                    )}

                    {isLogin ? (
                        <form onSubmit={handleLogin} className="space-y-5">
                            <div>
                                <label htmlFor="login-email" className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">اسم المستخدم / البريد الإلكتروني</label>
                                <div className="relative group">
                                    <User className="absolute right-3.5 top-3.5 text-slate-400 dark:text-slate-500 group-focus-within:text-blue-500 transition w-5 h-5" />
                                    <input id="login-email" required value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-600 rounded-xl p-3.5 pr-11 text-slate-900 dark:text-white outline-none focus:border-blue-500 transition shadow-inner" placeholder="name@company.com" />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="login-password" className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">كلمة المرور</label>
                                <div className="relative group">
                                    <Key className="absolute right-3.5 top-3.5 text-slate-400 dark:text-slate-500 group-focus-within:text-blue-500 transition w-5 h-5" />
                                    <input 
                                        id="login-password" 
                                        type={showLoginPassword ? "text" : "password"}
                                        required 
                                        value={password} 
                                        onChange={e => setPassword(e.target.value)} 
                                        className="w-full bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-slate-600 rounded-xl p-3.5 pr-11 text-slate-900 dark:text-white outline-none focus:border-blue-500 transition shadow-inner" 
                                        placeholder="••••••" 
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                                        className="absolute right-3.5 top-3.5 text-slate-400 dark:text-slate-500 group-focus-within:text-blue-500 transition w-5 h-5"
                                    >
                                        {showLoginPassword ? <EyeOff /> : <Eye />}
                                    </button>
                                </div>
                            </div>

                            {/* ✨ NEW: Remember Me Checkbox */}
                            <div className="flex items-center gap-2">
                                <input 
                                    type="checkbox" 
                                    id="remember-me"
                                    checked={rememberMe}
                                    onChange={e => setRememberMe(e.target.checked)}
                                    className="w-4 h-4 rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <label htmlFor="remember-me" className="text-sm text-slate-600 dark:text-slate-400 select-none cursor-pointer">
                                    تذكيري (حفظ بيانات الدخول لمدة 30 يوم)
                                </label>
                            </div>

                            <button disabled={loading} className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl font-bold text-white flex items-center justify-center gap-2 shadow-xl shadow-blue-900/30 transition transform active:scale-[0.98]">
                                {loading && <Loader2 className="animate-spin w-5 h-5" />}
                                دخول آمن
                            </button>

                            {/* ✨ NEW: Forgot Password Link */}
                            <div className="text-center pt-2">
                                <button 
                                    type="button" 
                                    className="text-xs text-slate-500 hover:text-blue-500 transition font-medium underline"
                                    onClick={() => navigate('/forgot-password')}
                                >
                                    هل نسيت كلمة المرور؟
                                </button>
                            </div>

                            {config?.show_landing_page && (
                                <div className="text-center pt-2">
                                    <button type="button" onClick={() => navigate('/landing')} className="text-xs text-slate-500 hover:text-white transition flex items-center justify-center gap-1 mx-auto">
                                        العودة للصفحة الرئيسية <ArrowRightIcon className="w-3 h-3" />
                                    </button>
                                </div>
                            )}
                        </form>
                    ) : (
                        <form onSubmit={handleRegister} className="space-y-4">
                            <div>
                                <label htmlFor="reg-org" className="text-xs font-bold text-slate-400 mb-1 block">اسم الوكالة / الشركة</label>
                                <div className="relative">
                                    <Building2 className="absolute right-3 top-3 text-slate-500 w-5 h-5" />
                                    <input id="reg-org" required value={orgName} onChange={e => setOrgName(e.target.value)} className="w-full bg-[#0f172a] border border-slate-600 rounded-xl p-3 pr-10 text-white outline-none focus:border-blue-500" placeholder="شركة الأفق للسيارات" />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="reg-owner" className="text-xs font-bold text-slate-400 mb-1 block">اسم المالك</label>
                                <div className="relative">
                                    <User className="absolute right-3 top-3 text-slate-500 w-5 h-5" />
                                    <input id="reg-owner" required value={ownerName} onChange={e => setOwnerName(e.target.value)} className="w-full bg-[#0f172a] border border-slate-600 rounded-xl p-3 pr-10 text-white outline-none focus:border-blue-500" placeholder="الاسم الكامل" />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="reg-email" className="text-xs font-bold text-slate-400 mb-1 block">البريد الإلكتروني (للدخول)</label>
                                <div className="relative">
                                    <Mail className="absolute right-3 top-3 text-slate-500 w-5 h-5" />
                                    <input id="reg-email" required value={regUsername} onChange={e => setRegUsername(e.target.value)} className="w-full bg-[#0f172a] border border-slate-600 rounded-xl p-3 pr-10 text-white outline-none focus:border-blue-500" placeholder="name@company.com" />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="reg-password" className="text-xs font-bold text-slate-400 mb-1 block">كلمة المرور</label>
                                <div className="relative group">
                                    <Key className="absolute right-3 top-3 text-slate-500 w-5 h-5" />
                                    <input 
                                        id="reg-password" 
                                        type={showRegisterPassword ? "text" : "password"}
                                        required 
                                        value={regPassword} 
                                        onChange={e => setRegPassword(e.target.value)} 
                                        className="w-full bg-[#0f172a] border border-slate-600 rounded-xl p-3 pr-10 text-white outline-none focus:border-blue-500 placeholder:text-slate-600"
                                        placeholder="••••••" 
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                                        className="absolute right-3 top-3 text-slate-500 group-focus-within:text-blue-500 transition w-5 h-5"
                                    >
                                        {showRegisterPassword ? <EyeOff /> : <Eye />}
                                    </button>
                                </div>
                            </div>

                            <div className="bg-blue-900/20 p-4 rounded-xl border border-blue-500/30">
                                <label htmlFor="reg-whatsapp" className="text-xs font-bold text-blue-400 mb-1 block">رقم الواتساب (إجباري)</label>
                                <div className="relative mb-2">
                                    <div className="absolute right-3 top-3 text-slate-500 w-5 h-5">📱</div>
                                    <input
                                        id="reg-whatsapp"
                                        required
                                        value={whatsappNumber}
                                        onChange={e => setWhatsappNumber(e.target.value)}
                                        className="w-full bg-[#0f172a] border border-blue-500/50 rounded-xl p-3 pr-10 text-white outline-none focus:border-blue-400 placeholder:text-slate-600"
                                        placeholder="مثال: 01000000000"
                                    />
                                </div>
                                <p className="text-[10px] text-blue-300 flex items-start gap-1">
                                    <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                                    سيتم ربط هذا الرقم بحسابك لإرسال تنبيهات الاشتراك وتفاصيل الباقة. لا يمكن تغيير الرقم لاحقاً بسهولة.
                                </p>
                            </div>

                            <button disabled={loading} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 transition mt-2">
                                {loading && <Loader2 className="animate-spin w-5 h-5" />}
                                إنشاء وكالة جديدة
                            </button>
                        </form>
                    )}
                </div>
            </div>

            <div className="mt-8 text-center text-slate-500 text-xs">
                &copy; 2024 MyFleet Enterprise. Secure Zero-Trust System.
            </div>
        </div>
    );
};

export default AuthScreen;
