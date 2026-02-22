import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Users, Send, Calendar, ShieldCheck, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

interface CampaignRecipient {
    id: string; // org_id
    name: string; // org_name
    phoneNumber: string;
    expiryDate: string;
    fullName: string;
}

interface CampaignStatus {
    total: number;
    sent: number;
    failed: number;
    inProgress: boolean;
}
interface WhatsAppCampaignManagerProps {
    sessionId: string;
    apiCall: (endpoint: string, options?: globalThis.RequestInit) => Promise<{ success: boolean; results?: unknown; result?: unknown; error?: string }>;
}

export const WhatsAppCampaignManager: React.FC<WhatsAppCampaignManagerProps> = ({ sessionId, apiCall }) => {
    const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
    const [filteredRecipients, setFilteredRecipients] = useState<CampaignRecipient[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterDays, setFilterDays] = useState<number>(30);
    const [message, setMessage] = useState('مرحباً {{name}}، نود تذكيركم بأن اشتراك مؤسسة {{org}} سينتهي بتاريخ {{date}}. يرجى التجديد لضمان استمرار الخدمة.');

    // Campaign Execution State
    const [status, setStatus] = useState<CampaignStatus>({ total: 0, sent: 0, failed: 0, inProgress: false });
    const [minDelay, setMinDelay] = useState(5); // seconds
    const [maxDelay, setMaxDelay] = useState(15); // seconds

    // Single Message State
    const [singlePhone, setSinglePhone] = useState('');
    const [singleMessage, setSingleMessage] = useState('');
    const [sendingSingle, setSendingSingle] = useState(false);

    // Helper to format phone numbers (Egyptian & International)
    const formatPhoneNumber = (phone: string) => {
        if (!phone) return '';
        let cleaned = phone.replace(/\D/g, ''); // Remove all non-digits

        // Egyptian number format: 01xxxxxxxxx -> 201xxxxxxxxx
        if (cleaned.length === 11 && cleaned.startsWith('01')) {
            return '20' + cleaned.substring(1);
        }
        // If it starts with 0 but length is 10 (e.g. 010...), add 2
        // Just in case, handled by length 11 above for standard mobile.
        // If it is 20... (12 digits) return as is.
        if (cleaned.startsWith('20') && cleaned.length === 12) {
            return cleaned;
        }
        // General case: remove leading + if exists, ensure country code.
        // For simplicity, just return digits.
        return cleaned;
    };

    const loadRecipients = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Fetch organizations
            const { data: orgs, error: orgError } = await supabase
                .from('organizations')
                .select('id, name, subscription_end')
                .eq('is_active', true);

            if (orgError) throw orgError;

            // 2. Fetch owners/admins for these orgs
            const { data: profiles, error: profError } = await supabase
                .from('profiles')
                .select('org_id, full_name, whatsapp_number, role')
                .in('role', ['owner', 'admin', 'super_admin'])
                .not('whatsapp_number', 'is', null);

            if (profError) throw profError;

            // 3. Map organizations to their owners
            const list: CampaignRecipient[] = (orgs || []).map(org => {
                const owner = profiles?.find(p => p.org_id === org.id);
                if (!owner) return null;

                return {
                    id: org.id,
                    name: org.name,
                    phoneNumber: formatPhoneNumber(owner.whatsapp_number!),
                    expiryDate: org.subscription_end || '',
                    fullName: owner.full_name
                };
            }).filter(Boolean) as CampaignRecipient[];

            setRecipients(list);
        } catch (err) {
            console.error('Error loading recipients:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadRecipients();
    }, [loadRecipients]);

    useEffect(() => {
        // Filter logic
        if (!recipients.length) return;

        const now = new Date();
        const targetDate = new Date();
        targetDate.setDate(now.getDate() + filterDays);

        const filtered = recipients.filter(r => {
            if (!r.expiryDate) return false;
            const exp = new Date(r.expiryDate);
            return exp <= targetDate && exp >= now;
        });

        setFilteredRecipients(filtered);
    }, [recipients, filterDays]);

    const runCampaign = async () => {
        if (!filteredRecipients.length || status.inProgress) return;
        if (!window.confirm(`هل أنت متأكد من بدء الحملة لـ ${filteredRecipients.length} عميل؟`)) return;

        setStatus({ total: filteredRecipients.length, sent: 0, failed: 0, inProgress: true });

        // Prepare data for the bulk API
        const bulkPayload = filteredRecipients.map(r => ({
            phoneNumber: r.phoneNumber,
            message: message
                .replace('{{name}}', r.fullName)
                .replace('{{org}}', r.name)
                .replace('{{date}}', r.expiryDate)
        }));

        try {
            // Note: Our modified backend now handles the delays internally if we pass options
            // But to show a progress bar in real-time on Frontend, we could also send one by one
            // However, the backend is safer for long-running tasks.
            // For UI progress, we'll send them one by one here to update the bar.

            for (let i = 0; i < bulkPayload.length; i++) {
                const item = bulkPayload[i];

                try {
                    // Random delay on Frontend too for extra safety if browser stays open
                    if (i > 0) {
                        // eslint-disable-next-line sonarjs/pseudo-random
                        const delayMs = (Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay) * 1000;
                        await new Promise(resolve => setTimeout(resolve, delayMs));
                    }

                    await apiCall('/api/messages/send', {
                        method: 'POST',
                        body: JSON.stringify({
                            sessionId,
                            phoneNumber: item.phoneNumber,
                            message: item.message
                        })
                    });

                    setStatus(prev => ({ ...prev, sent: prev.sent + 1 }));
                } catch (err) {
                    console.error('Failed to send message to', item.phoneNumber, err);
                    setStatus(prev => ({ ...prev, failed: prev.failed + 1 }));
                }
            }
        } finally {
            setStatus(prev => ({ ...prev, inProgress: false }));
            alert('اكتملت الحملة!');
        }
    };

    const sendSingleMessage = async () => {
        if (!singlePhone || !singleMessage) {
            alert('يرجى إدخال رقم الهاتف والرسالة');
            return;
        }

        const formattedPhone = formatPhoneNumber(singlePhone);

        setSendingSingle(true);
        try {
            const result = await apiCall('/api/messages/send', {
                method: 'POST',
                body: JSON.stringify({
                    sessionId,
                    phoneNumber: formattedPhone,
                    message: singleMessage
                })
            });

            if (result.success) {
                alert('تم الإرسال بنجاح!');
                setSingleMessage('');
            } else {
                alert('فشل الإرسال: ' + (result?.error || 'خطأ غير معروف'));
            }
        } catch (err: unknown) {
            const error = err as Error;
            console.error(error);
            alert(error.message || 'حدث خطأ أثناء الإرسال');
        } finally {
            setSendingSingle(false);
        }
    };

    const progressPercentage = status.total > 0 ? Math.round(((status.sent + status.failed) / status.total) * 100) : 0;

    return (
        <div className="space-y-6">
            {/* Header & Stats */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 rounded-xl">
                        <Users className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">إدارة الحملات الذكية</h3>
                        <p className="text-slate-400 text-sm">فلترة العملاء حسب انتهاء الاشتراك وإرسال التنبيهات</p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3">
                    <div className="px-4 py-2 bg-slate-900/50 rounded-xl border border-slate-700/50">
                        <p className="text-xs text-slate-500 mb-1">إجمالي المستهدفين</p>
                        <p className="text-lg font-bold text-white">{filteredRecipients.length}</p>
                    </div>
                    {status.inProgress && (
                        <div className="px-4 py-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
                            <p className="text-xs text-blue-400 mb-1">جاري الإرسال...</p>
                            <p className="text-lg font-bold text-blue-400">{status.sent} / {status.total}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Send Section */}
            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
                <div className="flex items-center gap-2 mb-4">
                    <Send className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-bold text-white">إرسال سريع</h3>
                </div>
                <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                        <label className="block text-sm text-slate-400 mb-1">رقم الهاتف (مع مفتاح الدولة)</label>
                        <input
                            type="text"
                            value={singlePhone}
                            onChange={(e) => setSinglePhone(e.target.value)}
                            placeholder="مثال: 201xxxxxxxxx"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ltr-input"
                            style={{ direction: 'ltr' }}
                        />
                    </div>
                    <div className="flex-[2] w-full">
                        <label className="block text-sm text-slate-400 mb-1">الرسالة</label>
                        <input
                            type="text"
                            value={singleMessage}
                            onChange={(e) => setSingleMessage(e.target.value)}
                            placeholder="اكتب رسالتك هنا..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        />
                    </div>
                    <button
                        onClick={sendSingleMessage}
                        disabled={sendingSingle || !singlePhone || !singleMessage}
                        className={`px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${sendingSingle || !singlePhone || !singleMessage
                            ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                            }`}
                    >
                        {sendingSingle ? <Clock className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        {sendingSingle ? 'جاري الإرسال...' : 'إرسال الآن'}
                    </button>
                </div>
            </div>

            {/* Config Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Filters */}
                <div className="lg:col-span-1 space-y-4 bg-slate-800/30 p-5 rounded-2xl border border-slate-700/50">
                    <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-5 h-5 text-purple-400" />
                        <h4 className="font-semibold text-white">فلترة المواعيد</h4>
                    </div>

                    <div className="space-y-3">
                        <label className="block">
                            <span className="text-sm text-slate-400 block mb-2">عرض العملاء الذين ينتهي اشتراكهم خلال:</span>
                            <select
                                value={[7, 15, 20, 30, 90].includes(filterDays) ? filterDays : 'custom'}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === 'custom') {
                                        setFilterDays(45); // Default for custom if not set
                                    } else {
                                        setFilterDays(Number(val));
                                    }
                                }}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            >
                                <option value={7}>7 أيام</option>
                                <option value={15}>15 يوم</option>
                                <option value={20}>20 يوم</option>
                                <option value={30}>30 يوم (شهر)</option>
                                <option value={90}>3 شهور</option>
                                <option value="custom">مخصص (عدد أيام محدد)...</option>
                            </select>
                        </label>

                        {![7, 15, 20, 30, 90].includes(filterDays) && (
                            <div className="animate-in slide-in-from-top-2 fade-in duration-200">
                                <label className="block text-xs text-slate-500 mb-1 mr-1">أدخل عدد الأيام:</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="365"
                                    value={filterDays}
                                    onChange={(e) => setFilterDays(Number(e.target.value))}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white focus:ring-1 focus:ring-blue-500/50 outline-none"
                                />
                            </div>
                        )}

                        <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/30">
                            <p className="text-xs text-slate-400">
                                💡 سيتم إرسال الرسائل لمالكي الشركات التي تنطبق عليها شروط الفلترة فقط.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Message Template */}
                <div className="lg:col-span-2 space-y-4 bg-slate-800/30 p-5 rounded-2xl border border-slate-700/50">
                    <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <h4 className="font-semibold text-white">محتوى الرسالة</h4>
                    </div>

                    <div>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={4}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            placeholder="اكتب نص الرسالة هنا..."
                        />
                        <div className="flex gap-2 mt-2">
                            {['{{name}}', '{{org}}', '{{date}}'].map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => setMessage(prev => prev + ' ' + tag)}
                                    className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300 hover:bg-slate-600 font-mono"
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/30">
                        <h5 className="text-sm font-bold text-slate-300 mb-2">معاينة تقريبية:</h5>
                        <p className="text-sm text-slate-400 whitespace-pre-wrap">
                            {message
                                .replace('{{name}}', 'أحمد محمد')
                                .replace('{{org}}', 'شركة النقل السريع')
                                .replace('{{date}}', new Date().toLocaleDateString('ar-EG'))
                            }
                        </p>
                    </div>
                </div>
            </div>

            {/* Anti-Ban Settings */}
            <div className="bg-slate-800/30 p-5 rounded-2xl border border-slate-700/50">
                <div className="flex items-center gap-2 mb-4">
                    <ShieldCheck className="w-5 h-5 text-amber-400" />
                    <h4 className="font-semibold text-white">إعدادات الحماية (Anti-Ban)</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">الحد الأدنى للتأخير (ثواني)</label>
                        <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            value={minDelay}
                            onChange={(e) => setMinDelay(Number(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white font-[inherit]"
                            style={{ direction: 'ltr', fontVariantNumeric: 'tabular-nums' }}
                            lang="en"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">الحد الأقصى للتأخير (ثواني)</label>
                        <input
                            type="number"
                            inputMode="numeric"
                            min={2}
                            value={maxDelay}
                            onChange={(e) => setMaxDelay(Number(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white font-[inherit]"
                            style={{ direction: 'ltr', fontVariantNumeric: 'tabular-nums' }}
                            lang="en"
                        />
                    </div>
                </div>
                <div className="mt-4 flex items-start gap-2 text-amber-500/70 text-sm bg-amber-500/5 p-3 rounded-lg border border-amber-500/10">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <p>نوصي بضبط تأخير لا يقل عن 5-15 ثانية لتجنب حظر الرقم من قبل واتساب.</p>
                </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col gap-4 sticky bottom-4">
                {status.inProgress && (
                    <div className="bg-slate-900 rounded-xl p-4 border border-blue-500/30 shadow-2xl">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-bold text-blue-400">جاري تنفيذ الحملة...</span>
                            <span className="text-sm text-slate-400">{progressPercentage}%</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div
                                className="bg-blue-500 h-full transition-all duration-300"
                                style={{ width: `${progressPercentage}%` }}
                            />
                        </div>
                        <div className="flex justify-between mt-2 text-xs text-slate-500">
                            <span>ناجح: {status.sent}</span>
                            <span>فشل: {status.failed}</span>
                        </div>
                    </div>
                )}

                <button
                    onClick={runCampaign}
                    disabled={loading || status.inProgress || filteredRecipients.length === 0}
                    className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all ${loading || status.inProgress || filteredRecipients.length === 0
                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-blue-500/20'
                        }`}
                >
                    {status.inProgress ? (
                        <>
                            <Clock className="w-6 h-6 animate-spin" />
                            جاري الإرسال...
                        </>
                    ) : (
                        <>
                            <Send className="w-6 h-6" />
                            بدء الحملة ({filteredRecipients.length} عميل)
                        </>
                    )}
                </button>
            </div>
            {/* Recipients List Table */}
            <div className="bg-slate-800/30 rounded-2xl border border-slate-700/50 overflow-hidden">
                <div className="p-4 border-b border-slate-700/50 bg-slate-900/30">
                    <h4 className="font-semibold text-white">قائمة المستهدفين ({filteredRecipients.length})</h4>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-right">
                        <thead>
                            <tr className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider">
                                <th className="px-6 py-4 font-semibold">المؤسسة</th>
                                <th className="px-6 py-4 font-semibold">المسؤول</th>
                                <th className="px-6 py-4 font-semibold">رقم الواتساب</th>
                                <th className="px-6 py-4 font-semibold">تاريخ الانتهاء</th>
                                <th className="px-6 py-4 font-semibold">الحالة</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/30">
                            {filteredRecipients.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500 italic">لا يوجد عملاء يطابقون هذه الفلترة حالياً</td>
                                </tr>
                            ) : (
                                filteredRecipients.map((r, idx) => (
                                    <tr key={idx} className="hover:bg-slate-700/20 transition-colors">
                                        <td className="px-6 py-4 font-medium text-white">{r.name}</td>
                                        <td className="px-6 py-4 text-slate-300">{r.fullName}</td>
                                        <td className="px-6 py-4 text-slate-400 font-mono text-sm">{r.phoneNumber}</td>
                                        <td className="px-6 py-4 text-slate-300">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-3.5 h-3.5 text-slate-500" />
                                                {r.expiryDate}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {status.inProgress && idx < (status.sent + status.failed) ? (
                                                <span className="px-2 py-1 bg-green-500/10 text-green-400 text-[10px] rounded border border-green-500/20">جاهز / مرسل</span>
                                            ) : (
                                                <span className="px-2 py-1 bg-slate-800 text-slate-500 text-[10px] rounded border border-slate-700">في الانتظار</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}



